"""New labelled no-network PostgreSQL container only; never reads app config/data."""
import concurrent.futures
import json
import subprocess
import threading
import time
import postgres_concurrency_probe as pg

pg.CONTAINER='atylla-copy-qa-pg-20260915'
pg.LABEL='atylla-copy-20260915'
report_path=pg.ROOT/'docs/audits/WEEK_COPY_POSTGRES_2026-09-15.json'

def main():
    state=json.loads(pg.docker('inspect',pg.CONTAINER).stdout)[0]
    assert state['Config']['Labels']['codex.task']==pg.LABEL
    assert state['HostConfig']['NetworkMode']=='none'
    pg.sql("""CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;""")
    for name in ['schema.sql','migration_v2.1_rozliczenia_ssot.sql','release/atylla-2.1.3-supabase.sql','migrations/010_workout_event_sessions.sql','migrations/011_safe_week_copy.sql']:
        pg.sql((pg.ROOT/'database'/name).read_text(encoding='utf-8'))
    a,c,d=pg.uid(1),pg.uid(3),pg.uid(4)
    pg.sql(f"GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated; INSERT INTO auth.users VALUES ('{a}'); INSERT INTO clients(id,name,trainer_id) VALUES ('{c}','QA','{a}'),('{d}','Other QA','{a}');")
    monday=pg.sql("SELECT to_char(date_trunc('week',current_date+14),'YYYY-MM-DD');").stdout.decode().strip()
    auth=f"SET ROLE authenticated; SET request.jwt.claim.sub='{a}'; "
    def prepare(hour):
        items=[dict(key='qa',event_date=monday,event_hour=hour,client_id=c)]
        res=json.loads(pg.sql(auth+f"SELECT copy_week_safe_v1('{monday}','{json.dumps(items)}',false);").stdout)
        items[0]['fingerprint']=res['rows'][0]['fingerprint']
        return auth+f"SELECT copy_week_safe_v1('{monday}','{json.dumps(items)}',true);"
    query=prepare(9);barrier=threading.Barrier(2)
    def copy(_):
        barrier.wait(timeout=10)
        return pg.sql(query,check=False)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        answers=list(pool.map(copy,range(2)))
    assert sum(r.returncode==0 for r in answers)==1,[r.stderr.decode() for r in answers]
    assert pg.sql('SELECT count(*) FROM calendar_events;').stdout.strip()==b'1'
    results=['two_simultaneous_copies_one_commit_one_conflict']
    for hour,statement,label in [
        (12,f"INSERT INTO absences(client_id,absence_date,absence_hour,trainer_id) VALUES ('{c}','{monday}',12,'{a}')",'direct_absence'),
        (13,f"INSERT INTO calendar_events(client_id,event_date,event_hour,trainer_id) VALUES ('{d}','{monday}',13,'{a}')",'direct_calendar')]:
        query=prepare(hour)
        writer=subprocess.Popen(['docker','exec','-i',pg.CONTAINER,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        writer.stdin.write(f"BEGIN; SET application_name='{label}'; {statement}; SELECT pg_sleep(3); COMMIT;".encode());writer.stdin.close()
        for _ in range(100):
            if pg.sql(f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{label}' AND wait_event='PgSleep';").stdout.strip()==b'1':break
            time.sleep(.05)
        else:raise AssertionError('Direct writer not ready')
        reply=pg.sql(query,check=False);writer.wait(timeout=10)
        assert writer.returncode==0,writer.stderr.read().decode()
        assert reply.returncode!=0 and 'Odśwież' in reply.stderr.decode(),reply.stderr.decode()
        assert pg.sql(f"SELECT count(*) FROM calendar_events WHERE client_id='{c}' AND event_hour={hour};").stdout.strip()==b'0'
        results.append('copy_waits_for_'+label+'_and_rejects_stale_preview')
    return dict(status='PASS',scope='PostgreSQL 17, real concurrent connections; synthetic data; no network or Supabase',results=results)

if __name__=='__main__':
    try:report=main()
    except Exception as e:
        report={'status':'FAIL','error':str(e)}
        if isinstance(e,subprocess.CalledProcessError):report['stderr']=e.stderr.decode(errors='replace')
    report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True));raise SystemExit(report['status']!='PASS')
