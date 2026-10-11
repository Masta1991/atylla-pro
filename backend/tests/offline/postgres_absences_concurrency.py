"""Explicit local PostgreSQL concurrency probe. Synthetic data, no app env/network."""
import concurrent.futures
import json
import subprocess
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CONTAINER = 'atylla-absences-qa-pg-20261011'
LABEL = 'atylla-absences-20261011'
OUT = ROOT / '.tmp/absences-20261011/concurrency-report.json'
UID = lambda n: f'00000000-0000-4000-8000-{n:012d}'
A, C, D = map(UID, (1, 3, 4))
AUTH = f"SET ROLE authenticated; SET request.jwt.claim.sub='{A}'; "

def docker(*args, data=None, check=True):
    return subprocess.run(['docker', *args], input=data, capture_output=True, check=check, timeout=30)

def sql(query, check=True):
    return docker('exec', '-i', CONTAINER, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'absence_concurrency', data=query.encode(), check=check)

def scalar(query):
    return sql(query).stdout.decode().strip()

def main():
    state = json.loads(docker('inspect', CONTAINER).stdout)[0]
    assert state['Config']['Labels']['codex.task'] == LABEL
    assert state['HostConfig']['NetworkMode'] == 'none'
    docker('exec', CONTAINER, 'createdb', '-U', 'postgres', 'absence_concurrency')
    sql("CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;")
    for name in ['schema.sql', 'migration_v2.1_rozliczenia_ssot.sql', 'release/atylla-2.1.3-supabase.sql', 'migrations/010_workout_event_sessions.sql', 'migrations/011_safe_week_copy.sql', 'migrations/015_absence_contract.sql']:
        sql((ROOT / 'database' / name).read_text('utf-8'))
    sql(f"GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated; INSERT INTO auth.users VALUES ('{A}'); INSERT INTO clients(id,name,trainer_id,training_schedule) VALUES ('{C}','QA','{A}','[{{\"day\":0,\"hour\":9}},{{\"day\":0,\"hour\":11}},{{\"day\":0,\"hour\":12}}]'),('{D}','Other QA','{A}','[]');")
    day = scalar("SELECT to_char(date_trunc('week',current_date+14),'YYYY-MM-DD');")
    def schedule(hour):
        return dict(client_id=C, absence_date=day, absence_hour=hour, paid=False, mode='schedule', expected_event_id=None, expected_updated_at=None)
    def record(payload):
        return AUTH + "SELECT record_absence_v4('" + json.dumps(payload) + "'::jsonb);"
    def simultaneous(query):
        barrier = threading.Barrier(2)
        def worker(_):
            barrier.wait(timeout=10)
            return sql(query, check=False)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            replies = list(pool.map(worker, range(2)))
        assert all(r.returncode == 0 for r in replies), [r.stderr.decode() for r in replies]
        assert replies[0].stdout == replies[1].stdout
    results = []
    simultaneous(record(schedule(9)))
    assert scalar('SELECT count(*) FROM absences;') == '1'
    assert scalar('SELECT count(*) FROM calendar_events;') == '0'
    results.append('simultaneous_schedule_is_idempotent_without_event')
    event = json.loads(scalar(f"INSERT INTO calendar_events(trainer_id,client_id,event_date,event_hour) VALUES ('{A}','{C}','{day}',10) RETURNING row_to_json(calendar_events);"))
    payload = dict(client_id=C, absence_date=day, absence_hour=10, mode='cancel', paid=True, expected_event_id=event['id'], expected_updated_at=event['updated_at'])
    simultaneous(record(payload))
    assert scalar('SELECT count(*) FROM calendar_events WHERE status=\'cancelled\' AND is_settled;') == '1'
    assert scalar('SELECT count(*) FROM absences WHERE absence_hour=10;') == '1'
    results.append('simultaneous_cancellation_preserves_one_event_and_marker')
    def conflicting_writer(statement, query, name, expected):
        writer = subprocess.Popen(['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','absence_concurrency'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        writer.stdin.write(f"BEGIN; SET application_name='{name}'; {statement}; SELECT pg_sleep(2); COMMIT;".encode())
        writer.stdin.close()
        for _ in range(60):
            if scalar(f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{name}' AND wait_event='PgSleep';") == '1':
                break
            time.sleep(.05)
        else:
            raise AssertionError('Writer did not become ready')
        reply = sql(query, check=False)
        writer.wait(timeout=15)
        assert writer.returncode == 0, writer.stderr.read().decode()
        assert reply.returncode != 0 and expected in reply.stderr.decode(), reply.stderr.decode()
    conflicting_writer(f"INSERT INTO calendar_events(trainer_id,client_id,event_date,event_hour) VALUES ('{A}','{D}','{day}',11)", record(schedule(11)), 'absence_booking_race', 'Termin został zmieniony')
    assert scalar('SELECT count(*) FROM absences WHERE absence_hour=11;') == '0'
    assert scalar(f"SELECT client_id FROM calendar_events WHERE event_hour=11;") == D
    results.append('schedule_waits_for_booking_and_preserves_other_client')
    conflicting_writer(f"UPDATE clients SET training_schedule='[]' WHERE id='{C}'", record(schedule(12)), 'absence_schedule_race', 'harmonogramu')
    assert scalar('SELECT count(*) FROM absences WHERE absence_hour=12;') == '0'
    results.append('schedule_waits_for_profile_update_and_rejects_removed_slot')
    return dict(status='PASS', scope='PostgreSQL 17, multiple connections, synthetic data, isolated no-network container', results=results)

if __name__ == '__main__':
    try:
        report = main()
    except Exception as error:
        report = dict(status='FAIL', error=str(error))
        if isinstance(error, subprocess.CalledProcessError):
            report['stderr'] = error.stderr.decode(errors='replace')
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=True))
    raise SystemExit(report['status'] != 'PASS')
