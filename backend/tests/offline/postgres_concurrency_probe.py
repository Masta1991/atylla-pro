"""Disposable PostgreSQL container; synthetic schema, concurrent connections, restore.

Run explicitly, never discovered by the offline unittest runner. Container must
already exist with the exact task label and no network. No production .env read.
"""
import concurrent.futures
import json
import subprocess
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CONTAINER = 'atylla-session-qa-pg-20260914'
LABEL = 'atylla-session-20260914'
REPORT = ROOT / 'docs/audits/POSTGRES_CONCURRENCY_2026-09-14.json'
results = []


def docker(*args, data=None, check=True):
    return subprocess.run(['docker', *args], input=data, capture_output=True, check=check, timeout=90)


def sql(text, database='postgres', check=True):
    return docker('exec', '-i', CONTAINER, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
                  '-U', 'postgres', '-d', database, data=text.encode(), check=check)


def uid(n):
    return f'00000000-0000-4000-8000-{n:012d}'


def main():
    state = json.loads(docker('inspect', CONTAINER).stdout)[0]
    assert state['Config']['Labels']['codex.task'] == LABEL
    assert state['HostConfig']['NetworkMode'] == 'none'
    sql("""CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated,anon;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;""")
    for name in ['schema.sql', 'migration_v2.1_rozliczenia_ssot.sql', 'migrations/001_shared_packages.sql',
                 'migrations/007_audit_atomic_writes.sql', 'migrations/008_absence_billing.sql']:
        sql((ROOT / 'database' / name).read_text(encoding='utf-8'))
    results.append('schema_and_007_008_apply_on_PostgreSQL_17')
    a, b, c, e = map(uid, [1, 2, 3, 5])
    sql(f"""GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
      INSERT INTO auth.users VALUES ('{a}'),('{b}');
      INSERT INTO clients(id,name,trainer_id) VALUES ('{c}','Synthetic concurrency','{a}');
      INSERT INTO calendar_events(id,client_id,event_date,event_hour,trainer_id)
      VALUES ('{e}','{c}','2026-09-10',11,'{a}');""")
    stamp = sql(f"SELECT updated_at FROM calendar_events WHERE id='{e}';").stdout.decode().strip()
    payload = dict(client_id=c,event_date='2026-09-10',event_hour=11,expected_event_id=e,
                   expected_updated_at=stamp,exercises=[])
    barrier = threading.Barrier(2)
    def write(note):
        data = json.dumps(dict(payload, note=note))
        barrier.wait(timeout=10)
        return sql(f"BEGIN; SET ROLE authenticated; SET request.jwt.claim.sub='{a}'; "
                   f"SELECT save_calendar_workout_v3('{data}'::jsonb); COMMIT;", check=False)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        jobs = [pool.submit(write, name) for name in ['device-one','device-two']]
        answers = [j.result() for j in jobs]
    assert sum(r.returncode == 0 for r in answers) == 1, [(r.returncode,r.stderr.decode()) for r in answers]
    results.append('two_connections_same_version_exactly_one_commit')
    before = sql(f"SELECT row_to_json(x) FROM calendar_events x WHERE id='{e}';").stdout
    invalid = json.dumps(dict(payload,expected_updated_at=None,expected_event_id=None,note='invalid'))
    failed = sql(f"BEGIN; SET ROLE authenticated; SET request.jwt.claim.sub='{b}'; "
                 f"SELECT save_calendar_workout_v3('{invalid}'::jsonb); COMMIT;", check=False)
    assert failed.returncode != 0
    assert sql(f"SELECT row_to_json(x) FROM calendar_events x WHERE id='{e}';").stdout == before
    results.append('foreign_user_rejected_without_mutation')
    dump = docker('exec',CONTAINER,'pg_dump','-U','postgres','-Fc','postgres').stdout
    sql('CREATE DATABASE atylla_restore_qa;')
    docker('exec','-i',CONTAINER,'pg_restore','-U','postgres','-d','atylla_restore_qa','--exit-on-error',data=dump)
    restored = sql(f"SELECT row_to_json(x) FROM calendar_events x WHERE id='{e}';",database='atylla_restore_qa').stdout
    assert restored == before
    results.append('synthetic_database_dump_restore_preserves_event')
    return dict(status='PASS',scope='PostgreSQL 17 container, actual SQL, two connections and synthetic dump/restore; no PostgREST or live Supabase',
                results=results,dump_bytes=len(dump),container_network='none')


if __name__ == '__main__':
    try:
        report = main()
    except Exception as exc:
        report = dict(status='FAIL',results=results,error=str(exc))
        if isinstance(exc,subprocess.CalledProcessError): report['stderr'] = exc.stderr.decode(errors='replace')
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True))
    raise SystemExit(0 if report['status']=='PASS' else 1)
