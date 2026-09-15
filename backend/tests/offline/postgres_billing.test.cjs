// Actual PostgreSQL engine (PGlite), synthetic schema and users, no network.
// Not a Supabase/PostgREST deployment test or a multi-connection concurrency test.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { PGlite } = require(path.join(root, '.tmp/billing-qa/node_modules/@electric-sql/pglite'));
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A=id(1), B=id(2), C=id(3), D=id(4), E=id(5), F=id(6), P=id(7), X=id(8), Y=id(9), G=id(10);
const results=[];
async function q(sql, args=[]) { return (await db.query(sql,args)).rows; }
async function actor(uid, role='authenticated') {
  await db.exec(`RESET ROLE; SET ROLE ${role};`);
  await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid]);
}
async function reject(sql, args, regex) {
  await assert.rejects(q(sql,args),regex);
}
async function test(name, fn) { await fn(); results.push({name,status:'PASS'}); }
const mutation = (action,data) => q('SELECT calendar_mutation_v2($1,$2::jsonb) AS result',[action,JSON.stringify(data)]);
const absence = (paid, hour=11) => q('SELECT record_absence_v3($1::jsonb) AS result', [JSON.stringify({client_id:C,absence_date:'2026-09-10',absence_hour:hour,paid})]);
(async()=>{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;`);
  for (const file of ['schema.sql','migration_v2.1_rozliczenia_ssot.sql','migrations/001_shared_packages.sql',
      'migrations/007_audit_atomic_writes.sql','migrations/008_absence_billing.sql','migrations/009_atomic_billing_cycles.sql',
      'migrations/010_workout_event_sessions.sql']) {
    await db.exec(fs.readFileSync(path.join(root,'database',file),'utf8'));
  }
  await db.exec(`GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
    INSERT INTO auth.users VALUES ('${A}'),('${B}');
    INSERT INTO clients(id,name,trainer_id) VALUES ('${C}','Synthetic A','${A}'),('${D}','Synthetic B','${B}');
    INSERT INTO muscle_groups(id,name,trainer_id) VALUES ('${G}','Synthetic','${A}');
    INSERT INTO exercises(id,name,muscle_group_id,trainer_id) VALUES ('${X}','Owned','${G}','${A}'),('${Y}','Foreign','${G}','${B}');
    INSERT INTO calendar_events(id,client_id,event_date,event_hour,trainer_id) VALUES
      ('${E}','${C}','2026-09-10',11,'${A}'),('${F}','${C}','2026-09-11',11,'${A}');
    INSERT INTO client_packages(id,client_id,start_training_id,trainer_id) VALUES ('${P}','${C}','${E}','${A}');`);
  await actor(A);
  await test('paid_free_paid_and_repeated_request_are_atomic_and_idempotent',async()=>{
    await absence(true); await absence(true);
    assert.equal((await q('SELECT * FROM absences')).length,1);
    assert.equal((await q('SELECT status FROM calendar_events WHERE id=$1',[E]))[0].status,'cancelled');
    await absence(false);
    const row=(await q('SELECT status,is_settled FROM calendar_events WHERE id=$1',[E]))[0];
    assert.deepEqual(row,{status:'deleted',is_settled:false});
    assert.equal((await q('SELECT start_training_id FROM client_packages WHERE id=$1',[P]))[0].start_training_id,E);
    await absence(true);
  });
  await test('whole_day_null_hour_request_does_not_duplicate',async()=>{
    await absence(false,null); await absence(false,null);
    assert.equal((await q('SELECT * FROM absences WHERE absence_hour IS NULL')).length,1);
  });
  await test('free_anchor_can_be_rebooked_explicitly_with_version_check',async()=>{
    const old=(await q('SELECT * FROM calendar_events WHERE id=$1',[E]))[0];
    const payload={client_id:C,event_date:'2026-09-10',event_hour:11,expected_event_id:E,
      expected_updated_at:old.updated_at,reactivate:true,exercises:[]};
    await q('SELECT save_calendar_workout_v3($1::jsonb)',[JSON.stringify(payload)]);
    assert.equal((await q('SELECT status FROM calendar_events WHERE id=$1',[E]))[0].status,'active');
    assert.equal((await q('SELECT start_training_id FROM client_packages'))[0].start_training_id,E);
    await absence(false);
  });
  await test('bulk_week_cannot_silently_cancel_open_package',async()=>{
    const before=await q('SELECT * FROM calendar_events ORDER BY id');
    await assert.rejects(mutation('clear_week',{monday_date:'2026-09-07'}),/aktywnego pakietu/);
    assert.deepEqual(await q('SELECT * FROM calendar_events ORDER BY id'),before);
    assert.equal((await q('SELECT * FROM client_packages')).length,1);
  });
  await test('foreign_trainer_cannot_change_absence_or_calendar',async()=>{
    await actor(B);
    await assert.rejects(absence(true),/Client not owned/);
    assert.equal((await q('SELECT * FROM calendar_events')).length,0);
    await actor(A);
  });
  await test('anon_cannot_execute_any_write_rpc',async()=>{
    await actor('', 'anon');
    await assert.rejects(absence(true),/permission denied/);
    await assert.rejects(mutation('clear_week',{monday_date:'2026-09-07'}),/permission denied/);
    await reject('SELECT save_workout_batch_v2($1,$2,1,$3,$4)',[C,'2026-09-10',A,'[]'],/permission denied/);
    await actor(A);
  });
  await test('workout_batch_failure_rolls_back_deleted_logs',async()=>{
    await q('SELECT save_workout_batch_v2($1,$2,1,$3,$4)',[C,'2026-09-10',A,JSON.stringify([{exercise_id:X,weight_kg:10,reps:5}])]);
    const before=await q('SELECT * FROM workout_logs');
    await reject('SELECT save_workout_batch_v2($1,$2,1,$3,$4)',[C,'2026-09-10',A,JSON.stringify([{exercise_id:X,weight_kg:'invalid'}])],/invalid input/);
    assert.deepEqual(await q('SELECT * FROM workout_logs'),before);
    await reject('SELECT save_workout_batch_v2($1,$2,1,$3,$4)',[C,'2026-09-10',A,'[]'],/1 do 1000/);
    await reject('SELECT save_workout_batch_v2($1,$2,1,$3,$4)',[C,'2026-09-10',A,JSON.stringify([{exercise_id:Y}])],/Exercise not owned/);
    await reject('SELECT save_workout_batch_v2($1,$2,1,$3,$4)',[C,'2026-09-10',B,JSON.stringify([{exercise_id:X}])],/Unauthorized/);
    assert.deepEqual(await q('SELECT * FROM workout_logs'),before);
  });
  await test('swap_preserves_event_id_package_anchor_and_moves_logs',async()=>{
    await absence(true);
    await mutation('swap',{date1:'2026-09-10',hour1:11,date2:'2026-09-12',hour2:11});
    assert.equal((await q('SELECT event_date::text FROM calendar_events WHERE id=$1',[E]))[0].event_date,'2026-09-12');
    assert.equal((await q('SELECT session_date::text FROM workout_logs'))[0].session_date,'2026-09-12');
    assert.equal((await q('SELECT start_training_id FROM client_packages'))[0].start_training_id,E);
    await mutation('swap',{date1:'2026-09-12',hour1:11,date2:'2026-09-10',hour2:11});
  });
  await test('closed_package_absence_delete_and_move_roll_back',async()=>{
    await q("INSERT INTO calendar_events(client_id,event_date,event_hour,trainer_id) VALUES ($1,'2026-09-10',15,$2)",[C,A]);
    await q('UPDATE client_packages SET end_training_id=$1 WHERE id=$2',[F,P]);
    const before=await q('SELECT * FROM calendar_events ORDER BY id');
    const absBefore=await q('SELECT * FROM absences ORDER BY id');
    await assert.rejects(absence(false),/zamkniętego pakietu/);
    await reject('DELETE FROM calendar_events WHERE id=$1',[F],/zamkniętego pakietu/);
    await assert.rejects(mutation('swap',{date1:'2026-09-11',hour1:11,date2:'2026-09-12',hour2:11}),/zamkniętego pakietu/);
    assert.deepEqual(await q('SELECT * FROM calendar_events ORDER BY id'),before);
    assert.deepEqual(await q('SELECT * FROM absences ORDER BY id'),absBefore);
    assert.equal((await q('SELECT end_training_id FROM client_packages'))[0].end_training_id,F);
  });
  await test('closed_interior_billing_fact_is_protected',async()=>{
    await reject("UPDATE calendar_events SET status='deleted' WHERE event_hour=15",[],/zamkniętego pakietu/);
  });
  await test('cannot_insert_backdated_session_into_closed_package',async()=>{
    await reject("INSERT INTO calendar_events(client_id,event_date,event_hour,trainer_id) VALUES ($1,'2026-09-10',16,$2)",[C,A],/zamkniętego pakietu/);
  });
  await test('combined_calendar_workout_save_rollback_version_and_empty_logs',async()=>{
    const save = p => q('SELECT save_calendar_workout_v3($1::jsonb) AS result',[JSON.stringify(p)]);
    const payload={client_id:C,event_date:'2026-09-20',event_hour:11,note:'Before',exercises:[{exercise_id:X,weight_kg:10,reps:5}]};
    const saved=(await save(payload))[0].result;
    const update={...payload,expected_event_id:saved.event.id,expected_updated_at:saved.event.updated_at};
    await assert.rejects(save({...update,note:'Partial',exercises:[{exercise_id:X,weight_kg:'bad'}]}),/invalid input/);
    assert.equal((await q('SELECT note FROM calendar_events WHERE id=$1',[saved.event.id]))[0].note,'Before');
    const second=(await save({...update,note:'After',exercises:[]}))[0].result;
    assert.equal((await q("SELECT * FROM workout_logs WHERE session_date='2026-09-20'")).length,1);
    await assert.rejects(save({...update,note:'Stale'}),/został zmieniony/);
    assert.equal((await q('SELECT note FROM calendar_events WHERE id=$1',[saved.event.id]))[0].note,'After');
    await assert.rejects(save(payload),/został zmieniony/);
    await actor(B);
    await assert.rejects(save({...update,expected_updated_at:second.event.updated_at}),/Client not owned/);
    await actor(A);
  });
  const M=id(101), N=id(102), MP=id(103);
  await q("INSERT INTO clients(id,name,trainer_id,billing_type,package_purchase_date,shared_monthly_with) VALUES ($1,'Monthly',$3,'single','2020-01-01',ARRAY[$2::uuid]),($2,'Peer',$3,'single','2020-01-01',ARRAY[$1::uuid])",[M,N,A]);
  await q("INSERT INTO calendar_events(client_id,event_date,event_hour,trainer_id) SELECT $1,'2020-01-01'::date+i,6,$2 FROM generate_series(0,1004) i",[M,A]);
  await q("INSERT INTO calendar_events(client_id,event_date,event_hour,trainer_id,status,is_settled) VALUES ($1,'2020-01-01',7,$2,'cancelled',true),($1,'2020-01-01',8,$2,'cancelled',false),($1,'2020-01-01',9,$2,'deleted',false),($1,'2099-01-01',6,$2,'active',false)",[N,A]);
  const version = async cid => (await q('SELECT updated_at::text AS version FROM clients WHERE id=$1',[cid]))[0].version;
  const cycle = (cid,action,stamp,end='2024-01-01') => q('SELECT billing_cycle_v1($1,$2,$3,$4) AS result',[cid,action,stamp,end]);
  await test('monthly_read_failure_leaves_cycle_and_history_unchanged',async()=>{
    const before=await q('SELECT * FROM clients WHERE id=$1',[M]), stamp=await version(M);
    await db.exec('RESET ROLE; REVOKE SELECT ON calendar_events FROM authenticated;');
    await actor(A);
    await assert.rejects(cycle(M,'close',stamp),/permission denied/);
    assert.deepEqual(await q('SELECT * FROM clients WHERE id=$1',[M]),before);
    await db.exec('RESET ROLE; GRANT SELECT ON calendar_events TO authenticated;');
    await actor(A);
  });
  await test('monthly_count_all_pages_shared_paid_free_and_repeat',async()=>{
    const stamp=await version(M);
    const closed=(await cycle(M,'close',stamp))[0].result;
    assert.equal(closed.payment_history.at(-1).completed_count,1006);
    assert.equal(closed.package_purchase_date,null);
    await assert.rejects(cycle(M,'close',stamp),/zostało zmienione/);
    assert.equal((await q('SELECT payment_history FROM clients WHERE id=$1',[M]))[0].payment_history.length,1);
  });
  await test('invalid_date_missing_version_and_foreign_user_do_not_write',async()=>{
    const stamp=await version(N), before=await q('SELECT * FROM clients WHERE id=$1',[N]);
    await assert.rejects(cycle(N,'close',stamp,'2019-01-01'),/przed startem/);
    await assert.rejects(cycle(N,'close',null),/zostało zmienione/);
    await actor(B);
    await assert.rejects(cycle(N,'reset',stamp),/Client not owned/);
    await actor('','anon');
    await assert.rejects(cycle(N,'reset',stamp),/permission denied/);
    await actor(A);
    assert.deepEqual(await q('SELECT * FROM clients WHERE id=$1',[N]),before);
  });
  await q('INSERT INTO client_packages(id,client_id,start_training_id,trainer_id,shared_client_ids) VALUES ($1,$2,$3,$4,ARRAY[$5::uuid])',[MP,N,E,A,M]);
  await q('UPDATE client_packages SET shared_client_ids=ARRAY[$1::uuid] WHERE id=$2',[N,P]);
  await test('reset_failure_after_deletion_rolls_back_packages_and_membership',async()=>{
    const stamp=await version(N), cs=await q('SELECT * FROM clients ORDER BY id'), ps=await q('SELECT * FROM client_packages ORDER BY id');
    await db.exec(`RESET ROLE; CREATE FUNCTION fail_reset_qa() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.id='${N}'::uuid THEN RAISE EXCEPTION 'Injected reset failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_reset_qa BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION fail_reset_qa();`);
    await actor(A);
    await assert.rejects(cycle(N,'reset',stamp),/Injected reset failure/);
    assert.deepEqual(await q('SELECT * FROM clients ORDER BY id'),cs);
    assert.deepEqual(await q('SELECT * FROM client_packages ORDER BY id'),ps);
    await db.exec('RESET ROLE; DROP TRIGGER fail_reset_qa ON clients; DROP FUNCTION fail_reset_qa();');
    await actor(A);
  });
  await test('reset_cleans_both_directions_preserves_history_and_rejects_stale_retry',async()=>{
    const stamp=await version(N);
    const reset=(await cycle(N,'reset',stamp))[0].result;
    assert.equal(reset.package_size,0);
    assert.equal(reset.package_purchase_date,null);
    assert.deepEqual(reset.shared_monthly_with,[]);
    assert.equal((await q('SELECT * FROM client_packages WHERE client_id=$1',[N])).length,0);
    assert.deepEqual((await q('SELECT shared_client_ids FROM client_packages WHERE id=$1',[P]))[0].shared_client_ids,[]);
    assert.deepEqual((await q('SELECT shared_monthly_with FROM clients WHERE id=$1',[M]))[0].shared_monthly_with,[]);
    assert.equal((await q('SELECT payment_history FROM clients WHERE id=$1',[M]))[0].payment_history.length,1);
    await assert.rejects(cycle(N,'reset',stamp),/zostało zmienione/);
  });
  console.log(JSON.stringify({engine:'PGlite PostgreSQL',scope:'real SQL, RLS, FK, rollback; synthetic local data',tests:results}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.close());
