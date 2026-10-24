"""Standalone static asset viewer. No game rules/input implementation."""
from pathlib import Path
import html
import json

ROOT=Path(__file__).resolve().parent.parent
ESC=html.escape


def main():
    data=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
    pictures=[]
    for row in data['images']:
        if row['kind']!='new':continue
        pictures.append(f'<figure><div class="picture"><img src="{row["file"]}" alt="{ESC(row["label"])}"></div><figcaption><b>{ESC(row["label"])}</b><br><a href="{row["file"]}">{row["id"]}.png</a> · {row["width"]} × {row["height"]}<br>{"투명 PNG" if row["has_alpha"] else "배경 PNG"} · {", ".join(row["gimmicks"])}</figcaption></figure>')
    clips=[]
    for row in data['audio']:
        clips.append(f'<article class="sound"><b>{row["id"]}</b><span>{row["duration_seconds"]:.2f}s · {"루프" if row["loop"] else "단발"} · peak {row["peak_dbfs"]}dBFS</span><p>{ESC(row["use"])}</p><audio controls preload="metadata" {"loop" if row["loop"] else ""} src="{row["file"]}"></audio></article>')
    rows=''.join(f'<tr><td>{g["id"]}</td><td>{ESC(g["title"])}</td><td>{ESC(g["response"])}</td></tr>' for g in data['gimmicks'])
    page='''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>문틈 — Claude 인계 에셋</title><style>
*{box-sizing:border-box}body{margin:0;background:#121813;color:#e1dfd1;font:15px/1.7 "Malgun Gothic",sans-serif}main{max-width:1320px;margin:auto;padding:38px 30px}h1{font:400 34px Batang,serif;margin:0 0 12px}h2{font-size:22px;margin:48px 0 18px}p{max-width:85ch}a{color:#d5c89f;text-underline-offset:4px}button,input,a:focus-visible{outline-color:#e5cf98}header{border-bottom:1px solid #4b5546;padding-bottom:24px}.muted{color:#b1b8a7}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}figure{margin:0}figcaption{font-size:13px;padding:13px 0 20px}.picture{height:280px;background:#232b22;display:flex;justify-content:center;align-items:center}.picture img{max-width:100%;max-height:100%;object-fit:contain}.assemblies{display:grid;grid-template-columns:1fr 1fr;gap:32px}.part{border:1px solid #4b5546;padding:18px;background:#242a22}.part svg{display:block;width:100%;height:360px}.part label{display:block;margin:12px 0;cursor:pointer}.rear{grid-column:1/-1}.rear svg{height:auto}.bolt,.rocker,.drawer{transition:transform .25s ease-out}#latch-toggle:checked~svg .bolt{transform:translateY(-230px)}#switch-toggle:checked~svg .rocker{transform:translateY(12px)}#drawer-toggle:checked~svg .drawer{transform:translateY(50px)}.lights{display:grid;grid-template-columns:1fr 1fr;gap:20px}.lights img{width:100%}.sound-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.sound{border-top:1px solid #4b5546;padding:16px 0}.sound b,.sound span{display:block}.sound span{font-size:12px;color:#b1b8a7}.sound p{font-size:13px;min-height:44px}.sound audio{width:100%;height:38px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid #4b5546;text-align:left;padding:12px 8px;vertical-align:top}summary{cursor:pointer}code{background:#283125;padding:2px 6px}footer{margin:40px 0 15px;color:#b1b8a7}@media(max-width:760px){main{padding:24px 16px}.grid,.assemblies,.sound-grid,.lights{grid-template-columns:1fr}.rear{grid-column:auto}h1{font-size:27px}.picture{height:310px}}@media(prefers-reduced-motion:reduce){.bolt,.rocker,.drawer{transition:none}}
</style></head><body><main>
<header><h1>문틈 — 일곱 기믹 에셋 팩</h1><p>신규 이미지 9종 · 기존 참조 이미지 4종 · 효과음 18종. Claude에 넘길 제작물 미리보기입니다. 이 페이지의 체크박스는 부품 합성 확인용이며 게임 구현이 아닙니다.</p><p><a href="HANDOFF-CLAUDE.md">Claude 인계 문서</a> · <a href="manifest.json">크기·앵커·루프 정보</a> · <a href="image-provenance.json">이미지 생성 프롬프트</a> · <a href="QA.md">검증 범위</a></p></header>
<h2>포함한 일곱 기믹</h2><table><thead><tr><th>ID</th><th>기믹</th><th>예정 대응</th></tr></thead><tbody>__ROWS__</tbody></table>
<h2>이미지 원본</h2><div class="grid">__PICTURES__</div>
<h2>분리 부품 합성 확인</h2><p class="muted">게임 배치 전의 출발 좌표입니다. 걸쇠 봉은 고정 가이드 뒤로, 서랍 앞판은 빈 공간 위로 합성합니다.</p>
<div class="assemblies">
<section class="part"><h3>걸쇠 고정판 + 이동 봉</h3><input id="latch-toggle" type="checkbox"><label for="latch-toggle">올린 상태 / 내린 상태 전환</label><svg viewBox="0 0 1024 1736"><defs><clipPath id="caps"><rect x="440" y="312" width="160" height="123"/><rect x="435" y="758" width="168" height="120"/><rect x="436" y="1185" width="170" height="255"/></clipPath></defs><image href="images/latch-body.png" x="0" y="100" width="1024" height="1536"/><g class="bolt"><image href="images/latch-bolt.png" x="130" y="290" width="768" height="1152"/></g><image href="images/latch-body.png" x="0" y="100" width="1024" height="1536" clip-path="url(#caps)"/></svg></section>
<section class="part"><h3>스위치 고정판 + 로커</h3><input id="switch-toggle" type="checkbox"><label for="switch-toggle">로커 위치 확인</label><svg viewBox="0 0 1024 1536"><image href="images/switch-body.png" width="1024" height="1536"/><g class="rocker"><image href="images/switch-rocker.png" x="246" y="364" width="532.48" height="798.72"/></g></svg></section>
<section class="part rear"><h3>뒤쪽 방 + 서랍 앞판</h3><input id="drawer-toggle" type="checkbox"><label for="drawer-toggle">앞판 이동과 빈 공간 확인</label><svg viewBox="0 0 1672 941"><image href="images/rear-room.png" width="1672" height="941"/><g class="drawer"><image href="images/rear-drawer-front.png" x="432.75" y="260.3" width="560.5" height="181.2"/></g></svg></section>
</div>
<h2>조명 상태 비교</h2><div class="lights"><figure><img src="references/apartment.png" alt="기존 어두운 전면 방"><figcaption>기존 배경 — 참조 원본</figcaption></figure><figure><img src="images/front-lit.png" alt="따뜻한 조명을 켠 전면 방"><figcaption>방의 조명을 켠 변형 — 복도는 차갑게 유지</figcaption></figure></div>
<h2>효과음</h2><p class="muted">48kHz / PCM16 / 스테레오. 현장 녹음이나 성우 녹음이 아닌 원본 합성 Foley입니다. 재생 버튼으로 개별 확인할 수 있습니다. 감각적 품질과 게임 내 믹스는 아직 사용자·Claude 검토 전입니다.</p><div class="sound-grid">__AUDIO__</div>
<footer>이 팩은 에셋 제작과 인계까지만 완료합니다. 게임 코드는 변경하지 않았습니다. 실제 기믹 통합·마우스 플레이·공포감 검증은 Claude 구현 이후에 진행해야 합니다.</footer>
</main></body></html>'''
    page=page.replace('__ROWS__',rows).replace('__PICTURES__',''.join(pictures)).replace('__AUDIO__',''.join(clips))
    (ROOT/'index.html').write_text(page,encoding='utf-8')
    print('Standalone asset preview written: index.html')


if __name__=='__main__':main()
