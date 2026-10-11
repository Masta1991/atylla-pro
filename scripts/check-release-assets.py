"""Check the complete Expo export against a Git tree, not the working directory.

Usage: python scripts/check-release-assets.py EXPORT --repo REPO --ref HEAD
metadata.json is Expo build metadata, not a served application resource.
Git's clean filters account for the repository's configured text line endings.
"""
import argparse
import json
import subprocess
from pathlib import Path


def audit(build, repo, ref):
    results = []
    files = sorted(p for p in build.rglob('*') if p.is_file() and p.name != 'metadata.json')
    if not files or not (build / 'index.html').is_file():
        raise ValueError('Export must contain index.html and resources')
    for file in files:
        relative = file.relative_to(build).as_posix()
        target = 'backend/static/' + relative
        expected = subprocess.check_output(
            ['git', 'hash-object', '--path=' + target, str(file.resolve())], cwd=repo, text=True).strip()
        actual = subprocess.run(['git', 'rev-parse', '--verify', ref + ':' + target],
                                cwd=repo, capture_output=True, text=True)
        results.append(dict(path=relative, match=actual.returncode == 0 and actual.stdout.strip() == expected))
    return dict(status='PASS' if all(r['match'] for r in results) else 'FAIL',
                ref=ref, total=len(results), failed=[r['path'] for r in results if not r['match']], results=results)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('export', type=Path)
    parser.add_argument('--repo', type=Path, default=Path.cwd())
    parser.add_argument('--ref', default='HEAD')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    report = audit(args.export.resolve(), args.repo.resolve(), args.ref)
    if args.output:
        args.output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k != 'results'}, indent=2))
    raise SystemExit(0 if report['status'] == 'PASS' else 1)
