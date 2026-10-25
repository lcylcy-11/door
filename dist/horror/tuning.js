// Every value here is a PROVISIONAL prototype choice made by Claude for human feel review.
// None of it is a user decision. Times are seconds, door opening o is a fraction of travel
// (0 shut, 1 fully open), bolt b is 0 (up) to 1 (seated).
(function (root) {
  'use strict';
  const T = {
    step: 1 / 120, maxFrame: .08,
    door: {
      playerMax: .8, stiff: [.14, .4], capQuiet: .4, capStiff: .12, fingerQuiet: .15, fingerStiff: .12,
      slamSpeed: .35, bounce: .02, recoil: .4, flush: .008, unflushDrag: .02, velocityWindow: .1, stillWindow: .25, still: .006,
      handleY: 413, edgeX: 1184, handleX: 1158, travel: 440
    },
    attention: {
      scrape: 4.2, slam: .3, click: .12, leak: .006, leakFrom: .12, wedge: .05, rattle: .15,
      decay: .006, decayAfter: 3, warn: [.45, .75], checkpointCap: .3
    },
    masks: {
      enter: .6, leave: .5, preWarn: 1, ramp: 2.5, traffic: 8, trafficFade: .15, response: 1.2, responseFade: .1, duck: .3,
      // Repeating programme relative to its start: elevator (ramp/hold/ramp) then a passing car.
      cycle: { period: 31, elevator: 0, hold: 6, traffic: 17 },
      base: { elevator: .5, traffic: .5, mimic: .65 }
    },
    light: { debounce: .3, confirmDelay: .6, silhouette: 1.5, silhouetteSlide: .6 },
    gaze: { ease: .25 },
    turn: { pan: .45, watchFrom: .5 },
    corridor: { flicker: 1.2, dead: .85, adapted: .62, adaptTime: 5, adaptFrom: .45 },
    hand: {
      approach: 1.35, cycle: 3.4, brace: .75, push: 1.1, enemy: { brace: .11, push: .38, ease: .025 }, forceEffect: .44,
      strongMin: .74, pushGood: .65, softMin: .16, softMax: .48, easeHold: .55, required: 2,
      strainRate: 1.9, strainMax: .25, strainDecay: .12, strainWarn: .5, strainLimit: .95,
      failOpen: .96, timeLimit: 20, lowClamp: .12, smoothing: 14, retreat: .7, forceGain: 2.8
    },
    eyes: {
      irisFrom: .21, decay: .5, warn: .5,
      c4: { breathLead: 1, fade: .8, grace: 1.5, rate: .7, stay: 6, chordGrip: .5, overstay: 6 },
      f1: { breathAt: .5, fadeAt: 1.5, fade: .8, grace: .8, rate: .8, withdraw: .8 }
    },
    mimic: {
      arrive: 2, bait: .02, baitWindow: 1, baitLarge: .1, delay: .9, palmAt: .6, response: 1.2, copyMax: .04,
      recover: .7, recoverFree: .3, pinchWarn: .012, pinchGrab: .02, yank: .08, yankTime: .3, grab: 1.2,
      loiterClose: .02, loiterTap: [20, 25], loiterGrab: 30, out: .13, fingersOut: .6, failSpan: .24, failCap: .95,
      intro: [1.5, 2, 1.5]
    },
    drawer: { visit1: 1 / 16, visit2: 1 / 12, watchDelay: 1.5, close1: .25, close2: .2, slideAt: .75 },
    shove: { inhale: .8, shove: .5, periodSolo: 5, periodPair: 4.5, first: 2.5, push: .15, forced: .45,
      slip: .4, slipPop: 1.2, reseat: .4, hintAfter: 3, skipAfter: 5 },
    wedge: { min: .01, max: .7, insert: .6, remove: .5, popPush: .15 },
    bolt: {
      guideMax: 1.6, detent: .8, detentPause: .2, seatLit: .5, seatDark: .3, window: .12,
      kickGuide: .1, kickSeat: .7, free: .02, openMax: .03, cooldown: .3
    },
    beats: {
      p0Click: 1, c1MaskDelay: 3, c3After: 2.5, c3Hush: 2, glassKnocks: [0, .42, .95], c4After: 2,
      c6aAfter: 2.5, c6aHush: 1.5, c6aCreak: 1, c6bAfter: 2, c6cAfter: 2, c6cRegrip: 1, c6bGrip: 1,
      c7Wait: 6, c7Hush: 2, pullKnocks: [0, .7, 1.6], pullInhale: .8, pullTime: 1, pullTo: .62,
      f1Elevator: 3.8, f2After: 1, f2Traffic: 1, f3Knocks: 1.5, f3Period: 2.4, f3Impact: .25, f3Elevator: 4,
      endRoom: 2, endSting: 1.5, endFade: .8, hush: .3, release: 1.5, ambienceAfter: .6
    }
  };
  const freeze = o => { Object.values(o).forEach(v => { if (v && typeof v === 'object') freeze(v); }); return Object.freeze(o); };
  root.DoorTuning = freeze(T);
  if (typeof module !== 'undefined') module.exports = root.DoorTuning;
})(typeof window === 'undefined' ? globalThis : window);
