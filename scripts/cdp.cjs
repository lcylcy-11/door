// Minimal Chrome DevTools Protocol driver for trusted-input play tests (no dependencies).
// Mouse events sent with Input.dispatchMouseEvent go through the browser's real hit testing,
// pointer capture and user-activation pipeline, unlike element.dispatchEvent in page scripts.
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function launch({url, width = 1280, height = 800, headless = true, port = 9333} = {}) {
  const exe = process.env.CDP_BROWSER || BROWSERS.find(p => fs.existsSync(p));
  if (!exe) throw new Error('No Chromium-based browser found; set CDP_BROWSER.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'door-cdp-'));
  const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
  if (headless) args.push('--headless=new');
  const child = spawn(exe, [...args, 'about:blank'], {stdio: 'ignore'});
  let target;
  for (let i = 0; i < 100 && !target; i++) {
    await sleep(100);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
  }
  if (!target) { child.kill(); throw new Error('Browser did not expose a page target.'); }
  const page = await connect(target.webSocketDebuggerUrl);
  page.close = async () => { try { page.ws.close(); } catch {} child.kill(); await sleep(300); try { fs.rmSync(profile, {recursive: true, force: true}); } catch {} };
  await page.send('Page.enable'); await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
  // Headless pages report as hidden unless focus is emulated; the game pauses on hidden/blur.
  await page.send('Emulation.setFocusEmulationEnabled', {enabled: true});
  if (url) await page.goto(url);
  return page;
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl), pending = new Map(), listeners = [];
  let id = 0;
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = message => {
    const data = JSON.parse(message.data);
    if (data.id && pending.has(data.id)) {
      const {resolve, reject} = pending.get(data.id); pending.delete(data.id);
      data.error ? reject(new Error(data.error.message)) : resolve(data.result);
    } else for (const listener of listeners) listener(data);
  };
  const page = {
    ws, listeners,
    send(method, params = {}) { const n = ++id; ws.send(JSON.stringify({id: n, method, params})); return new Promise((resolve, reject) => pending.set(n, {resolve, reject})); },
    async goto(url) {
      const loaded = new Promise(resolve => listeners.push(function once(e) { if (e.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(once), 1); resolve(); } }));
      await page.send('Page.navigate', {url}); await loaded;
    },
    async eval(expression) {
      const result = await page.send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    },
    // Centre of an element's border box in CSS pixels, or null when it is absent/hidden.
    async box(selector) {
      return page.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null;
        const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') return null;
        return {x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left, top: r.top, width: r.width, height: r.height}; })()`);
    },
    mouse: {x: 0, y: 0, buttons: 0},
    async move(x, y) {
      page.mouse.x = x; page.mouse.y = y;
      await page.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y, buttons: page.mouse.buttons, button: page.mouse.buttons & 1 ? 'left' : page.mouse.buttons & 2 ? 'right' : 'none'});
    },
    async down(button = 'left') {
      page.mouse.buttons |= button === 'left' ? 1 : 2;
      await page.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: page.mouse.x, y: page.mouse.y, button, buttons: page.mouse.buttons, clickCount: 1});
    },
    async up(button = 'left') {
      page.mouse.buttons &= button === 'left' ? ~1 : ~2;
      await page.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: page.mouse.x, y: page.mouse.y, button, buttons: page.mouse.buttons, clickCount: 1});
    },
    async click(x, y) { await page.move(x, y); await page.down(); await sleep(60); await page.up(); },
    // Smooth human-like move over `ms`, emitting a mouse event roughly every frame.
    async glide(x, y, ms = 300) {
      const x0 = page.mouse.x, y0 = page.mouse.y, steps = Math.max(1, Math.round(ms / 16));
      for (let i = 1; i <= steps; i++) { const t = i / steps; await page.move(x0 + (x - x0) * t, y0 + (y - y0) * t); await sleep(ms / steps); }
    },
    async key(key, code = key, keyCode = 0) {
      await page.send('Input.dispatchKeyEvent', {type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode});
      await page.send('Input.dispatchKeyEvent', {type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode});
    },
    async screenshot(file) {
      const {data} = await page.send('Page.captureScreenshot', {format: 'png'});
      fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, Buffer.from(data, 'base64'));
    }
  };
  return page;
}

module.exports = {launch, sleep};
