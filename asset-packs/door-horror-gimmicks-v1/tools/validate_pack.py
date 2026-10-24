"""Deterministic asset-file validation, not gameplay/experience acceptance."""
from pathlib import Path
import hashlib
import json
import wave
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent


def main():
    manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
    failures=[]; warnings=[]; image_results=[]; sound_results=[]
    assert len(manifest['gimmicks'])==7
    assert sum(r['kind']=='new' for r in manifest['images'])==9
    assert len(manifest['audio'])==18
    ids=set()
    for row in manifest['images']:
        assert row['id'] not in ids;ids.add(row['id'])
        path=ROOT/row['file']
        with Image.open(path) as im:
            im.load(); assert im.size==(row['width'],row['height'])
            if row['has_alpha']:
                a=np.asarray(im.getchannel('A'))
                assert a.min()==0 and a.max()>128, row['id']+' lacks usable transparency'
                border=np.concatenate([a[0],a[-1],a[:,0],a[:,-1]])
                if np.max(border)>32:warnings.append(row['id']+': alpha fringe touches canvas; inspect visually')
        assert hashlib.sha256(path.read_bytes()).hexdigest()==row['sha256']
        image_results.append({'id':row['id'],'status':'PASS','size':[row['width'],row['height']],
                              'has_alpha':row['has_alpha'],'opaque_bbox':row['opaque_bbox_xyxy']})
    for row in manifest['audio']:
        assert row['id'] not in ids;ids.add(row['id']); path=ROOT/row['file']
        with wave.open(str(path),'rb') as w:
            assert (w.getframerate(),w.getsampwidth(),w.getnchannels())==(48000,2,2)
            assert w.getnframes()==row['frames']
            data=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,2).astype(np.float64)/32767
        assert np.all(np.isfinite(data)) and .001<np.max(np.abs(data))<.99
        assert np.max(np.abs(data.mean(axis=0)))<.0002,row['id']+' DC offset'
        seam=float(np.max(np.abs(data[0]-data[-1])))
        if row['loop']:assert seam<1/32767+1e-9
        else:assert np.max(np.abs(data[0]))==0 and np.max(np.abs(data[-1]))==0
        assert hashlib.sha256(path.read_bytes()).hexdigest()==row['sha256']
        sound_results.append({'id':row['id'],'status':'PASS','duration_seconds':row['duration_seconds'],
                              'peak_dbfs':row['peak_dbfs'],'rms_dbfs':row['rms_dbfs'],'seam_step':seam,'loop':row['loop']})
    for gimmick in manifest['gimmicks']:
        assert gimmick['images'] and gimmick['audio']
        assert all(i in ids for i in gimmick['images']+gimmick['audio']),gimmick['id']

    dim=np.asarray(Image.open(ROOT/'references/apartment.png').convert('L'),dtype=float)
    lit=np.asarray(Image.open(ROOT/'images/front-lit.png').convert('L'),dtype=float)
    assert dim.shape==lit.shape
    alignment=[]
    for label,x0,x1 in [('left-frame',430,480),('middle-frame',685,738),('right-frame',1235,1290)]:
        xdim=x0+int(np.argmax(np.abs(np.diff(dim[120:780,x0:x1],axis=1)).mean(axis=0)))
        xlit=x0+int(np.argmax(np.abs(np.diff(lit[120:780,x0:x1],axis=1)).mean(axis=0)))
        alignment.append({'feature':label,'dim_x':xdim,'lit_x':xlit,'shift_px':xlit-xdim})
        if abs(xlit-xdim)>4:warnings.append(label+': lighting plate jamb shift >4px; verify crossfade fit')
    report={'file_validation':'PASS','images':image_results,'audio':sound_results,
            'gimmick_coverage':{g['id']:'PASS' for g in manifest['gimmicks']},
            'lighting_jamb_measurement':alignment,
            'bedroom_mean_luma':{'dim':round(float(dim[100:700,50:410].mean()),2),'lit':round(float(lit[100:700,50:410].mean()),2)},
            'warnings':warnings,'failures':failures,
            'limits':['No gameplay implementation or runtime integration tested.','Audio perceptual quality and final user aesthetic acceptance UNVERIFIED.','Geometry fit outside the asset preview remains UNVERIFIED.']}
    (ROOT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    manifest['status']['file_validation']='PASS'
    (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('PASS: 13 PNGs, 18 WAVs, 7 gimmick mappings; hashes, alpha, PCM, amplitude, loop boundaries')
    print('Lighting jamb shifts:',alignment)
    print('Warnings:',warnings)


if __name__=='__main__':main()
