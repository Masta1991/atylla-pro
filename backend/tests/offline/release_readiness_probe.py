"""Focused local acceptance gate for the previously reproduced billing blocker.

API failure contracts plus real SQL read-failure/rollback checks. This gate does
not certify live Supabase, deployment or multi-connection concurrency.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
results = []
for command in [
    [sys.executable, '-B', '-m', 'unittest', 'discover', '-s', 'backend/tests/offline', '-p', 'test_atomic_billing.py'],
    ['node', 'backend/tests/offline/postgres_billing.test.cjs'],
]:
    run = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', timeout=60)
    results.append(dict(command=command, exit_code=run.returncode, output=run.stdout, error=run.stderr))
report = dict(status='PASS' if all(r['exit_code']==0 for r in results) else 'BLOCKS_DEPLOYMENT',
              scope='API failure contracts and real local SQL; synthetic data; no production certification',
              results=results)
(ROOT/'docs/audits/ATOMIC_BILLING_READINESS_2026-09-14.json').write_text(
    json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True))
raise SystemExit(0 if report['status']=='PASS' else 1)
