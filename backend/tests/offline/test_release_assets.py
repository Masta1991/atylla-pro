import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import os
import shutil
import subprocess
import sys

spec = importlib.util.spec_from_file_location('verify_static_assets', Path(__file__).resolve().parents[2] / 'verify_static_assets.py')
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class ReleaseAssetTests(unittest.TestCase):
    def test_deployed_artifact_requires_font_and_matching_index(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            root = base / 'static'
            font = root / 'assets/____frontend/node_modules/icons.ttf'
            font.parent.mkdir(parents=True)
            font.write_bytes(b'font-data')
            index = root / 'index.html'
            index.write_bytes(b'<html>release\n</html>')
            manifest = base / 'manifest.json'
            manifest.write_text(json.dumps({'files': {p.relative_to(root).as_posix(): validator.digest(p) for p in (index, font)}}))
            self.assertEqual(validator.verify(root, manifest), 2)
            backend = Path(__file__).resolve().parents[2]
            for name in ['release_preflight.py', 'runtime_config.py', 'verify_static_assets.py']:
                shutil.copy2(backend / name, base / name)
            shutil.copy2(manifest, base / 'release-assets.json')
            env = dict(os.environ, SUPABASE_URL='http://127.0.0.1', SUPABASE_ANON_KEY='synthetic',
                       SUPABASE_SERVICE_KEY='synthetic', AUTH_SESSION_SECRET='synthetic-secret-with-at-least-32-characters')
            def preflight():
                return subprocess.run([sys.executable, '-B', str(base / 'release_preflight.py')],
                                      env=env, capture_output=True, text=True, timeout=15)
            self.assertEqual(preflight().returncode, 0)
            # Git may check text out as CRLF on Windows; binary bytes stay exact.
            index.write_bytes(b'<html>release\r\n</html>')
            self.assertEqual(validator.verify(root, manifest), 2)
            font.unlink()
            with self.assertRaisesRegex(ValueError, 'icons.ttf'):
                validator.verify(root, manifest)
            self.assertNotEqual(preflight().returncode, 0, 'Deployment must stop for the missing icon font')
            font.write_bytes(b'font-data')
            index.write_bytes(b'<html>unreviewed release</html>')
            with self.assertRaisesRegex(ValueError, 'index.html'):
                validator.verify(root, manifest)

    def test_missing_or_empty_manifest_cannot_pass(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            manifest = base / 'manifest.json'
            with self.assertRaises(FileNotFoundError):
                validator.verify(base, manifest)
            manifest.write_text('{"files": {}}')
            with self.assertRaises(ValueError):
                validator.verify(base, manifest)
