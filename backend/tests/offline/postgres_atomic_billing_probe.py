"""Dedicated no-network PostgreSQL container; never uses production config."""
import concurrent.futures
import json
import threading
import postgres_concurrency_probe as pg

pg.CONTAINER = 'atylla-billing-qa-pg-20260914'
pg.LABEL = 'atylla-billing-20260914'
REPORT = pg.ROOT / 'docs/audits/ATOMIC_BILLING_POSTGRES_2026-09-14.json'


def main():
    report = pg.main()
    pg.sql((pg.ROOT / 'database/migrations/009_atomic_billing_cycles.sql').read_text(encoding='utf-8'))
    a, m = pg.uid(1), pg.uid(101)
    pg.sql(f"""INSERT INTO clients(id,name,trainer_id,billing_type,package_purchase_date)
      VALUES ('{m}','Synthetic monthly','{a}','single','2020-01-01');
      INSERT INTO calendar_events(client_id,event_date,event_hour,trainer_id)
      VALUES ('{m}','2020-01-01',6,'{a}');""")

    def race(actions):
        stamp = pg.sql(f"SELECT updated_at FROM clients WHERE id='{m}';").stdout.decode().strip()
        barrier = threading.Barrier(2)
        def write(action):
            barrier.wait(timeout=10)
            return pg.sql(f"BEGIN; SET ROLE authenticated; SET request.jwt.claim.sub='{a}'; "
                f"SELECT billing_cycle_v1('{m}','{action}','{stamp}','2020-01-01'); COMMIT;", check=False)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            answers = list(pool.map(write, actions))
        assert sum(x.returncode == 0 for x in answers) == 1, [x.stderr.decode() for x in answers]
        assert 'Rozliczenie' in next(x.stderr.decode() for x in answers if x.returncode != 0)

    race(['close','close'])
    assert pg.sql(f"SELECT payment_history->0->>'completed_count' FROM clients WHERE id='{m}';").stdout.strip() == b'1'
    assert pg.sql(f"SELECT jsonb_array_length(payment_history) FROM clients WHERE id='{m}';").stdout.strip() == b'1'
    pg.results.append('two_monthly_closes_one_commit_one_version_conflict')
    pg.sql(f"UPDATE clients SET package_purchase_date='2020-01-01',updated_at=clock_timestamp() WHERE id='{m}';")
    race(['close','reset'])
    pg.results.append('close_vs_reset_one_commit_one_version_conflict')
    race(['reset','reset'])
    pg.results.append('two_resets_one_commit_one_version_conflict')
    # A direct REST-style writer is covered too: keep an event UPDATE pending,
    # then confirm the close waits for it and counts the committed cancellation.
    pg.sql(f"UPDATE clients SET package_purchase_date='2020-01-01',payment_history='[]',updated_at=clock_timestamp() WHERE id='{m}';")
    stamp = pg.sql(f"SELECT updated_at FROM clients WHERE id='{m}';").stdout.decode().strip()
    import subprocess
    writer = subprocess.Popen(['docker','exec','-i',pg.CONTAINER,'psql','-X','-qAt',
        '-v','ON_ERROR_STOP=1','-U','postgres'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    # pg_sleep keeps the transaction open; observing pg_stat_activity below
    # makes the ordering deterministic without assuming process startup speed.
    writer.stdin.write(f"BEGIN; SET application_name='atylla-direct-write'; UPDATE calendar_events SET status='deleted' WHERE client_id='{m}'; SELECT pg_sleep(3); COMMIT;".encode())
    writer.stdin.close()
    import time
    for _ in range(100):
        if pg.sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='atylla-direct-write' AND wait_event='PgSleep';").stdout.strip() == b'1':
            break
        time.sleep(.05)
    else:
        raise AssertionError('Direct writer did not enter held transaction')
    out = pg.sql(f"BEGIN; SET ROLE authenticated; SET request.jwt.claim.sub='{a}'; SELECT billing_cycle_v1('{m}','close','{stamp}','2020-01-01'); COMMIT;")
    writer.wait(timeout=10)
    assert writer.returncode == 0, writer.stderr.read().decode()
    assert pg.sql(f"SELECT payment_history->0->>'completed_count' FROM clients WHERE id='{m}';").stdout.strip() == b'0'
    pg.results.append('monthly_close_waits_for_direct_calendar_writer_and_counts_committed_state')
    report.update(results=pg.results, scope='PostgreSQL 17; real concurrent connections, version conflicts, direct writer, synthetic data; no Supabase/PostgREST')
    return report


if __name__ == '__main__':
    try:
        report = main()
    except Exception as exc:
        report = dict(status='FAIL',results=pg.results,error=str(exc))
        if hasattr(exc,'stderr'): report['stderr'] = exc.stderr.decode(errors='replace')
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True))
    raise SystemExit(0 if report['status']=='PASS' else 1)
