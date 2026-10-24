"""Asset metadata/preview data only. Does not modify or import runtime game code."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LABELS = {
    'front-lit':'전면 방 — 조명 켜짐', 'eyes':'문틈의 눈', 'slipper-wedge':'버팀목 슬리퍼',
    'latch-body':'걸쇠 고정판', 'latch-bolt':'걸쇠 이동 봉',
    'switch-body':'스위치 고정판', 'switch-rocker':'스위치 로커',
    'rear-room':'뒤돌아본 방 — 상단 서랍 빈 공간', 'rear-drawer-front':'상단 서랍 앞판',
}
GIMMICKS = [
    {'id':'G1','title':'다른 소리에 숨어 움직이기','images':['ref-apartment','ref-door'],
     'audio':['mask-elevator-loop','mask-traffic-pass','knock-wood'],
     'response':'외부 소리가 문 소음을 충분히 가리는 동안 진행하고, 작아지면 멈춘다.'},
    {'id':'G2','title':'문을 닫은 뒤 걸쇠까지 잠그기','images':['latch-body','latch-bolt'],
     'audio':['latch-slide','latch-click','latch-rattle'],
     'response':'문을 닫은 후 손잡이를 놓고 걸쇠를 조심히 내린다. 걸쇠가 홈에 들어가야 완료.'},
    {'id':'G3','title':'문틈의 눈을 피하며 닫기','images':['eyes','ref-door'],
     'audio':['breath-near'],
     'response':'눈을 마주치지 않도록 아래로 보되, 손잡이는 식별하며 문을 닫는다.'},
    {'id':'G4','title':'불을 켜서 확인할지 선택하기','images':['front-lit','ref-apartment','switch-body','switch-rocker'],
     'audio':['switch-click','lamp-hum-loop'],
     'response':'불로 정보를 얻는 대신 소리와 빛으로 위치가 드러나는 위험을 감수한다.'},
    {'id':'G5','title':'임시 버팀목을 쓰고 다시 빼기','images':['slipper-wedge','ref-door'],
     'audio':['wedge-in','wedge-slip','wedge-out'],
     'response':'슬리퍼로 잠깐 문을 지탱하고 다른 행동을 한다. 완전히 닫기 전에 빼고 다시 잡는다.'},
    {'id':'G6','title':'내 움직임을 따라 하는 상대를 속이기','images':['ref-door','ref-hand','ref-hand-grip'],
     'audio':['door-scrape','mimic-response'],
     'response':'짧게 움직이고 멈춰 상대의 응답을 유도한 뒤 반대 방향으로 움직인다. 지연은 런타임 소유.'},
    {'id':'G7','title':'등 뒤를 확인하는 동안 문을 보지 못하기','images':['rear-room','rear-drawer-front'],
     'audio':['drawer-slide','drawer-creak-loop','drawer-thud','rear-floor-creak'],
     'response':'뒤쪽 서랍을 보면 움직임이 멎지만 그동안 문틈을 볼 수 없다.'},
]


def image_record(asset_id, file, label, gimmicks, kind, source):
    path = ROOT / file
    with Image.open(path) as image:
        image.load()
        alpha = image.getchannel('A') if 'A' in image.getbands() else None
        bbox = list(alpha.point(lambda x: 255 if x >= 128 else 0).getbbox()) if alpha else [0,0,*image.size]
        record = {'id':asset_id,'file':file,'label':label,'gimmicks':gimmicks,'kind':kind,
                  'width':image.width,'height':image.height,'mode':image.mode,'has_alpha':alpha is not None,
                  'opaque_bbox_xyxy':bbox,'alpha_extrema':list(alpha.getextrema()) if alpha else None,
                  'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'source':source}
    x0,y0,x1,y1=bbox
    record['opaque_center_px']=[(x0+x1)/2,(y0+y1)/2]
    record['anchor_note']='Native-canvas pixels. Opaque bounds exclude transparent padding; preserve aspect ratio unless a verified fit needs adjustment.'
    return record


def main():
    provenance=json.loads((ROOT/'image-provenance.json').read_text(encoding='utf-8'))
    images=[image_record(row['id'],'images/'+row['id']+'.png',LABELS[row['id']],row['gimmicks'],'new',
                         'image-provenance.json#'+row['id']) for row in provenance['images']]
    for name in ['apartment','door','hand','hand-grip']:
        images.append(image_record('ref-'+name,'references/'+name+'.png','기존 H2 '+name,[],
                                   'unchanged-reference','references/original-provenance.json'))
    audio=json.loads((ROOT/'audio-inventory.json').read_text(encoding='utf-8'))
    manifest={
        'schema_version':1,'title':'문틈 — 일곱 기믹 Claude 인계 에셋 팩',
        'date':'2026-10-25','scope':'ASSETS ONLY; no gameplay implementation or integration',
        'baseline_commit':'ce24928','new_image_count':9,'reference_image_count':4,'audio_count':18,
        'world_reference':{'viewbox':[1600,900],'door_clip_xywh':[700,80,488,695],
                           'door_travel_x':440,'background_native_size':[1672,941]},
        'images':images,'audio':audio,'gimmicks':GIMMICKS,
        'assemblies':{
            'latch':{'space':'latch-body native canvas, pixels','body_xywh':[0,100,1024,1536],
                     'bolt_scale':.75,'bolt_closed_xy':[130,290],'bolt_open_xy':[130,60],
                     'foreground_occlusion_rects_xywh':[[440,312,160,123],[435,758,168,120],[436,1185,170,255]],
                     'note':'Preview fit only. Rod must pass BEHIND guide collars and receiver; redraw clipped regions from the SAME body image above rod. Whole assembly includes top margin for unlocked tip. Runtime placement/logic not implemented.'},
            'switch':{'space':'switch-body native canvas, pixels','rocker_scale':.52,'rocker_xy':[246,364],
                      'note':'Centers rocker in empty recess; rock/shift it for state feedback. Native sizes include large alpha padding. Runtime hit target should remain usable at small visual scale.'},
            'rear-drawer':{'space':'rear-room native canvas, pixels','cavity_xywh':[449,304,529,97],
                           'panel_canvas_closed_xywh':[432.75,260.3,560.5,181.2],
                           'panel_preview_open_offset_y':50,
                           'note':'Uniform scale based on opaque width, not full canvas. Starting fit visually checked in asset preview; game depth/side edges and exact interaction remain Claude work.'},
            'eyes':{'space':'game 1600x900 reference','suggested_xywh':[950,215,220,110],
                    'note':'Put behind moving door and its clip. Darken/occlude broad skin fringe; never paste an unmasked rectangular face on top of the door.'},
            'slipper':{'anchor':'left toe / bottom sole in opaque bounds','suggested_world_width':160,
                       'note':'Only toe end enters gap. Sole rests on threshold. Do not treat entire tall alpha canvas as physical hit box.'},
            'lighting':{'on':'images/front-lit.png','dim':'references/apartment.png',
                        'note':'Same 1672x941 canvas; major jamb alignment measured. Not a pixel-identity guarantee. Blend background plates only; do not accidentally fade door/eyes/hand/collision state.'}
        },
        'status':{'file_validation':'UNVERIFIED until validate_pack.py','game_integration':'UNVERIFIED; not performed',
                  'sensory_acceptance':'UNVERIFIED; user/Claude review required'},
        'audio_notes':['48kHz PCM16 stereo; load after user gesture. No autoplay.',
                       'Subtle stereo position is baked; do not double-pan without intention.',
                       'Runtime owns gains, pause/visibility/restart, timing and listener cues; do not let sound carry a contradictory state.',
                       'All audio is original procedural Foley, not field or actor recordings. No BGM, speech or licensed stock is included.'],
    }
    (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Manifest: {len(images)} images (9 new + 4 refs), {len(audio)} WAVs, {len(GIMMICKS)} gimmicks')


if __name__=='__main__':main()
