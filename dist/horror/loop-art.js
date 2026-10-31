(function (root) {
  'use strict';
  // A fine 800 x 450 one-bit corridor grid; characters and optical rims use coarser pixel layers.
  const UNIT = 4, G = Object.freeze({ x: 744, y: 104, w: 312, h: 664, right: 1056, travel: 328 });
  const DOORS = Object.freeze(Object.fromEntries(['plain', 'cracked', 'frost', 'red', 'white', 'hinge', 'broken'].map(type => [type, Object.freeze({ u: 70 / 78, v: 93 / 166, pv: 50 / 166 })])));
  const PLATES = Object.freeze(['ordinary', 'slipped', 'watched', 'missing', 'occupied', 'reversed', 'last']);
  const W = '#fff', B = '#000';
  const q = value => Math.round(value);
  const rect = (x, y, w, h, fill = W) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
  const path = (d, fill = W) => `<path d="${d}" fill="${fill}"/>`;
  function pixelLine(x0, y0, x1, y1, fill = W) {
    x0 = q(x0); y0 = q(y0); x1 = q(x1); y1 = q(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let error = dx + dy, d = '';
    for (let i = 0; i < 900; i++) {
      d += `M${x0} ${y0}h1v1h-1Z`;
      if (x0 === x1 && y0 === y1) break;
      const e = 2 * error;
      if (e >= dy) { error += dy; x0 += sx; }
      if (e <= dx) { error += dx; y0 += sy; }
    }
    return path(d, fill);
  }
  function outline(x, y, w, h, fill = W) {
    return rect(x, y, w, 1, fill) + rect(x, y + h - 1, w, 1, fill) + rect(x, y, 1, h, fill) + rect(x + w - 1, y, 1, h, fill);
  }
  function scratches(seed, x, y, w, h, count, fill = W) {
    let s = seed >>> 0, d = '';
    for (let i = 0; i < count; i++) {
      s = (s * 1664525 + 1013904223) >>> 0; const px = x + s % w;
      s = (s * 1664525 + 1013904223) >>> 0; const py = y + s % h;
      const len = 1 + ((s >>> 16) % 5);
      d += `M${px} ${py}h${Math.min(len, x + w - px)}v1h-${Math.min(len, x + w - px)}Z`;
    }
    return path(d, fill);
  }
  function defs() {
    return `<defs>
      <pattern id="dot12" width="4" height="4" patternUnits="userSpaceOnUse">${rect(0, 0, 4, 4, B)}${rect(0, 0, 1, 1)}${rect(2, 2, 1, 1)}</pattern>
      <pattern id="dot25" width="2" height="2" patternUnits="userSpaceOnUse">${rect(0, 0, 2, 2, B)}${rect(0, 0, 1, 1)}</pattern>
      <pattern id="dot50" width="2" height="2" patternUnits="userSpaceOnUse">${rect(0, 0, 2, 2, B)}${rect(0, 0, 1, 1)}${rect(1, 1, 1, 1)}</pattern>
      <pattern id="dot75" width="2" height="2" patternUnits="userSpaceOnUse">${rect(0, 0, 2, 2)}${rect(0, 0, 1, 1, B)}</pattern>
      <pattern id="slats" width="4" height="8" patternUnits="userSpaceOnUse">${rect(0, 0, 4, 8, B)}${rect(0, 0, 1, 7)}</pattern>
      <clipPath id="lensCircle"><path d="M620 164H980V184H1020V208H1052V240H1076V280H1096V324H1108V576H1096V620H1076V660H1052V692H1020V716H980V736H620V716H580V692H548V660H524V620H504V576H492V324H504V280H524V240H548V208H580V184H620Z"/></clipPath>
    </defs>`;
  }
  function layout(type) { if (!DOORS[type]) throw new Error('Unknown door'); return { ...G }; }
  function pose(type, opening = 0, reverse = false) {
    const g = layout(type);
    if (type === 'hinge') { const angle = opening * 1.25; return `matrix(${Math.cos(angle)} ${-.12 * Math.sin(angle)} 0 1 ${g.x} ${g.y})`; }
    return `translate(${g.x + (reverse ? 1 : -1) * g.travel * opening} ${g.y})`;
  }
  function point(type, opening = 0, reverse = false, spy = false) {
    const d = DOORS[type], g = layout(type), u = spy ? .5 : d.u, v = spy ? d.pv : d.v;
    const localX = (reverse ? 1 - u : u) * g.w;
    if (type === 'hinge') { const angle = opening * 1.25; return { x: g.x + localX * Math.cos(angle), y: g.y + v * g.h - localX * .12 * Math.sin(angle) }; }
    return { x: g.x + localX + (reverse ? 1 : -1) * g.travel * opening, y: g.y + v * g.h };
  }
  const hand = `<g shape-rendering="crispEdges" transform="scale(2)">${path('M-7 7V-10H-4V1H-2V-16H1V1H3V-13H6V3H8V-8H11V11H9V16H5V20H-4V17H-7V13H-10V9H-13V3H-10V5H-8V7Z', B)}${path('M-7 6V-11H-3V0H-2V-17H2V0H3V-14H7V2H8V-9H12V12H10V17H6V21H-5V18H-8V14H-11V10H-14V2H-10V4H-8V6Z')}${path('M-6 7V-10H-4V3H-1V-16H1V3H4V-13H6V5H9V-8H11V11H9V16H5V20H-4V17H-7V13H-10V9H-13V3H-11V6H-8V9H-6Z', B)}</g>`;
  function silhouette(id) {
    // Same bounding region as the old sprite: centered on x=0, head above y=-170.
    return `<g id="${id}" opacity="0" shape-rendering="crispEdges"><g transform="scale(4)">${path('M-9-55H6V-52H10V-46H12V-35H9V-27H6V-22H12V-19H20V-14H24V-4H27V16H22V-2H19V30H5V4H1V30H-12V-2H-16V16H-22V-8H-19V-16H-13V-21H-7V-28H-11V-37H-14V-47H-12V-52H-9Z', B)}${rect(-7, -48, 2, 1, W)}${rect(3, -48, 2, 1, W)}${rect(-4, -38, 7, 1, W)}${rect(-14, -13, 1, 25, W)}${rect(18, -12, 1, 22, W)}${rect(0, -15, 1, 36, 'url(#dot50)')}</g></g>`;
  }
  function scatter(seed, x, y, w, h, count, fill = W, horizontal = false) {
    let value = seed >>> 0, d = '';
    for (let i = 0; i < count; i++) {
      value = (value * 1664525 + 1013904223) >>> 0; const px = x + value % w;
      value = (value * 1664525 + 1013904223) >>> 0; const py = y + value % h;
      const len = horizontal ? 1 + ((value >>> 22) % 7) : 1;
      d += `M${px} ${py}h${len}v1h-${len}Z`;
    }
    return path(d, fill);
  }
  function lightGrain(seed, index) {
    // Cached irregular stipple, then uneven pools of fluorescent light across rough plaster.
    // Separate patterns per composition keep nested rooms' SVG references unambiguous.
    lightGrain.serial = (lightGrain.serial || 0) + 1;
    const name = 'plaster' + lightGrain.serial, tones = [.07, .16, .28];
    lightGrain.tiles = lightGrain.tiles || tones.map((density, tone) => {
      let d = '';
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        let n = Math.imul(x + 1 + tone * 71, 374761393) ^ Math.imul(y + 1 + seed, 668265263);
        n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16;
        if ((n >>> 0) / 4294967296 < density) d += `M${x} ${y}h1v1h-1Z`;
      }
      return path(d);
    });
    let s = '<defs>';
    tones.forEach((tone, i) => { s += `<pattern id="${name}t${i}" width="32" height="32" patternUnits="userSpaceOnUse">${rect(0, 0, 32, 32, B)}${lightGrain.tiles[i]}</pattern>`; });
    s += '</defs>';
    const dark = `url(#${name}t0)`, mid = `url(#${name}t1)`, light = `url(#${name}t2)`;
    s += rect(56, 33, 688, 350, dark);
    // The brightest plaster hugs the door, with broken vertical boundaries and stains.
    s += path('M283 33h283v20h21v17h-12v32h-11v27h10v34h-15v38h9v25h-12v39h-16v119h-28V64H369v320h-33v-51h-9v-49h10v-40h-14v-39h7v-37h-12v-35h9V91h-12V66h-32Z', mid);
    s += path('M354 40h185v17h11v39h-10v48h9v30h-12v58h11v43h-14v109h-15V61H370v323h-13v-42h-8v-55h8v-45h-9v-47h6v-40h-7v-39h8V71h-1Z', index >= 5 ? mid : light);
    // The far wall catches weaker, irregular reflected light around the black window and board.
    s += path('M67 60h34v24h213v10h-10v161H113v16H88v46H66v-30h13v-51H66v-58h11v-54H65Z', mid);
    s += path('M577 63h123v14h21v30h-15v144H574v-14h-17v-47h11v-37h-7v-39h16Z', mid);
    s += path('M94 275h202v18h20v29h-14v34h14v28H84v-31h12v-25H84v-26h10Z', mid);
    s += path('M562 277h98v18h24v23h-13v35h-13v31h-99v-36h11v-31h-8Z', mid);
    // Irregular dark scallops and long fine drips distress the light fields.
    s += path('M352 34h8v18h-3v17h-4v22h-4v24h-3V87h4V61h2Z M541 34h7v25h-3v19h3v32h-4v21h-2v-25h2V79h-4V56h1Z', B);
    s += path('M329 126h5v17h-3v20h4v24h-3v26h-2v-29h2v-18h-4v-26h1Z M565 171h4v23h-2v21h3v31h-3v22h-2v-26h2v-29h-3v-22h1Z', B);
    return s;
  }
  function wall(index) {
    let s = rect(0, 0, 800, 450, B) + lightGrain(517, index);
    s += pixelLine(0, 0, 55, 32, 'url(#dot25)') + pixelLine(55, 32, 745, 32, 'url(#dot25)') + pixelLine(745, 32, 800, 0, 'url(#dot25)');
    s += pixelLine(55, 32, 55, 384, 'url(#dot12)') + pixelLine(745, 32, 745, 384, 'url(#dot12)');
    // A horizontal hospital rail, worn through in several places.
    s += rect(56, 263, 690, 5, 'url(#dot25)') + rect(56, 263, 690, 1, 'url(#dot50)') + rect(56, 270, 690, 2, B);
    s += rect(56, 370, 690, 2, 'url(#dot12)') + rect(55, 382, 690, 2, 'url(#dot25)');
    for (const x of [93, 198, 302, 581, 688]) s += rect(x, 273, 1, 108, 'url(#dot12)');
    s += rect(391, 15, 118, 7, B) + rect(391, 15, 118, 1, 'url(#dot50)') + rect(391, 21, 118, 1, 'url(#dot25)') + rect(393, 17, index >= 5 ? 39 : index >= 3 ? 77 : 114, 2);
    s += rect(413, 0, 1, 15, 'url(#dot25)') + rect(484, 0, 1, 15, 'url(#dot25)');
    // Uneven ink drips and cracks interrupt the sparse light, never a flat checkerboard wall.
    for (const [x, y, h] of [[83, 35, 96], [327, 34, 119], [559, 36, 79], [714, 35, 132]]) {
      s += rect(x, y, 4, h, B) + rect(x + 4, y + 7, 1, h - 21, 'url(#dot25)') + rect(x - 2, y, 1, 21, 'url(#dot25)');
      if (index >= 2) s += rect(x + 8, y, 2, h + index * 6, B) + rect(x + 10, y + 17, 1, h, 'url(#dot25)');
    }
    if (index >= 3) s += path('M548 36h2v31h4v36h-2v43h4v24h-2V149h-4V104h2V69h-4Z', 'url(#dot50)');
    if (index >= 5) s += path('M308 53h2v38h-3v28h-3v42h-3v35h-2V159h3v-42h3V90h3Z', 'url(#dot50)');
    // Wet tiled floor: broken horizontal reflections, sparse seams disappearing into black.
    s += scatter(319, 0, 385, 800, 65, 750, W, true);
    for (const y of [391, 401, 418, 441]) s += rect(0, y, 800, 1, 'url(#dot12)');
    for (const x of [-160, 80, 320, 560, 800, 1040]) s += pixelLine(448 + (x - 448) * .55, 384, x, 450, 'url(#dot12)');
    for (let y = 388; y < 450; y += 3) {
      const spread = 21 + (y - 388) * .54, left = q(449 - spread);
      s += rect(left + ((y * 7) % 13), y, q(spread * 1.5), 1, y % 2 ? 'url(#dot50)' : 'url(#dot25)');
      if (y % 5 === 0) s += rect(left - 18, y, 9, 1, 'url(#dot25)');
    }
    return s;
  }
  function picture(index) {
    // The left observation window contains only barely legible foliage at first.
    let s = rect(112, 93, 199, 159, B) + outline(112, 93, 199, 159, 'url(#dot25)') + outline(116, 97, 191, 151, 'url(#dot12)');
    s += rect(116, 97, 191, 1, 'url(#dot50)') + rect(118, 100, 187, 145, B) + rect(116, 247, 192, 5, 'url(#dot25)');
    s += rect(209, 99, 3, 147, 'url(#dot25)') + rect(119, 174, 187, 2, 'url(#dot25)');
    s += path('M141 242v-19h-6v-8h4v-8h4v-21h3v-7h3v18h6v-11h4v-7h4v14h-4v12h-6v20h12v17Z', 'url(#dot25)');
    s += path('M267 244v-33h-7v-9h4v-13h4v-14h3v-8h4v19h5v-11h4v-8h4v17h-4v17h-8v21h14v22Z', 'url(#dot12)');
    s += scatter(242, 122, 103, 180, 138, 90, W);
    if (index >= 2) s += path('M228 157h13v3h4v8h3v22h-3v10h-3v9h8v5h7v29h-49v-28h6v-6h8v-9h-3v-12h-3v-22h3v-6h5v-3Z', 'url(#dot12)');
    if (index >= 3) s += path('M214 213v-17h2v-12h4v-9h5v16h-4v9h-2v13Z M251 213v-17h-2v-12h-4v-9h-5v16h4v9h2v13Z', 'url(#dot25)');
    if (index >= 5) s += path('M148 104h2v18h-3v20h-3v25h-2v18h-1v-19h2v-27h2v-18h3Z', 'url(#dot50)');
    return s;
  }
  function furniture(index) {
    // A deep, nearly black noticeboard: blank paper silhouettes carry no writing.
    let s = rect(574, 96, 133, 148, B) + outline(574, 96, 133, 148, 'url(#dot25)') + outline(577, 99, 127, 142, 'url(#dot12)');
    const papers = [[589, 110, 27, 39], [625, 112, 31, 33], [664, 110, 23, 47], [590, 166, 32, 42], [637, 161, 26, 45], [672, 183, 21, 39]];
    papers.forEach(([x, y, w, h], n) => {
      const offset = index >= 3 && n === 3 ? 11 : index === 1 && n === 1 ? 3 : 0;
      if (index >= 5 && (n === 2 || n === 4)) return;
      s += rect(x, y + offset, w, h, 'url(#dot75)') + rect(x + 2, y + offset + 2, w - 4, h - 4, n % 2 ? 'url(#dot50)' : W);
      s += scatter(n * 27 + 1, x + 1, y + offset + 1, w - 2, h - 2, 15, B);
      s += rect(x + q(w / 2), y + offset + 1, 2, 2, B);
    });
    if (index >= 4) s += path('M600 244v8h-5v9h-3v11h-2v13h-3v15h-2v18h-2v-21h2v-15h3v-13h2v-12h4v-8h3v-5Z', 'url(#dot25)');
    // Waiting chair silhouette and its narrow reflected metal legs.
    s += path('M60 450v-41h8v-12h6v-73h5v-5h76v5h6v73h7v12h8v41h-8v-32H68v32Z', B);
    s += pixelLine(79, 321, 152, 321, 'url(#dot25)') + pixelLine(79, 322, 79, 395, 'url(#dot25)') + rect(70, 399, 94, 3, 'url(#dot25)') + rect(70, 416, 3, 34, 'url(#dot25)') + rect(165, 416, 2, 34, 'url(#dot12)');
    s += rect(74, 404, 85, 1, 'url(#dot12)');
    // Unlabelled boxes pile up on the right, with chipped edges rather than clean outlines.
    const boxes = index >= 5 ? [[651, 381, 104, 66], [676, 330, 77, 51], [684, 289, 65, 41], [632, 348, 43, 50]] : [[651, 381, 104, 66], [676, 330, 77, 51]];
    boxes.forEach(([x, y, w, h], n) => {
      s += rect(x, y, w, h, B) + outline(x, y, w, h, 'url(#dot25)') + rect(x + 1, y + 1, w - 2, 2, 'url(#dot50)') + rect(x + q(w * .43), y + 1, 7, h - 2, 'url(#dot12)') + scatter(78 + n, x + 2, y + 3, w - 4, h - 6, 70, W);
    });
    s += rect(322, 300, 8, 14, B) + outline(322, 300, 8, 14, 'url(#dot25)') + rect(325, 304, 1, 3) + rect(328, 304, 1, 3);
    return s;
  }
  function foreground(index) {
    let s = '';
    // The passage's extreme edges remain swallowed by black; a few irregular scratches emerge.
    s += scatter(157, 4, 195, 37, 245, 55, W) + scatter(392, 770, 146, 24, 294, 65, W);
    if (index >= 3) s += path('M46 381h4v-11h5v-6h11v5h5v15h-4v10H46Z', 'url(#dot12)');
    if (index >= 5) s += path('M716 370v-17h-6v-10h-7v-9h-6v-11h-5v-13h4v6h5v8h6v7h6v8h6v13h7v18Z', 'url(#dot25)');
    return s;
  }
  function sole() {
    return path('M3 0h6v2h2v8H9v3H1v-3H0V4h1V2h2Z', 'url(#dot25)') + rect(1, 15, 8, 4, 'url(#dot25)') + rect(2, 4, 6, 1, B) + rect(2, 8, 6, 1, B) + rect(3, 16, 4, 1, B);
  }
  function storyMotifs(prefix, index) {
    let s = '';
    // The same worn sole first marks the wet floor, then the ceiling overhead.
    s += `<g transform="translate(391 411) rotate(-12)">${sole()}</g><g transform="translate(441 427) rotate(9)">${sole()}</g>`;
    if (index >= 2) s += `<g transform="translate(333 3) rotate(10)">${sole()}</g>`;
    if (index >= 5) s += `<g transform="translate(363 6) rotate(-8)">${sole()}</g>`;
    // Flattened impact ripples become cracks below the marks, without an instructional symbol.
    if (index >= 3) {
      s += path('M321 32h4v-2h22v2h5v2h-5v-1h-21v1h-5Z M315 38h6v-2h30v2h7v2h-7v-1h-30v1h-6Z M310 46h7v-2h39v2h7v2h-7v-1h-39v1h-7Z', 'url(#dot25)');
      s += path('M341 49h2v16h-2v14h3v17h-2v19h-1V97h-3V79h2V64h1Z', 'url(#dot50)');
    }
    if (index >= 7) s += path('M357 37h5v-2h20v2h5v2h-5v-1h-20v1h-5Z M350 43h7v-2h30v2h8v2h-8v-1h-30v1h-7Z M373 47h2v19h-3v21h-3v20h2v24h-2v17h-1v-19h1v-20h-3V85h3V65h4Z', 'url(#dot25)');
    // Unanswered folded sheets accumulate at the threshold. They remain blank until inspected.
    const count = index < 2 ? 0 : Math.min(5, 1 + Math.floor((index - 2) / 2));
    const sheets = [[359, 390, -5], [523, 394, 7], [487, 407, -11], [369, 413, 4], [513, 422, -6]];
    for (let i = 0; i < count; i++) {
      const [x, y, angle] = sheets[i];
      s += `<g transform="translate(${x} ${y}) rotate(${angle})">${path('M0 0h16v4h5v10H0Z', B)}${path('M1 1h14v4h5v8H1Z', 'url(#dot50)')}${path('M15 1v5h5v1h-6V1Z', B)}${rect(3, 10, 13, 1, B)}</g>`;
    }
    // A coat loses its occupant's outline; only a single white flower remains on the empty chair.
    if (index < 5) {
      const fabric = index < 3 ? 'url(#dot25)' : 'url(#dot12)';
      s += path('M102 331h14v6h7v13h5v18h6v29h-35v-19h-5v-21h3v-14h5Z', fabric) + rect(113, 344, 1, 43, B) + rect(99, 395, 31, 1, B);
    } else {
      s += path('M111 395h2v-17h-1v-12h2v-9h1v10h-1v12h1v16Z', 'url(#dot50)');
      s += path('M110 350h4v-3h4v4h4v4h-4v4h-4v-3h-4Z') + rect(115, 352, 3, 3, B) + path('M113 376h-5v-3h4v-3h1Z', 'url(#dot50)');
    }
    // Two unnumbered faces: one intact, one cracked with its hands trapped against a fracture.
    for (let i = 0; i < 2; i++) {
      const x = 619 + i * 44, y = 51;
      s += `<g transform="translate(${x} ${y})">${path('M5 0h14v2h4v4h2v14h-2v4h-4v2H5v-2H1v-4h-2V6h2V2h4Z', B)}${path('M6 1h12v2h4v4h1v12h-1v4h-4v2H6v-2H2v-4H1V7h1V3h4Z', 'url(#dot25)')}${rect(5, 5, 15, 16, B)}${rect(11, 4, 1, 3)}${rect(11, 20, 1, 3, 'url(#dot50)')}${rect(3, 12, 3, 1, 'url(#dot50)')}${rect(19, 12, 3, 1, 'url(#dot50)')}${i === 0 ? rect(11, 7, 1, 7) + rect(11, 13, 6, 1) : rect(11, 10, 1, 5, 'url(#dot50)') + rect(7, 14, 5, 1, 'url(#dot50)') + path('M17 1h1v6h-3v5h2v5h-3v7h-1v-8h2v-3h-2V6h3Z', 'url(#dot50)')}</g>`;
    }
    return `<g id="${prefix}memory" shape-rendering="crispEdges">${s}</g>`;
  }
  function frame(type) {
    const rail = type === 'hinge' ? '' : rect(-163, -8, 327, 3, B) + rect(-163, -8, 327, 1, 'url(#dot25)') + rect(-162, -6, 323, 1, 'url(#dot50)') + rect(-143, -2, 6, 2, 'url(#dot25)') + rect(147, -2, 6, 2, 'url(#dot25)');
    return `<g transform="translate(736 96) scale(2)">${rect(0, 0, 164, 340, B)}${outline(0, 0, 164, 340, 'url(#dot50)')}${rect(2, 2, 3, 336, 'url(#dot25)')}${rect(159, 2, 3, 336, 'url(#dot25)')}${rect(2, 2, 160, 2)}${rail}</g>`;
  }
  function leaf(type, reverse) {
    const glass = type === 'frost' || type === 'cracked';
    // White institutional paint, black observation window, and irregular dried ink/stains.
    let s = rect(0, 0, 156, 332, B) + rect(3, 2, 150, 328) + rect(3, 2, 3, 328, 'url(#dot50)') + rect(150, 3, 3, 327, 'url(#dot25)');
    s += rect(11, 11, 134, 307, B) + rect(12, 12, 132, 305) + rect(14, 14, 2, 300, 'url(#dot50)');
    s += scatter(343, 14, 13, 128, 302, 380, B);
    s += rect(14, 241, 128, 1, B) + rect(17, 244, 122, 2, 'url(#dot25)');
    s += rect(24, 33, 104, 115, B) + outline(24, 33, 104, 115, 'url(#dot25)') + rect(27, 36, 98, 109, glass ? 'url(#dot25)' : B);
    s += rect(28, 37, 96, 1, 'url(#dot50)') + rect(28, 39, 1, 103, 'url(#dot25)');
    if (type === 'frost') s += rect(75, 35, 3, 111, B) + rect(27, 88, 99, 3, B) + scatter(415, 29, 40, 92, 102, 160, W);
    if (type === 'cracked') s += rect(27, 36, 98, 109, 'url(#dot50)') + path('M79 37v17h-4v13h-4v16h-5v13h5v14h-5v16h-3v18h-2v-20h3v-16h5V97h-6V82h5V67h4V53h4V37Z') + path('M69 80h14v4h11v7h13v2H92v-7H81v-4H69Z M66 101H51v5H39v6H28v-2h9v-6h12v-5h17Z');
    if (type === 'red') {
      for (let y = 43; y < 143; y += 9) s += rect(29, y, 94, 1, 'url(#dot25)');
      s += rect(73, 95, 11, 10, B) + outline(73, 95, 11, 10) + rect(76, 98, 5, 4) + rect(77, 99, 3, 2, B);
    }
    if (type === 'white') s += path('M5 30h3v34H6v16H3V53H1V29Z M9 95h3v28h-2v16H6v-23H4V94Z M4 174h5v28H7v20H3Z', B);
    // Localized chipped paint, not a rectangular field of television static.
    s += path('M12 287h3v7h4v9h3v7h10v3h12v4H12Z M144 277h-3v11h-3v10h-4v10h-7v6h-17v3h34Z', 'url(#dot25)');
    s += path('M15 214h2v18h2v27h-2v24h-1v-26h1v-23h-2Z M138 154h2v16h-1v23h-3v25h-1v-28h2v-20h1Z M24 15h3v14h-1v16h2v18h-2v17h-1V63h1V45h-2V29h1Z', B);
    s += rect(17, 308, 7, 1, B) + rect(134, 299, 5, 1, B) + rect(120, 314, 11, 1, B);
    for (const [x, h] of [[18, 27], [31, 16], [119, 41], [141, 54]]) s += rect(x, 11, 2, h, B) + rect(x + 2, 13, 1, h - 4, 'url(#dot25)');
    if (type !== 'broken') s += rect(132, 166, 16, 42, B) + outline(132, 166, 16, 42, 'url(#dot50)') + rect(136, 172, 8, 30, B) + rect(140, 178, 2, 16) + rect(138, 200, 5, 2, 'url(#dot25)');
    if (type === 'broken') {
      for (const y of [68, 158, 253]) {
        s += path(`M-2 ${y + 2}h14v-2h127v3h18v20h-12v3H8v-3H-2Z`, B) + rect(0, y + 3, 154, 19, 'url(#dot25)') + rect(3, y + 4, 147, 1);
        s += rect(8, y + 7, 3, 3) + rect(145, y + 13, 3, 3) + rect(16, y + 13, 31, 1, B) + rect(88, y + 8, 36, 1, B);
      }
    }
    return `<g transform="scale(2)"><g${reverse ? ' transform="translate(156 0) scale(-1 1)"' : ''}>${s}</g></g>`;
  }
  function fingers(g, prefix) {
    let s = '';
    const finger = path('M47 6H16v4H4v6H-6v10h-10v12h-12v10h-10v12h-6v10h8v-6h10v-8h12V46H-2v-8h12v-6h26v-8H16v-4h31Z') + path('M47 12H14v4H4v6H-6v10h-10v10h-12v8h8v-4h12V36H2v-8h12v-6h33Z', 'url(#dot25)');
    for (const [y, scale] of [[70, 1], [166, 1.1], [260, .9]]) s += `<g transform="translate(156 ${y}) scale(${scale})">${finger}</g>`;
    return `<g clip-path="url(#${prefix}opening)"><g id="${prefix}hands"><g transform="translate(${g.x} ${g.y}) scale(2)">${s}</g></g></g>`;
  }
  function propPoint(kind) {
    const props = { key: { x: 1204, y: 462 }, note: { x: 616, y: 490 }, lock: { x: 1024, y: 526 }, hinge: { x: 744, y: 346 }, code: { x: 616, y: 490 }, pick: { x: 1204, y: 596 }, club: { x: 1200, y: 662 } };
    if (!props[kind]) throw new Error('Unknown prop');
    return { ...props[kind] };
  }
  function lockHardware(prefix, rule) {
    if (rule.pick) return `<g id="${prefix}lock" shape-rendering="crispEdges"><g transform="translate(268 366) scale(2)">${rect(0, 0, 16, 48, B)}${outline(0, 0, 16, 48)}${rect(2, 2, 12, 44, 'url(#dot50)')}${rect(4, 4, 8, 40)}${rect(7, 7, 2, 2, B)}${path('M5 19h6v2h2v7h-3v10H6V28H3v-7h2Z', B)}${rect(7, 42, 2, 2, B)}${scatter(37, 4, 5, 8, 37, 19, B)}</g></g>`;
    let body = rect(0, 19, 27, 28, B) + outline(0, 19, 27, 28) + rect(2, 21, 23, 24, 'url(#dot50)') + rect(4, 23, 19, 20);
    if (rule.code) {
      for (let i = 0; i < 3; i++) body += rect(3 + i * 8, 26, 6, 14, B) + rect(4 + i * 8, 28, 4, 10) + rect(4 + i * 8, 32, 4, 2, B) + rect(4 + i * 8, 41, 4, 1, B);
    } else body += rect(11, 28, 5, 5, B) + rect(12, 32, 3, 7, B);
    return `<g id="${prefix}lock" shape-rendering="crispEdges"><g transform="translate(252 367) scale(2)">${path('M20 0h11v3h8v3h9v5h-3V8h-8V6h-9V3h-8Z')}${outline(22, 0, 10, 9)}${outline(32, 5, 10, 9)}${path('M4 19v-8h3V7h11v4h3v8h-4v-7h-2V10h-5v2H8v7Z')}${body}</g></g>`;
  }
  function memo(prefix, kind) {
    return `<g id="${prefix}${kind}Item" shape-rendering="crispEdges"><g transform="translate(592 464) scale(2)">${path('M0 2h18v5h6v17H0Z', B)}${path('M1 1h16v6h6v16H1Z')}${path('M17 1v7h6v2h-8V1Z', B)}${rect(3, 20, 16, 1, 'url(#dot25)')}${rect(3, 3, 1, 16, 'url(#dot25)')}${rect(7, 13, 1, 1, B)}${rect(14, 18, 1, 1, B)}</g></g>`;
  }
  function pickups(prefix, rule) {
    let s = '';
    if (rule.lock) s += `<g id="${prefix}keyItem" shape-rendering="crispEdges"><g transform="translate(1168 442) scale(2)">${path('M4 2h10v2h4v10h-4v2h-3v4h12v-4h4v4h5v-4h4v8H8v-8H4v-2H0V4h4Z')}${rect(5, 5, 8, 8, B)}${rect(3, 7, 2, 4, B)}${rect(13, 7, 2, 4, B)}${rect(11, 21, 21, 1, B)}</g></g>`;
    if (rule.lock || rule.hinge || rule.breakable) s += memo(prefix, 'note');
    if (rule.code) s += memo(prefix, 'code');
    if (rule.pick) s += `<g id="${prefix}pickItem" shape-rendering="crispEdges"><g transform="translate(1164 584) scale(2)">${path('M6 0h32v2H6V1H3v2H1v3h2v2h33v2H4V9H1V7H0V3h1V1h3V0Z')}${rect(10, 7, 2, 2, B)}${rect(17, 7, 2, 2, B)}${rect(24, 7, 2, 2, B)}${rect(31, 7, 2, 2, B)}${rect(37, 0, 2, 3)}</g></g>`;
    if (rule.breakable) s += `<g id="${prefix}clubItem" shape-rendering="crispEdges"><g transform="translate(1198 526) scale(2)">${path('M9 0h4v15h-1v28h-1v30h-1v29H8v7H3v3h-9v-2h-2v-5h3v-3H6V73h2V43h1V15H8V0Z', B)}${path('M10 1h2v14h-1v28h-1v30H9v30H7v4H3v3h-8v-2h-1v-3h3v-1h9V73h2V43h1V15H9V1Z')}${rect(9, 3, 3, 1, B)}${rect(9, 7, 3, 1, B)}${rect(9, 11, 3, 1, B)}${rect(-4, 106, 10, 2, 'url(#dot50)')}</g></g>`;
    return s;
  }
  function damage(prefix) {
    return `<g transform="scale(2)"><g id="${prefix}damage1" opacity="0">${path('M70 72h4v14h-5v11h-4v14h-3v-16h4V84h4Z M63 106h-7v4h-9v3h-7v-2h6v-3h8v-4h9Z', B)}</g><g id="${prefix}damage2" opacity="0">${path('M85 157h5v16h-6v12h4v16h-4v14h-3v-17h3v-11h-4v-15h5Z M83 180h-12v7H59v5H47v-3h10v-5h12v-7h14Z', B)}</g><g id="${prefix}damage3" opacity="0">${path('M55 67h24v-5h11v7h9v11h-5v10h8v14h-8v15h-7v11H72v-5H59v-10h-8v-14h5V88h-5V77h4Z M48 252h12v7h10v-7h13v10h12v14h-7v12h-9v11H64v-7H51v-12h-7v-17h4Z', B)}${scatter(832, 39, 68, 69, 221, 120, B)}${path('M70 345h14v4h5v13h-4v8h-5v9h13v7h8v13H48v-12h8v-8h13v-9h-5v-8h-4v-13h5v-4Z', 'url(#dot12)')}${path('M55 387v-18h3v-12h6v17h-4v13Z M97 387v-18h-3v-12h-6v17h4v13Z', 'url(#dot25)')}${rect(53, 380, 44, 1, B)}${rect(46, 390, 57, 2, B)}</g></g>`;
  }
  function hingeHardware(prefix) {
    let s = '';
    for (const y of [215, 359, 651]) s += `<g transform="translate(728 ${y}) scale(2)">${rect(0, 0, 14, 27, B)}${outline(0, 0, 14, 27, 'url(#dot50)')}${rect(6, 0, 3, 27)}${rect(3, 4, 1, 2)}${rect(10, 4, 1, 2)}${rect(3, 21, 1, 2)}${rect(10, 21, 1, 2)}</g>`;
    s += `<g id="${prefix}hingePin" shape-rendering="crispEdges"><g transform="translate(734 337) scale(2)">${path('M1 0h8v2h1v3H7v28H3V5H0V2h1Z', B)}${path('M2 1h6v2h1v1H6v27H4V4H1V3h1Z')}${rect(5, 6, 1, 24, B)}${rect(2, 2, 6, 1, 'url(#dot50)')}</g></g>`;
    return s;
  }
  function room(prefix, index, portal = true) {
    const rooms = root.DoorLoop.ROOMS, dawn = index >= rooms.length;
    const r = rooms[Math.min(index, rooms.length - 1)], g = layout(r.door), reverse = r.direction === 1;
    if (dawn) return `<g id="${prefix}room" data-room-index="${index}" shape-rendering="crispEdges"><g transform="scale(4)">${rect(0, 0, 400, 225, W)}${path('M0 0L79 22V187L0 225Z', 'url(#dot75)')}${path('M324 22L400 0V225L324 187Z', 'url(#dot75)')}${pixelLine(0, 225, 79, 187, B)}${pixelLine(324, 187, 400, 225, B)}${rect(186, 26, 78, 166, B)}${rect(188, 28, 74, 164, W)}${rect(104, 135, 49, 48, 'url(#dot75)')}</g></g>`;
    const next = Math.min(index + 1, rooms.length), initial = r.hands ? .2 : 0;
    const entry = portal ? `<g id="${prefix}portal" transform="translate(${(g.x + g.w / 2) * .5} ${g.y + g.h / 2 - 225}) scale(.5)">${room(prefix + 'b', next, false)}</g>` : `<g transform="translate(${g.x} ${g.y}) scale(.36 .74)"><g transform="translate(-350 0) scale(2)">${wall(Math.min(next, 6))}${rect(372, 52, 156, 332, B)}${outline(372, 52, 156, 332)}</g></g>`;
    const glassClip = `<clipPath id="${prefix}glass"><rect x="54" y="72" width="196" height="218"/></clipPath>`;
    return `<g id="${prefix}room" data-room-index="${index}" shape-rendering="crispEdges">
      <defs><clipPath id="${prefix}opening"><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}"/></clipPath>${glassClip}</defs>
      <g transform="scale(2)">${wall(index)}${picture(index)}${furniture(index)}</g>
      ${frame(r.door)}<g clip-path="url(#${prefix}opening)">${rect(g.x, g.y, g.w, g.h, B)}${entry}<g id="${prefix}presence" visibility="hidden"></g></g>
      <g id="${prefix}leaf" transform="${pose(r.door, initial, reverse)}">${leaf(r.door, reverse)}${r.lock || r.code || r.pick ? lockHardware(prefix, r) : ''}${r.breakable ? damage(prefix) : ''}${r.fragile && r.door !== 'cracked' ? `<g transform="scale(2)">${path('M94 37v18h-4v16h-6v15h-5v17h3v17h-5v24h2v-21h5v-21h-3V88h5V72h6V57h4V37Z')}${path('M84 81h12v5h12v7h16v2h-18v-7H94v-5H84Z')}</g>` : ''}${r.watch ? `<g clip-path="url(#${prefix}glass)">${silhouette(prefix + 'shadow')}</g>` : ''}</g>
      ${r.hands ? fingers(g, prefix) : ''}${r.hinge ? hingeHardware(prefix) : ''}${pickups(prefix, r)}<g id="${prefix}signalFloor" opacity="0" shape-rendering="crispEdges">${path('M855 786h14v4h8v12h-7v4h-15v-5h-5v-10h5Z', 'url(#dot25)')}${path('M913 813h15v4h6v14h-6v4h-15v-5h-5v-12h5Z', 'url(#dot25)')}</g><g transform="scale(2)">${foreground(index)}${storyMotifs(prefix, index)}</g>
      <rect id="${prefix}lampFlicker" width="1600" height="900" fill="#000" opacity="0"/>
    </g>`;
  }
  function grip(id) {
    // Anchor at the moving leaf's exposed edge, near handle height; fingers reach left.
    return `<g id="${id}" shape-rendering="crispEdges"><g transform="scale(2)">${path('M54-43H13v4H0v5H-9v7H-17v7H-25v8H-34v7H-42v7h7v-3h9v-5h10v-6h11v-7H8v-5h13v-4h33Z')}${path('M60-14H20v4H8v6H-4v6H-14v7H-26v8h-9v8h8v-4h11v-6H-4v-6H9V3h16v-5h35Z')}${path('M59 16H27v4H14v6H2v7H-9v8h-9v8h8v-4H1v-7h13v-6h14v-4h31Z')}${path('M56 42H36v5H24v6H13v8H4v7h8v-3h12v-6h13v-5h19Z')}${scatter(983, -18, -30, 75, 94, 125, B)}${rect(13, -39, 23, 1, 'url(#dot25)')}${rect(18, -9, 28, 1, B)}${rect(28, 22, 23, 1, B)}</g></g>`;
  }
  function lens() {
    return `<g shape-rendering="crispEdges"><rect x="-2000" y="-1500" width="5600" height="3900" fill="#000"/><g transform="translate(456 106) scale(4)">${path('M43 0h86v4h12v5h10v8h8v10h5v12h4v94h-4v12h-5v10h-8v8h-10v5h-12v4H43v-4H31v-5H21v-8h-8v-10H8v-12H4V39h4V27h5V17h8V9h10V4h12Z')}${path('M44 4h84v4h12v5h9v7h7v10h5v12h3v88h-3v12h-5v10h-7v7h-9v5h-12v4H44v-4H32v-5H23v-7h-7v-10h-5v-12H8V42h3V30h5V20h7v-7h9V8h12Z', 'url(#dot25)')}</g></g>`;
  }
  function memoryPhoto(page) {
    // Ordinary snapshots. Only the familiar room and everyday objects connect them to the corridor.
    let image = rect(0, 0, 102, 96, B) + rect(1, 1, 100, 78, 'url(#dot25)');
    image += rect(7, 18, 33, 28, B) + outline(7, 18, 33, 28, 'url(#dot50)') + rect(9, 20, 29, 24, B) + rect(24, 20, 1, 24, 'url(#dot25)') + rect(8, 45, 32, 2, 'url(#dot50)');
    image += rect(68, 17, 28, 71, B) + outline(68, 17, 28, 71, 'url(#dot50)') + rect(71, 20, 22, 67, 'url(#dot75)') + rect(75, 25, 13, 22, B) + rect(90, 53, 1, 10, B);
    image += rect(1, 64, 66, 1, 'url(#dot50)') + rect(1, 79, 100, 1, 'url(#dot50)') + pixelLine(0, 95, 25, 80, 'url(#dot25)') + pixelLine(101, 95, 81, 80, 'url(#dot25)') + rect(0, 92, 102, 1, 'url(#dot12)');
    function head(x, y, side = 1) {
      return `<g transform="translate(${x} ${y})">${path('M2 0h6v2h2v6H8v3H2V8H0V2h2Z')}${rect(2, 0, 6, 2, B)}${rect(side === 1 ? 7 : 2, 5, 1, 1, B)}${rect(3, 10, 4, 3, 'url(#dot50)')}</g>`;
    }
    if (page === 2) {
      // Balloons, raised glasses and a perfectly ordinary floor-standing speaker.
      image += path('M4 3h7v2h2v7h-2v3H7v3H6v-3H3v-3H1V5h3Z', 'url(#dot75)') + rect(6, 17, 1, 14, 'url(#dot50)');
      image += path('M87 1h7v2h2v7h-2v3h-3v3h-1v-3h-3v-3h-2V3h2Z', 'url(#dot75)') + rect(90, 15, 1, 14, 'url(#dot50)');
      image += pixelLine(14, 4, 84, 9, 'url(#dot50)') + path('M23 5h5v7h-1v-1h-1v-1h-1V9h-1V8h-1Z M42 7h5v7h-1v-1h-1v-1h-1v-1h-1v-1h-1Z M63 8h5v7h-1v-1h-1v-1h-1v-1h-1v-1h-1Z', 'url(#dot75)');
      image += rect(8, 55, 17, 39, B) + outline(8, 55, 17, 39, 'url(#dot50)') + rect(10, 57, 13, 35, 'url(#dot12)');
      image += path('M14 62h5v1h2v2h1v5h-1v2h-2v1h-5v-1h-2v-2h-1v-5h1v-2h2Z', 'url(#dot50)') + rect(15, 65, 3, 5, B);
      image += path('M13 77h7v2h2v9h-2v2h-7v-2h-2v-9h2Z', 'url(#dot50)') + rect(14, 81, 5, 5, B);
      image += head(35, 33) + head(56, 34, -1);
      image += path('M34 47h13v5h3v22H33V59h-4V45h-4V34h3v8h6Z', W) + rect(35, 50, 10, 21, 'url(#dot50)');
      image += path('M57 48h11v7h4v17H55V55h-5V43h-4V32h3v8h5v8Z', 'url(#dot75)');
      image += path('M34 73h6v14h6v5H33v-5h2V77h-1Z M42 73h6v11h5v5h-8V77h-3Z M57 72h5v16h-2v5h-8v-4h5Z M64 72h6v12h6v7h-8v-4h-2V77h-2Z', B);
      image += rect(34, 88, 10, 2, 'url(#dot50)') + rect(56, 89, 4, 1, W) + rect(68, 88, 6, 1, 'url(#dot50)');
      image += path('M23 28h6v5h-2v3h-2v-3h-2Z M44 26h6v5h-2v3h-2v-3h-2Z', W) + rect(24, 29, 4, 2, 'url(#dot25)') + rect(45, 27, 4, 2, 'url(#dot25)');
    } else if (page === 6) {
      // An unnumbered clock, dark window, and someone shifting a chair across the room.
      image += path('M51 2h9v2h3v3h2v10h-2v3h-3v2h-9v-2h-3v-3h-2V7h2V4h3Z', B) + path('M52 4h7v2h3v11h-3v3h-7v-3h-3V6h3Z', 'url(#dot75)');
      image += rect(55, 6, 1, 7, B) + pixelLine(56, 12, 60, 9, B) + rect(16, 23, 5, 1, 'url(#dot25)') + rect(15, 24, 3, 3, 'url(#dot25)');
      image += head(29, 34);
      image += path('M29 47h10v4h7v5h10v4h-2v3H43v-4h-6v8H26V55h3Z', 'url(#dot75)') + rect(30, 51, 6, 14, 'url(#dot50)');
      image += path('M28 65h7v10h-5v15h-8v-4h3V74h3Z M36 65h5v12h5v12h-7V78h-3Z', B) + rect(23, 88, 7, 2, 'url(#dot50)') + rect(40, 87, 6, 2, 'url(#dot50)');
      image += path('M52 50h18v2h3v23h-3v14h-3V76H55v13h-3V75h-3V52h3Z', B) + rect(52, 51, 18, 2, W) + rect(51, 54, 1, 17, 'url(#dot50)') + rect(51, 72, 20, 2, W) + rect(53, 75, 1, 13, 'url(#dot50)') + rect(68, 75, 1, 13, 'url(#dot50)');
      image += rect(82, 75, 18, 20, B) + outline(82, 75, 18, 20, 'url(#dot50)') + rect(90, 76, 2, 18, 'url(#dot25)');
    } else if (page === 9) {
      // Indoor golf practice; the club has the same narrow grip, shaft and bent head as the pickup.
      image += rect(61, 83, 35, 10, 'url(#dot12)') + outline(61, 83, 35, 10, 'url(#dot25)') + rect(84, 86, 2, 2, W);
      image += head(43, 31, -1) + path('M42 44h12v5h5v14H40V52h-7v-5h4v2h5Z', 'url(#dot75)') + rect(44, 48, 8, 14, 'url(#dot50)');
      image += path('M41 62h6v12h-5v10h-6v8H27v-4h7v-7h4V70h3Z M49 62h6v10h4v11h5v8h-9v-8h-3V73h-3Z', B) + rect(29, 89, 7, 2, 'url(#dot50)') + rect(56, 89, 7, 2, 'url(#dot50)');
      image += path('M36 47v-6h5v5h5v4h-5v-3Z', W) + pixelLine(39, 42, 61, 10, W) + pixelLine(40, 42, 62, 10, 'url(#dot50)');
      image += path('M60 6h2v4h4v2h9v-4h-2V6Z', W) + rect(64, 9, 9, 1, 'url(#dot25)');
      image += rect(8, 71, 18, 2, 'url(#dot25)') + rect(10, 73, 1, 17, 'url(#dot25)') + rect(23, 73, 1, 17, 'url(#dot25)');
    }
    // Slight physical wear belongs to the print, not a supernatural event in the pictured scene.
    image += scatter(127, 2, 2, 97, 91, 95, B);
    return `<g shape-rendering="crispEdges">${rect(0, 0, 112, 108, B)}${path('M3 1h103v2h5v99h-3v5H4v-3H1V5h2Z')}${rect(4, 5, 104, 98, B)}<g transform="translate(5 6)">${image}</g>${path('M1 13h4v3H2v5H0V11h1Z M108 34h4v9h-2v-5h-2Z M3 83h3v6H4v9H1v-5h2Z M105 101h6v4h-3v3h-6v-3h3Z', B)}${rect(9, 2, 17, 1, B)}${rect(79, 104, 18, 1, B)}${rect(110, 62, 2, 9, B)}</g>`;
  }
  root.LoopArt = Object.freeze({ DOORS, PLATES, room, defs, point, layout, pose, hand, silhouette, lens, grip, propPoint, memoryPhoto });
  if (typeof module !== 'undefined') module.exports = root.LoopArt;
})(typeof window === 'undefined' ? globalThis : window);
