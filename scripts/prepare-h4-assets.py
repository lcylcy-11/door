# Usage: python -I scripts/prepare-h4-assets.py  (needs Pillow + numpy; deterministic for a given Pillow build)
# Runtime asset preparation: crop cutouts to their opaque bounds, remove coloured alpha fringe,
# downscale to ~2x their largest on-screen size, and encode as WebP. Plates keep full canvas.
import json, shutil, numpy as np
from pathlib import Path
from PIL import Image, ImageFilter
ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT/'asset-packs'/'door-horror-gimmicks-v1'
OUT = ROOT/'dist'/'horror'/'assets'
manifest = json.loads((PACK/'manifest.json').read_text(encoding='utf-8'))
bbox = {i['id']: i['opaque_bbox_xyxy'] for i in manifest['images']}
# id -> output scale relative to the native crop
CUT = {'eyes': .5, 'latch-body': .5, 'latch-bolt': .375, 'switch-body': .3, 'switch-rocker': .3 * .52,
       'slipper-wedge': .3, 'rear-drawer-front': .5}
def defringe(img):
    a = np.asarray(img).astype(np.float32) / 255
    rgb, al = a[..., :3], a[..., 3:]
    solid = (al > .96).astype(np.float32)
    # alpha-weighted blur of the solid interior provides edge colour without the generator's halo hue
    acc = Image.fromarray((rgb * solid * 255).astype(np.uint8)); w = Image.fromarray((solid[..., 0] * 255).astype(np.uint8))
    for _ in range(3):
        acc = acc.filter(ImageFilter.GaussianBlur(3)); w = w.filter(ImageFilter.GaussianBlur(3))
    accn = np.asarray(acc).astype(np.float32) / 255; wn = np.asarray(w).astype(np.float32)[..., None] / 255
    fill = np.where(wn > 1e-3, accn / np.maximum(wn, 1e-3), rgb)
    mix = np.clip((al - .55) / .41, 0, 1)
    out = rgb * mix + np.clip(fill, 0, 1) * (1 - mix)
    return Image.fromarray(np.concatenate([out, al], -1).__mul__(255).round().astype(np.uint8), 'RGBA')
report = {}
OUT.mkdir(parents=True, exist_ok=True)
for name, scale in CUT.items():
    x0, y0, x1, y1 = bbox[name]
    img = Image.open(PACK/'images'/f'{name}.png').convert('RGBA').crop((x0, y0, x1, y1))
    img = defringe(img)
    size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    img = img.resize(size, Image.LANCZOS)
    img.save(OUT/f'{name}.webp', 'WEBP', quality=90, method=6)
    report[name] = {'crop_xyxy': [x0, y0, x1, y1], 'size': list(size), 'scale': scale}
for name in ['front-lit', 'rear-room']:
    img = Image.open(PACK/'images'/f'{name}.png').convert('RGB')
    img.save(OUT/f'{name}.webp', 'WEBP', quality=88, method=6)
    report[name] = {'size': [img.width, img.height]}
audio = OUT/'audio'; audio.mkdir(exist_ok=True)
for item in manifest['audio']:
    shutil.copyfile(PACK/item['file'], audio/Path(item['file']).name)
(OUT/'runtime-assets.json').write_text(json.dumps(report, indent=1), encoding='utf-8')
print(json.dumps(report, indent=1))
