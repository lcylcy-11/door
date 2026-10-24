"""Original procedural Foley export only. Does not import or change the game.

Requires numpy. Produces 48 kHz / 16-bit stereo WAVs and an audio inventory.
These are synthesized Foley studies, not field recordings or actor recordings.
"""
from pathlib import Path
import hashlib
import json
import wave
import numpy as np

RATE = 48000
OUT = Path(__file__).resolve().parent.parent / 'audio'
RNG = np.random.default_rng(20261025)


def timeline(seconds):
    return np.arange(round(seconds * RATE), dtype=np.float64) / RATE


def noise(seconds, low, high, seed):
    n = round(seconds * RATE)
    rng = np.random.default_rng(seed)
    frequency = np.fft.rfftfreq(n, 1 / RATE)
    spectrum = np.fft.rfft(rng.normal(size=n))
    weight = np.exp(-(frequency / max(high, 1)) ** 4)
    if low:
        weight *= 1 - np.exp(-(frequency / low) ** 4)
    weight[0] = 0
    x = np.fft.irfft(spectrum * weight, n)
    return x / max(np.std(x), 1e-9)


def envelope(n, attack=.025, release=.09):
    y = np.ones(n)
    a, r = min(n // 2, round(attack * RATE)), min(n // 2, round(release * RATE))
    if a:
        y[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if r:
        y[-r:] = np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    y[0] = 0
    y[-1] = 0
    return y


def impact(seconds, modes, seed=31, transient=.18, decay=10):
    t = timeline(seconds)
    y = transient * noise(seconds, 180, 9500, seed) * np.exp(-t * 100)
    for i, (frequency, strength) in enumerate(modes):
        y += strength * np.sin(2 * np.pi * frequency * t + i * .17) * np.exp(-t * decay * (1 + i * .45))
    y += noise(seconds, 70, 1200, seed + 1) * .035 * np.exp(-t * 5.5)
    return y * envelope(len(t), .001, .04)


def rub(seconds, base, seed, irregular=True):
    t = timeline(seconds)
    phase = 2 * np.pi * (base * t + 1.9 * np.sin(t * 5) + .6 * np.sin(t * 13))
    y = sum(np.sin(phase * k + k * .1) / k ** 1.8 for k in range(1, 6)) * .17
    surface = noise(seconds, 180, 2800, seed)
    grain = .3 + .7 * np.sin(t * 22 + .8 * np.sin(t * 9)) ** 4 if irregular else np.ones(len(t))
    return (y * grain + surface * .13) * envelope(len(t), .06, .16)


INVENTORY = []


def export(name, signal, peak, pan, gimmicks, use, loop=False):
    if not np.all(np.isfinite(signal)):
        raise ValueError(name + ': nonfinite signal')
    signal = signal - signal.mean()
    if not loop:
        edge = envelope(len(signal), .004, .045)
        signal *= edge
        # Windowing can reintroduce DC. Remove it without creating nonzero edge samples.
        signal -= edge * (signal.sum() / max(edge.sum(), 1e-9))
    signal *= peak / max(np.max(np.abs(signal)), 1e-9)
    # Equal-power stereo panning. The game may apply runtime panning again.
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    stereo = np.column_stack([signal * left, signal * right])
    if loop:
        # The FFT noise and carriers are periodic; equal endpoints remove rounding discontinuity.
        stereo[-1] = stereo[0]
    else:
        stereo[0] = 0
        stereo[-1] = 0
    pcm = np.round(np.clip(stereo, -1, 1) * 32767).astype('<i2')
    path = OUT / (name + '.wav')
    with wave.open(str(path), 'wb') as stream:
        stream.setnchannels(2)
        stream.setsampwidth(2)
        stream.setframerate(RATE)
        stream.writeframes(pcm.tobytes())
    duration = len(signal) / RATE
    INVENTORY.append({
        'id': name, 'file': 'audio/' + path.name, 'gimmicks': gimmicks,
        'sample_rate': RATE, 'channels': 2, 'bits': 16, 'frames': len(signal),
        'duration_seconds': duration, 'loop': loop,
        'loop_start_frame': 0 if loop else None, 'loop_end_frame_exclusive': len(signal) if loop else None,
        'peak_dbfs': round(20 * np.log10(max(np.max(np.abs(stereo)), 1e-9)), 2),
        'rms_dbfs': round(20 * np.log10(max(np.sqrt(np.mean(stereo ** 2)), 1e-9)), 2),
        'suggested_initial_gain': .5 if 'mask' in name else .65,
        'pan_baked': pan, 'use': use,
        'source': 'original procedural Foley; tools/build_audio.py, fixed seeds; not a field recording',
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
    })


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    t = timeline(10)
    motor = .34 * np.sin(2 * np.pi * 36 * t) + .18 * np.sin(2 * np.pi * 113 * t)
    motor += noise(10, 24, 420, 10) * .12 + noise(10, 420, 1600, 11) * .025
    motor *= .82 + .18 * np.cos(2 * np.pi * t / 10)
    export('mask-elevator-loop', motor, .34, -.25, ['G1'], '마스킹 구간의 승강기 모터. 루프 전체에 소음 차폐를 판정하지 말고 실제 재생 gain과 연결.', True)

    t = timeline(8)
    passage = np.sin(np.pi * t / 8) ** 2.6
    traffic = (noise(8, 25, 1800, 20) * .24 + noise(8, 1000, 4500, 21) * .07) * passage
    traffic += .12 * np.sin(2 * np.pi * (72 * t - 1.6 * t * t)) * passage
    export('mask-traffic-pass', traffic, .57, .1, ['G1'], '창밖 차량 통과 8초. 중심 구간이 가장 크다. 앞뒤 작은 소리 구간은 안전 마스킹으로 취급하지 않을 것.')

    export('latch-slide', rub(.85, 180, 30) + impact(.85, [(590, .12), (1270, .05)], 33, .03, 18), .46, .12, ['G2'], '걸쇠를 천천히 내리는 마찰. 실제 이동 속도와 gain을 연결.')
    export('latch-click', impact(.38, [(810, .26), (1860, .13), (3110, .035)], 40, .25, 30), .64, .12, ['G2'], '걸쇠가 홈에 들어간 완료 피드백. 한 번만 재생.')
    t = timeline(1.2)
    rattle = np.zeros(len(t))
    tap = impact(.23, [(730, .17), (1680, .09)], 45, .1, 22)
    for onset, gain in [(.04, .8), (.27, .5), (.55, 1), (.88, .7)]:
        i = round(onset * RATE); rattle[i:i + len(tap)] += tap[:min(len(tap), len(t)-i)] * gain
    export('latch-rattle', rattle, .58, .2, ['G2'], '걸쇠를 급하게/잘못 움직일 때의 금속 떨림. 실패 확정과는 분리.')

    t = timeline(2.8)
    inhale = np.exp(-((t - .65) / .36) ** 2)
    exhale = np.exp(-((t - 1.9) / .57) ** 2)
    breath = noise(2.8, 180, 1050, 50) * (inhale * .1 + exhale * .22)
    breath += noise(2.8, 750, 2300, 51) * exhale * .025
    export('breath-near', breath, .30, .45, ['G3'], '눈/시선 위협의 가까운 합성 숨. 대사/배우 녹음이 아니며 시각 신호를 대체하지 않음.')

    export('switch-click', impact(.22, [(1320, .12), (2470, .07)], 60, .35, 48), .54, -.1, ['G4'], '벽 스위치 눌림. 켬/끔 공용, 같은 토글에서 중복 재생하지 않을 것.')
    t = timeline(6)
    hum = .40 * np.sin(2 * np.pi * 60 * t) + .16 * np.sin(2 * np.pi * 120 * t)
    hum += noise(6, 90, 320, 65) * .045
    export('lamp-hum-loop', hum, .15, -.1, ['G4'], '불이 켜진 동안의 작은 전원 험. 80ms 이상 gain fade 권장.', True)

    export('wedge-in', rub(.9, 74, 70) + impact(.9, [(93, .16), (210, .08)], 72, .04, 13), .45, 0, ['G5'], '슬리퍼를 문 밑으로 밀어 넣는 마찰과 접촉.')
    t = timeline(1.35)
    slip = rub(1.35, 88, 75) * (.25 + .75 * (t / 1.35) ** 1.5)
    export('wedge-slip', slip, .47, 0, ['G5'], '버팀목이 미끄러지는 경고. 끝의 음량이 커짐. 예고 없이 즉사 판정에 쓰지 않을 것.')
    export('wedge-out', rub(.7, 62, 79), .36, 0, ['G5'], '슬리퍼를 빼는 마찰. 제거 완료 이벤트와 분리해 동작 중 재생.')

    scrape = rub(1.3, 116, 80)
    export('door-scrape', scrape, .40, 0, ['G6'], '플레이어 쪽 문 마찰. 실제 문 이동 중만 재생하고 멈추면 감쇠.')
    export('mimic-response', rub(1.3, 109, 81), .39, .48, ['G6'], '문 너머의 유사한 응답 마찰. 런타임에서 플레이어 소리에 지연시켜 재생; 지연/정답 타이밍은 파일에 구워 넣지 않음.')

    export('drawer-slide', rub(1.5, 76, 90) + impact(1.5, [(146, .08), (330, .04)], 91, .02, 16), .44, -.35, ['G7'], '서랍 이동 마찰. 바라보아 멈추면 짧게 감쇠시키기.')
    t = timeline(3)
    phase = 2 * np.pi * (104 * t + 1.1 * np.sin(2 * np.pi * t / 3))
    # Keep all carriers periodic over the exported loop.
    creak = .12 * np.sin(phase) * (.4 + .6 * np.sin(2 * np.pi * t / 3) ** 4) + .03 * np.sin(2 * np.pi * 281 * t)
    creak += noise(3, 150, 1600, 95) * .018
    export('drawer-creak-loop', creak, .30, -.35, ['G7'], '서랍이 조금씩 열리는 지속 예고. 시선/진행 상태와 연결.', True)
    export('drawer-thud', impact(.6, [(81, .28), (182, .12), (379, .05)], 100, .08, 12), .61, -.35, ['G7'], '서랍이 걸리거나 닫힐 때의 둔탁한 접촉.')
    t = timeline(1.4)
    floor = rub(1.4, 48, 105) * np.sin(np.pi * t / 1.4) ** 2
    export('rear-floor-creak', floor, .38, -.45, ['G7'], '등 뒤 바닥의 체중 이동처럼 들리는 합성 삐걱임. 위치 예고용.')

    t = timeline(1.05)
    wood = noise(1.05, 160, 9000, 110) * .2 * np.exp(-100 * t)
    for frequency, strength, decay in [(79, .36, 8), (173, .21, 13), (319, .09, 22)]:
        wood += strength * np.sin(2 * np.pi * frequency * t) * np.exp(-decay * t)
    wood += noise(1.05, 20, 900, 111) * .035 * np.exp(-5 * t)
    export('knock-wood', wood, .72, -.2, ['G1', 'G2', 'G4', 'G7'], 'H2의 목재 공명 설계에 기반한 공용 단일 노크. 노크 리듬은 런타임에서 구성.')

    if len(INVENTORY) != 18:
        raise AssertionError(f'Expected 18 assets, got {len(INVENTORY)}')
    (OUT.parent / 'audio-inventory.json').write_text(json.dumps(INVENTORY, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Exported {len(INVENTORY)} WAVs: {sum(x["duration_seconds"] for x in INVENTORY):.2f}s total, 48kHz/16-bit/stereo')


if __name__ == '__main__':
    main()
