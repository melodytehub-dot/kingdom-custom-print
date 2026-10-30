"""Import additional Lumise artwork and templates from the client's archive.

These files are not listed in the old site's active database catalog. Existing
catalog entries are retained. Run the editable-template enrichment afterwards.
"""
import base64
import hashlib
import json
import re
import sys
import urllib.parse
import zipfile
from pathlib import Path, PurePosixPath

if len(sys.argv) != 2:
    raise SystemExit('Usage: python scripts/import-lumise-archive-extras.py <lumise_data.zip>')

root = Path('public/lumise')
clip_path, template_path = root / 'cliparts.json', root / 'templates.json'
cliparts = json.loads(clip_path.read_text(encoding='utf-8'))
templates = json.loads(template_path.read_text(encoding='utf-8'))
referenced_art = {item['src'].removeprefix('/lumise/') for item in cliparts['items']}
referenced_sources = {
    item.get('sourcePath') or re.sub(r'-thumbn(?:-\d+)?\.png$', '.lumi', item['previewSrc'].removeprefix('/lumise/'), flags=re.I)
    for item in templates['items']
}

def title(path):
    return re.sub(r'\s+', ' ', re.sub(r'[-_]+', ' ', PurePosixPath(path).stem)).strip().title()

def identifier(path):
    return hashlib.sha256(path.encode()).hexdigest()[:16]

added_art = added_templates = 0
with zipfile.ZipFile(sys.argv[1]) as archive:
    names = sorted(archive.namelist())
    for path in names:
        parts = PurePosixPath(path).parts
        if '..' in parts or not path.startswith('cliparts/') or not path.lower().endswith('.svg') or path in referenced_art:
            continue
        data = archive.read(path)
        dest = root.joinpath(*parts)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        viewbox = re.search(rb'viewBox=["\']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)', data[:4096], re.I)
        aspect = float(viewbox.group(1)) / float(viewbox.group(2)) if viewbox and float(viewbox.group(2)) else 1
        cliparts['items'].append({'id': f'lumise-archive-{identifier(path)}', 'name': title(path), 'src': f'/lumise/{path}', 'category': 'Archive', 'tags': [], 'aspect': round(aspect, 4)})
        added_art += 1
    for path in names:
        parts = PurePosixPath(path).parts
        if '..' in parts or not path.startswith('templates/') or not path.lower().endswith('.lumi') or path in referenced_sources:
            continue
        raw = archive.read(path).decode('utf-8').strip()
        source = json.loads(urllib.parse.unquote(raw) if raw.startswith('%7B') else raw)
        screenshot = source.get('stages', {}).get('lumise', {}).get('screenshot', '')
        if not screenshot.startswith('data:image/png;base64,'):
            print(f'Skipped template without PNG preview: {path}', file=sys.stderr)
            continue
        image = base64.b64decode(screenshot.split(',', 1)[1], validate=True)
        file_id = identifier(path)
        preview = root / 'templates' / 'archive' / f'{file_id}.png'
        preview.parent.mkdir(parents=True, exist_ok=True)
        preview.write_bytes(image)
        width, height = int.from_bytes(image[16:20], 'big'), int.from_bytes(image[20:24], 'big')
        templates['items'].append({'id': f'lumise-template-archive-{file_id}', 'name': str(source.get('name') or title(path)), 'category': 'Archive', 'subtitle': 'Archived design', 'tags': [], 'previewSrc': f'/lumise/templates/archive/{file_id}.png', 'sourcePath': path, 'aspect': round(width / height, 4) if height else 1})
        added_templates += 1

for manifest, path in ((cliparts, clip_path), (templates, template_path)):
    manifest['categories'] = sorted({item['category'] for item in manifest['items']})
    path.write_text(json.dumps(manifest, separators=(',', ':'), ensure_ascii=False) + '\n', encoding='utf-8')
print(f'Added {added_art} archived cliparts and {added_templates} archived templates.')
