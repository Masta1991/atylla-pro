"""Offline regression runner for Atylla Pro. No Supabase, mail or deployment.

The report describes its scope; PASS never claims browser or PostgreSQL coverage.
"""
import argparse
import json
import subprocess
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TESTS = ROOT / "backend/tests/offline"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cycles", "--iterations", type=int, default=1)
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument('--postgres', action='store_true', help='Run local PGlite SQL tests (requires .tmp/billing-qa dependencies)')
    args = parser.parse_args()
    if not 1 <= args.cycles <= 20:
        parser.error("cycles must be between 1 and 20")
    sys.dont_write_bytecode = True
    results = []
    passed = True
    for cycle in range(1, args.cycles + 1):
        suite = unittest.defaultTestLoader.discover(str(TESTS), pattern="test_*.py")
        result = unittest.TextTestRunner(verbosity=2 if args.verbose else 1).run(suite)
        passed = passed and result.wasSuccessful()
        results.append({"cycle": cycle, "tests": result.testsRun,
                        "failures": len(result.failures), "errors": len(result.errors)})
    frontend = []
    scripts = ['backend/tests/offline/frontend_api.test.cjs', 'backend/tests/offline/frontend_billing.test.cjs', 'scripts/check-frontend.cjs']
    if args.postgres:
        scripts.append('backend/tests/offline/postgres_billing.test.cjs')
        scripts.append('backend/tests/offline/postgres_sessions.test.cjs')
        scripts.append('backend/tests/offline/postgres_week_copy.test.cjs')
    for script in scripts:
        try:
            run = subprocess.run(["node", str(ROOT / script)], cwd=ROOT,
                                 capture_output=True, text=True, encoding="utf-8", timeout=60)
            passed = passed and run.returncode == 0
            frontend.append({"script": script, "exit_code": run.returncode,
                             "output": run.stdout.strip(), "error": run.stderr.strip()})
        except (OSError, subprocess.TimeoutExpired) as error:
            passed = False
            frontend.append({"script": script, "error": str(error)})
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall_status": "PASS" if passed else "FAIL",
        "scope": 'offline Python/API, frontend module' + (' and PGlite PostgreSQL/RLS/rollback' if args.postgres else '') + '; synthetic data',
        "not_verified": ([] if args.postgres else ['PostgreSQL execution/RLS/transactions']) + ['multi-connection concurrency', 'Supabase/PostgREST integration', 'browser/device E2E', 'deployed production'],
        "cycles": results, "frontend": frontend,
    }
    report_file = Path(__file__).parent / "latest_test_report.json"
    report_file.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=True))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
