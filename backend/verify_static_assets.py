"""Fail a deployment when its public web assets are missing or changed."""
import hashlib
import json
from pathlib import Path

TEXT = {'.html', '.js', '.css', '.json'}


def digest(path):
    data = path.read_bytes()
    if path.suffix in TEXT:
        data = data.replace(b'\r\n', b'\n')
    return hashlib.sha256(data).hexdigest()


def verify(root, manifest):
    records = json.loads(manifest.read_text(encoding='utf-8'))['files']
    if not isinstance(records, dict) or 'index.html' not in records or not any(p.endswith('.ttf') for p in records):
        raise ValueError('Incomplete static asset manifest')
    failures = []
    for relative, expected in records.items():
        file = (root / relative).resolve()
        if not file.is_relative_to(root.resolve()) or not file.is_file() or digest(file) != expected:
            failures.append(relative)
    if failures:
        raise ValueError('Missing or changed static assets: ' + ', '.join(failures))
    return len(records)


if __name__ == '__main__':
    backend = Path(__file__).resolve().parent
    count = verify(backend / 'static', backend / 'release-assets.json')
    print(f'Static release assets verified: {count}')
