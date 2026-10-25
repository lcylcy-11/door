// Korean text and the "twins" table: every sound the rules emit has a caption (with a location
// tag) and a named visual twin, so the night stays readable with the sound off.
(function (root) {
  'use strict';
  // event type -> { sound: [file, gain, rate, delays...] or synth key, loc, text, visual }
  const EVENTS = {
    'front-door': { sound: ['latch-click', .35, .8], loc: '현관 쪽', text: '철컥. …혼자 사는데.', visual: 'caption' },
    'bolt-free': { sound: ['latch-click', .25, 1.2], loc: '중문', text: '걸쇠가 빠졌다.', visual: 'bolt' },
    'detent': { sound: ['latch-click', .2, 1.5], loc: '걸쇠', text: '툭 — 걸림쇠.', visual: 'bolt' },
    'latch-rattle': { sound: ['latch-rattle', .65, 1], loc: '걸쇠', text: '덜그럭 — 너무 빨랐다.', visual: 'bolt-shake' },
    'bolt-kicked': { sound: ['latch-rattle', .4, 1.1], loc: '걸쇠', text: '노크에 걸쇠가 튀어 올랐다.', visual: 'bolt-shake' },
    'rail-stop': { sound: ['latch-rattle', .25, 1.3], loc: '걸쇠', text: '레일에 걸린다 — 문이 덜 닫혔다.', visual: 'bolt' },
    'latch-click': { sound: ['latch-click', .65, 1], loc: '걸쇠', text: '딸깍.', visual: 'bolt' },
    'stiff-first': { sound: ['door-scrape', .3, .9], loc: '문', text: '끼… 레일이 뻑뻑하다. 이 구간은 소리가 난다.', visual: 'scuff' },
    'scrape': { loc: '문', text: '끼익— 문이 긁힌다 (소리).', visual: 'scuff' },
    'lit-too-shut': { loc: '방 안', text: '불빛이 닫힌 문에 막힌다 — 문을 열어 둔 채 켜야 복도가 보인다.', visual: 'caption' },
    'stiff-enter': { loc: '문', text: '뻑뻑한 구간 — 바깥 소리가 덮을 때만 미세요.', visual: 'scuff' },
    'mask-start': { visual: 'sound-strip' },
    'cover-on': { visual: 'handle-glow' },
    'cover-ending': { loc: '복도 밖', text: '곧 멎는다 — 멈출 준비.', visual: 'sound-strip-blink' },
    'cover-off': { visual: 'sound-strip' },
    'warning': { sound: 'knock3', loc: '아래층', text: '쿵. 쿵. 쿵. — 소리 내지 마세요 (긁힘·스위치·슬리퍼·걸쇠).', visual: 'knock-glyph' },
    'slam': { sound: ['knock-wood', .75, .62], loc: '문', text: '쾅! 문이 튕겨 살짝 벌어졌다.', visual: 'shake' },
    'flush': { sound: ['knock-wood', .18, 1.5], loc: '문', text: '톡 — 문이 맞물렸다.', visual: 'door' },
    'tube-flicker': { sound: 'flicker', loc: '복도', text: '형광등이 깜박인다…', visual: 'corridor' },
    'tube-dead': { loc: '복도', text: '복도 불이 나갔다. 현관이 열렸는지 — 보이지 않는다.', visual: 'corridor' },
    'light-on': { sound: ['switch-click', .65, 1], loc: '방 안', text: '딸깍 — 불이 켜졌다. 문틈으로 빛이 샌다.', visual: 'plate-lit' },
    'light-off': { sound: ['switch-click', .6, .95], loc: '방 안', text: '딸깍 — 불을 껐다.', visual: 'plate-dark' },
    'covered': { loc: '복도 밖', text: '바깥 소리에 묻혔다.', visual: 'sound-strip' },
    'confirm': { loc: '현관', text: '반쯤 열려 있다.', visual: 'ajar-strip' },
    'hush': { sound: 'hush', loc: '방 안', text: '…TV 소리가 뚝 끊겼다.', visual: 'caption' },
    'unhush': { loc: '아래층', text: 'TV 소리가 돌아왔다.', visual: 'caption' },
    'glass-knock': { sound: ['knock-wood', .8, 1.15], loc: '문 유리', text: '똑.', visual: 'knock-glyph-glass' },
    'not-downstairs': { loc: '문 유리', text: '…아래층이 아니었습니다.', visual: 'caption' },
    'scratch': { sound: 'scratch', loc: '문틈', text: '손톱이 나무를 긁는다. 손끝이 틈으로 들어온다.', visual: 'hand' },
    'grip-on': { sound: ['knock-wood', .24, 1.5], loc: '문틈', text: '손이 문 가장자리를 붙잡았다.', visual: 'hand-grip' },
    'inhale': { sound: 'inhale', loc: '문틈', text: '손가락이 굳는다.', visual: 'hand-grip' },
    'shove-hand': { sound: 'shove', loc: '문틈', text: '손이 문을 밀어 벌린다.', visual: 'hand-grip' },
    'wood-release': { loc: '문틈', text: '손의 힘이 잠깐 느슨해졌다.', visual: 'hand-grip' },
    'push-defended': { sound: 'slip', loc: '문틈', text: '버텼다.', visual: 'force-panel' },
    'strain-warning': { sound: ['knock-wood', .8, .76], loc: '문', text: '문이 운다 — 힘을 빼세요.', visual: 'force-panel' },
    'hand-retreat': { sound: 'retreat', loc: '문틈', text: '붙잡던 손가락이 하나씩 미끄러진다.', visual: 'hand-grip' },
    'hand-free': { loc: '문틈', text: '손이 빠졌다.', visual: 'hand' },
    'breath': { sound: ['breath-near', .65, 1], loc: '문틈 위', text: '…숨소리.', visual: 'floor-shadow' },
    'eyes-open': { loc: '문틈 위', text: '무언가가 틈으로 들여다본다.', visual: 'eyes' },
    'eyes-warning': { sound: ['breath-near', .5, 1.15], loc: '문틈 위', text: '눈이 마주치려 한다 — 시선을 내려!', visual: 'brow' },
    'eyes-chord-hint': { loc: '문틈 위', text: '…시선을 내린 채 손잡이를 잡아 보세요.', visual: 'caption' },
    'eyes-withdraw': { loc: '문틈', text: '숨소리가 멀어진다.', visual: 'eyes' },
    'eyes-gone': { visual: 'eyes' },
    'fingers': { sound: ['door-scrape', .25, 1.4], loc: '문 가장자리', text: '손가락 네 개가 문을 쥐었다.', visual: 'fingers' },
    'mimic-arrive': { loc: '문 가장자리', text: '문이 닫히지 않는다 — 손가락이 쥐고 있다.', visual: 'fingers' },
    'mimic-watch': { visual: 'fingers' },
    'mimic-delay': { sound: 'tense', loc: '문 가장자리', text: '손가락에 힘이 들어간다 — 따라 하려 한다.', visual: 'fingers-tense' },
    'mimic-response': { loc: '문 너머', text: '끼익— 똑같이 문을 당긴다.', visual: 'fingers-off' },
    'mimic-recover': { loc: '문 가장자리', text: '손가락이 다시 가장자리를 쥔다.', visual: 'fingers' },
    'mimic-grab': { visual: 'fingers' },
    'mimic-yank': { sound: ['knock-wood', .7, .7], loc: '문', text: '콰득 — 확 잡아당겼다.', visual: 'shake' },
    'mimic-out': { visual: 'fingers' },
    'pinch-warning': { sound: ['door-scrape', .3, 1.45], loc: '문 가장자리', text: '손가락이 끼인다 — 멈추세요!', visual: 'fingers-pinch' },
    'loiter-tap': { sound: ['knock-wood', .3, 1.3], loc: '문 유리', text: '톡.', visual: 'knock-glyph-glass' },
    'bait-large': { loc: '문', text: '너무 크게 열었다.', visual: 'caption' },
    'palm': { sound: ['knock-wood', .2, .55], loc: '문 유리', text: '불빛에 — 유리 위로 손바닥이 미끄러진다.', visual: 'palm' },
    'fingers-out': { sound: 'retreat', loc: '문 가장자리', text: '손가락이 가장자리에서 미끄러져 빠져나간다.', visual: 'fingers' },
    'rear-creak': { sound: ['rear-floor-creak', .65, 1], loc: '등 뒤', text: '바닥이 삐걱인다.', visual: 'rear-vignette' },
    'drawer-start': { sound: ['drawer-slide', .35, 1], loc: '등 뒤 · 서랍', text: '끌리는 소리…', visual: 'rear-vignette' },
    'drawer-stop': { loc: '서랍', text: '멎었다.', visual: 'drawer' },
    'drawer-resume': { loc: '등 뒤 · 서랍', text: '다시 — 끌리는 소리.', visual: 'rear-vignette' },
    'drawer-slide': { sound: ['drawer-slide', .65, 1], loc: '등 뒤 · 서랍', text: '서랍이 크게 열린다 — 손가락이…!', visual: 'rear-vignette' },
    'drawer-shut': { sound: ['drawer-thud', .65, 1], loc: '서랍', text: '탁 — 도로 닫혔다.', visual: 'drawer' },
    'turn': { visual: 'view' },
    'shoves-start': { sound: ['knock-wood', .6, .7], loc: '문', text: '쿵 — 저쪽에서 문을 민다.', visual: 'shake' },
    'shove-inhale': { sound: 'inhale', loc: '문 너머', text: '숨을 들이쉰다 — 민다!', visual: 'handle-pulse' },
    'shove': { sound: 'shoveHit', loc: '문', text: '쿵.', visual: 'shake' },
    'wedge-inserting': { sound: ['wedge-in', .65, 1], loc: '문 밑', text: '슬리퍼를 문 밑으로 민다…', visual: 'slipper' },
    'wedge-in': { loc: '문 밑', text: '슬리퍼가 박혔다. 손을 놓아도 버틴다 — 대신 문은 닫히지 않는다.', visual: 'slipper' },
    'wedge-removing': { sound: ['wedge-out', .65, 1], loc: '문 밑', text: '슬리퍼를 빼낸다…', visual: 'slipper' },
    'wedge-out': { loc: '문 밑', text: '슬리퍼를 뺐다.', visual: 'slipper' },
    'wedge-slip': { sound: 'wedgeSlip', loc: '문 밑', text: '끽 — 슬리퍼가 밀렸다.', visual: 'slipper-pose' },
    'wedge-pop': { sound: ['wedge-slip', .85, .9], loc: '문 밑', text: '슬리퍼가 튕겨 나갔다!', visual: 'slipper' },
    'wedge-refused': { loc: '문 밑', text: '지금은 끼울 수 없다.', visual: 'caption' },
    'wedge-hint': { loc: '문', text: '손을 놓으려면 — 밀고 난 직후 슬리퍼를 문 밑에 끼우세요 (클릭 · W).', visual: 'slipper-cue' },
    'shoves-stop': { sound: 'retreat', loc: '문 너머', text: '…길게 내쉬는 숨. 밀던 힘이 멎었다.', visual: 'caption' },
    'slipper-worn': { loc: '방 안', text: '슬리퍼를 다시 신었다.', visual: 'slipper' },
    'close-and-lock': { loc: '중문', text: '이제 — 끝까지 닫고 걸쇠를.', visual: 'bolt-cue' },
    'pull-inhale': { sound: ['breath-near', .7, .85], loc: '문 너머', text: '깊게 들이쉬는 숨.', visual: 'caption' },
    'pull': { sound: 'pull', loc: '문', text: '콰앙— 문이 확 열렸다.', visual: 'shake' },
    'seat': { sound: ['knock-wood', .4, 1.4], loc: '문', text: '탁 — 처음으로 끝까지 맞물렸다.', visual: 'door' },
    'checklist': { loc: '중문', text: '걸쇠를 ↓ 천천히 — 노크와 노크 사이에.', visual: 'checklist' },
    'soft-knock': { sound: ['knock-wood', .35, 1.25], loc: '문 유리', text: '톡.', visual: 'rhythm-dots' },
    'palm-slap': { sound: ['knock-wood', .85, 1.3], loc: '문 유리', text: '쾅! — 불빛 속, 유리에 손바닥.', visual: 'palm' },
    'sting': { sound: 'sting', loc: '등 뒤', text: '스르륵— 탁.', visual: 'caption' },
    'lose': { sound: 'lose', visual: 'end' }
  };
  const ENDINGS = {
    noise: { title: ['아랫집이 올라왔다.', '들켰다.'], lesson: {
      scrape: '뻑뻑한 구간은 바깥 소리가 덮을 때만 미세요. 소리가 줄면 멈추세요.',
      slam: '끝에 닿기 전에 속도를 줄이세요. 문이 튕기면 소리가 납니다.',
      light: '불을 켠 채 문을 열어 두면 빛이 샙니다. 볼 것을 봤으면 끄세요.',
      rattle: '걸쇠는 천천히. 걸림쇠(툭)에서 잠깐 멈췄다가 ↓ 내리세요 — 노크와 노크 사이에.',
      rattleUp: '걸쇠는 천천히. 걸림쇠(툭)에서 잠깐 멈췄다가 다시 ↑ 올리세요.',
      switch: '스위치 딸깍도 들립니다. 바깥 소리가 덮을 때 켜세요.',
      wedge: '슬리퍼를 끼우고 빼는 소리도 쌓입니다.' }, hint: '소리 막대가 선을 넘을 때만 소리 나는 일을 하세요.' },
    hand: { title: '문이 밀려 열렸다.', lesson: '손이 밀어 오면 잡은 채 → 버티고, 느슨해지면 ← 힘을 빼세요.', hint: '두 번 버틴 뒤 힘을 빼고 기다리면 손이 빠집니다.',
      timeoutTitle: '손이 물러나지 않았다.', timeoutLesson: '밀쳐올 때 → 세게(막대 오른쪽 칸) 버티세요. 두 번 버틴 뒤, 느슨해지면 ← 힘을 빼고 왼쪽 칸에서 기다리세요.' },
    strain: { title: '그 소리를 들었다.', lesson: '손이 느슨할 때도 세게 밀면 문이 웁니다. 잡은 채 ← 힘을 빼세요.', hint: '막대의 네모 칸 안에 힘을 맞추세요.' },
    eyes: { title: '눈이 마주쳤다.', lesson: '숨소리가 들리면 오른쪽 버튼을 누른 채 시선을 내리세요.', lessonToggle: '숨소리가 들리면 S 또는 「시선 ↓」로 시선을 내리세요.', hint: '시선을 내린 채로도 손잡이를 잡을 수 있습니다. 「시선 ↓」 버튼이나 S 키로 전환해도 됩니다.' },
    mimic: { title: '문이 확 당겨졌다.', lesson: '← 살짝 열고 멈추세요. 손가락이 따라 당기는 동안에만 → 닫으세요.', hint: '손가락이 가장자리를 쥐고 있을 때 닫으면 끼어서 잡아당깁니다.' },
    drawer: { title: '서랍이 끝까지 열렸다.', lesson: '등 뒤에서 끌리는 소리가 나면 손잡이를 놓고 뒤를 보세요.', hint: '문이 밀리는 중이면 슬리퍼를 먼저 끼우고 돌아보세요.' },
    forced: { title: '아무도 문을 잡고 있지 않았다.', lesson: '숨을 들이쉬면 손잡이를 잡으세요. 손을 놓으려면 슬리퍼를 먼저 끼우세요.', hint: '경고(2/3)가 나면 돌아와 손잡이를 잡아 슬리퍼를 다시 눌러 끼우세요.' }
  };
  // Caption priority (higher shows first; equal or higher lines are kept while one is showing).
  const PRIORITY = { hush: 1, unhush: 1, covered: 1, 'cover-on': 1, 'cover-off': 1, 'mask-start': 1, 'cover-ending': 2, scrape: 2, detent: 2, 'drawer-stop': 2, 'mimic-recover': 2, inhale: 1, 'shove-hand': 1, 'wood-release': 1, 'shove-inhale': 2, 'drawer-resume': 2,
    'not-downstairs': 4, warning: 4, 'eyes-warning': 4, 'pinch-warning': 4, 'strain-warning': 4, 'wedge-hint': 3, 'eyes-chord-hint': 3, 'push-defended': 3, 'wedge-slip': 3, 'wedge-pop': 4,
    'mimic-yank': 4, 'confirm': 3, 'checklist': 3, 'pull': 4, 'fingers': 3, 'lit-too-shut': 3, 'wedge-refused': 3, 'latch-rattle': 3, 'slam': 3 };
  const WIN = { title: '이제 좀 조용하네.', copy: '중문은 잠겼습니다.\n등 뒤에서 서랍이 닫히는 소리가 났습니다.\n당신은 서랍을 연 적이 없습니다.' };

  // The steady three-row line (location / subtitle / instruction) for the current state.
  function line(s, gazeMode) {
    const down = gazeMode === 'toggle' ? 'S 또는 「시선 ↓」로 시선을 내리세요' : '오른쪽 버튼을 누른 채 시선을 내리세요';
    const up = gazeMode === 'toggle' ? '먼저 시선을 올리세요 (S 또는 「시선 ↓」 다시).' : '먼저 시선을 올리세요 (오른쪽 버튼 떼기).';
    const needsFront = (s.drawer === 'open' && !s.wantRear) || (s.beat === 'C2' && s.corridor === 'dead' && !s.confirmRoute);
    if (s.gazeDown && needsFront && !s.hand) return [s.drawer === 'open' ? '등 뒤' : '복도', s.drawer === 'open' ? '등 뒤에서 끌리는 소리.' : '복도 불이 나갔다.', up];
    if (s.hand) {
      if (s.handStage === 'approach') return ['문틈', '손끝이 틈으로 들어온다.', '손잡이를 잡고, → 밀 준비를 하세요.'];
      if (s.handStage === 'retreat') return ['문틈', '붙잡던 손가락이 하나씩 미끄러진다.', '힘을 풀어도 됩니다.'];
      if (s.strain > .5) return ['문', '문이 운다.', '잡은 채 ← 힘을 줄이세요. 놓지는 마세요.'];
      if (!s.held) return ['문틈', '손이 문을 붙잡고 있다.', '손잡이를 잡으세요!'];
      if (s.gripStage === 'push') return ['문틈', '손이 문을 밀어 벌린다.', '→ 더 밀어 버티세요.'];
      if (s.gripStage === 'ease') return ['문틈', '손의 힘이 잠깐 느슨해졌다.', '잡은 채 ← 조금. 문이 울지 않게.'];
      return ['문틈', '손가락이 굳는다. 다시 밀쳐오려 한다.', '→ 힘을 실을 준비.'];
    }
    switch (s.beat) {
      case 'P0': return Math.abs(s.b - .8) < 1e-3 ? ['걸쇠', '툭 — 걸림쇠에 걸렸다.', '잠깐 멈췄다가 다시 ↑ 천천히.'] : ['중문', '02:17. 중문은 걸쇠로 잠겨 있다.', '걸쇠를 누른 채 ↑ 천천히 들어 올리세요.'];
      case 'C1': case 'C2':
        if (s.beat === 'C2' && s.corridor === 'dead' && !s.confirmRoute) return s.adapt > .5 && !s.light ? ['복도', '어둠에 눈이 익는다…', '움직이지 말고 기다리세요.'] : ['복도', '복도 불이 나갔다. 현관이 열렸는지 보이지 않는다.', '가만히 눈을 익히거나, 손을 놓고 왼쪽 벽 스위치를 켜세요 (클릭 · L).'];
        if (s.beat === 'C2' && s.confirmRoute) return s.light ? ['현관', '현관문이 반쯤 열려 있다.', '볼 것은 봤다 — 불을 끄세요 (스위치 · L). 켜 두면 빛이 새어 기척이 쌓인다.'] : ['현관', '현관문이 반쯤 열려 있다.', '…'];
        if (s.band === 'stiff') {
          if (s.covered) return s.preWarn ? ['복도 밖', '바깥 소리가 곧 멎는다.', '멈출 준비.'] : ['복도 밖', '바깥 소리가 문 소리를 덮는다 (소리만).', '지금 — 천천히 ← 여세요.'];
          return ['문', '레일이 뻑뻑하다. 여기서는 문이 긁힌다.', '바깥 소리가 덮을 때까지 멈추세요.'];
        }
        return ['방 안', '아래층에서 TV 소리가 희미하게 들린다.', '손잡이를 누른 채 ← 천천히 여세요.'];
      case 'C3': return s.light ? ['방 안', '불이 켜져 있다 — 문틈으로 빛이 샌다.', '불을 끄세요 (스위치 · L).'] : ['문 유리', '…', '움직이지 마세요.'];
      case 'C4': return s.eyes === 'none' ? ['방 안', '…TV 소리가 다시 끊겼다.', '…'] : s.gazeDown ? ['문틈 위', '보지 않고 있다. 숨소리만 들린다.', s.held ? '그대로. 시선을 내린 채로.' : '시선을 내린 채 손잡이를 잡아 보세요.'] : ['문틈 위', '…숨소리. 틈 위쪽에서.', `보지 마 — ${down}.`];
      case 'C5':
        if (s.mimic === 'none') return ['방 안', '…', '…'];
        if (s.mimic === 'arrive') return ['문 가장자리', '손가락 네 개가 문을 쥐고 있다.', '닫히지 않는다. 기다리세요.'];
        if (s.mimic === 'watch') return s.band === 'stiff' && !s.covered ? ['문 가장자리', '저것은 당신을 따라 한다. 여기서는 문이 긁힌다.', '바깥 소리가 덮을 때 ← 살짝 열고 멈추세요.'] : s.covered ? ['복도 밖', '엘리베이터가 긁힘을 덮는다 (소리만).', '지금 ← 살짝 열고, 멈추세요.'] : ['문 가장자리', '저것은 당신을 따라 한다.', '← 살짝 열고, 멈추세요.'];
        if (s.mimic === 'delay') return ['문 가장자리', '손가락에 힘이 들어간다.', '기다리세요…'];
        if (s.mimic === 'response') return ['문 너머', '똑같이 문을 당긴다 — 지금은 손가락이 끼이지 않는다.', '지금 → 닫으세요!'];
        if (s.mimic === 'recover') return ['문 가장자리', '손가락이 다시 가장자리를 쥔다.', '멈추세요.'];
        if (s.mimic === 'grab') return ['문', '콰득 — 잡아당긴다.', '손을 떼지 말고 기다리세요.'];
        return ['문', '끝까지 맞물리지 않는다.', '…'];
      case 'C6a':
        if (s.drawer === 'open') return s.watchTime > 0 ? ['서랍', s.watchTime > 1.5 ? '…닫히고 있다.' : '멎었다.', '계속 보세요.'] : ['등 뒤 · 서랍', s.d > .66 ? '손가락이—!' : s.d > .4 ? '반쯤 열렸다.' : '끌리는 소리…', '손잡이를 놓고 뒤를 보세요 (↶ 뒤 · Q). 지금 문은 조용합니다.'];
        if (s.drawer === 'shut' && s.wantRear) return ['서랍', '도로 닫혔다.', '문 쪽으로 돌아서세요 (↷ 문 · Q).'];
        return ['방 안', '…', '…'];
      case 'C6b': case 'C6c':
        if (s.drawer === 'open') return s.watchTime > 0 ? ['서랍', s.watchTime > 1.5 ? '…닫히고 있다.' : '멎었다.', `계속 보세요. 문은 ${s.wedge === 'in' ? '슬리퍼가 버틴다' : '아무도 잡고 있지 않다'}.`] : ['등 뒤 · 서랍', '또 — 서랍이 열린다.', s.wedge === 'in' ? '뒤를 보세요 (↶ 뒤 · Q).' : '밀고 난 직후 슬리퍼를 끼우고, 뒤를 보세요.'];
        if (s.wantRear) return ['서랍', '도로 닫혔다.', '문 쪽으로 돌아서세요 (↷ 문 · Q).'];
        if (s.beat === 'C6c' && !s.shoves && s.drawer === 'shut') return ['문', '밀던 힘이 멎었다.', s.wedge === 'in' ? '슬리퍼를 빼세요 (클릭 · W).' : '손잡이를 다시 잡으세요.'];
        if (s.shovePhase === 'inhale') return ['문 너머', '숨을 들이쉰다 — 민다!', s.held ? '버티세요.' : s.wedge === 'in' ? '슬리퍼가 버틴다.' : '손잡이를 잡으세요!'];
        if (s.wedge === 'in') return ['문 밑', s.slipLevel >= 2 ? '끼익 — 슬리퍼가 빠지려 한다 (2/3).' : s.slipLevel === 1 ? '슬리퍼가 버텼다 (1/3).' : '슬리퍼가 문 밑에 박혀 있다.', s.held ? '잡고 있으면 슬리퍼가 다시 박힌다.' : s.slipLevel >= 2 ? '손잡이를 잡아 다시 눌러 끼우세요!' : s.slipLevel === 1 || s.slipEvents >= 1 ? '이제 손잡이를 잡아 다시 눌러 끼우세요.' : '손을 놓아도 버틴다. 한 번 밀려 보게 두세요.'];
        if (s.shoves) return ['문', '저쪽에서 문을 민다.', s.held ? '잡고 버티세요. 밀고 난 직후 손을 놓고 슬리퍼를 끼우세요 (클릭 · W).' : '손잡이를 잡으세요.'];
        return ['방 안', '…', '…'];
      case 'C7': return s.b >= .79 ? ['걸쇠', '레일에 걸린다 — 문이 덜 닫혔다.', '…'] : ['중문', '끝까지 맞물리지 않는다.', '손잡이를 놓고, 걸쇠를 ↓'];
      case 'F1': return s.eyes === 'none' || s.eyes === 'breath' ? ['문틈 위', '…숨소리.', `${down}.`] : s.gazeDown ? ['문틈', s.covered ? '엘리베이터가 문 소리를 덮는다.' : '보지 않고 있다.', s.band === 'stiff' ? (s.covered ? '시선을 내린 채 → 닫으세요.' : '바깥 소리를 기다리세요.') : '시선을 내린 채 → 닫으세요.'] : ['문틈 위', '눈이 틈 위에서 들여다본다.', `보지 마 — ${down}.`];
      case 'F2': return s.flush ? ['문', '처음으로 끝까지 맞물렸다.', '손잡이를 놓으세요.'] : s.band === 'stiff' ? (s.covered ? ['창밖', '차가 지나간다 — 소리가 덮인다.', '→ 마저 닫으세요.'] : ['문', '레일이 뻑뻑하다.', '바깥 소리를 기다리세요.']) : ['문', '손이 빠졌다.', '→ 천천히, 끝까지 닫으세요.'];
      case 'F3': return s.seatedFlag ? ['걸쇠', '딸깍.', ''] : Math.abs(s.b - .8) < 1e-3 ? ['걸쇠', '툭 — 걸림쇠.', '노크가 지나가면, 멈췄다가 ↓ 아주 천천히.'] : ['중문', s.knockImpact ? '톡.' : '문 유리에서 — 일정하게, 톡.', '걸쇠를 ↓ 천천히. 노크와 노크 사이에.'];
      case 'END': return ['방 안', '조용하다.', ''];
    }
    return ['방 안', '', ''];
  }
  const OBJECTIVES = { P0: '걸쇠를 풀고, 문 너머를 확인하세요.', C1: '문 너머를 확인하세요.', C2: '현관이 열렸는지 확인하세요.', C3: '버티세요.', C4: '보지 마세요.', C5: '문을 닫으세요.',
    C6a: '등 뒤를 확인하세요.', C6b: '문을 지키세요.', C6c: '문과 등 뒤를 함께 지키세요.', C7: '닫고, 잠그세요.', F1: '보지 않고 닫으세요.', F2: '끝까지 닫으세요.', F3: '걸쇠를 거세요.', END: '' };
  const api = { EVENTS, ENDINGS, WIN, line, OBJECTIVES, PRIORITY };
  root.DoorCaptions = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
