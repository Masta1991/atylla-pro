// Actual local PostgreSQL/PGlite; synthetic trainers only, no network.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const {PGlite}=require(path.join(root,'.tmp/billing-qa/node_modules/@electric-sql/pglite'));
const db=new PGlite(),results=[];
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),B=id(2),C=id(3),D=id(4),X=id(5),G=id(6),L=id(7),E=id(8),F=id(9),H=id(10);
const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
const run=async(name,fn)=>{await fn();results.push({name,status:'PASS'});};
const migrate=()=>db.exec(fs.readFileSync(path.join(root,'database/migrations/010_workout_event_sessions.sql'),'utf8'));
const as=async(uid,role='authenticated')=>{await db.exec('RESET ROLE; SET ROLE '+role);await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid]);};
const save=async body=>(await q('SELECT save_calendar_workout_v4($1::jsonb) result',[JSON.stringify(body)]))[0].result;
const logs=event=>q('SELECT * FROM workout_logs WHERE calendar_event_id=$1 ORDER BY id',[event]);
const edit=async(event,exercises)=>{const ev=(await q('SELECT * FROM calendar_events WHERE id=$1',[event]))[0];return save({client_id:ev.client_id,event_date:ev.event_date,event_hour:ev.event_hour,expected_event_id:ev.id,expected_updated_at:ev.updated_at,exercises});};
const ex=weight=>[{exercise_id:X,weight_kg:weight,reps:5}];
const mutate=(action,data)=>q('SELECT calendar_mutation_v2($1,$2::jsonb)',[action,JSON.stringify(data)]);
(async()=>{
 await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;");
 for(const f of ['schema.sql','migration_v2.1_rozliczenia_ssot.sql','release/atylla-2.1.3-supabase.sql'])await db.exec(fs.readFileSync(path.join(root,'database',f),'utf8'));
 await db.exec(`GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
 INSERT INTO auth.users VALUES ('${A}'),('${B}');
 INSERT INTO clients(id,name,trainer_id) VALUES ('${C}','Session QA','${A}'),('${D}','Other trainer','${B}'),('${L}','Legacy QA','${A}');
 INSERT INTO muscle_groups(id,name,trainer_id) VALUES ('${G}','QA','${A}');
 INSERT INTO exercises(id,name,muscle_group_id,trainer_id) VALUES ('${X}','QA exercise','${G}','${A}');
 INSERT INTO calendar_events(id,client_id,event_date,event_hour,trainer_id) VALUES
 ('${E}','${L}','2020-01-01',9,'${A}'),('${F}','${L}','2020-01-02',9,'${A}'),('${H}','${L}','2020-01-02',12,'${A}');
 INSERT INTO workout_logs(client_id,exercise_id,session_date,week_number,trainer_id,weight_kg) VALUES
 ('${L}','${X}','2020-01-01',1,'${A}',10),('${L}','${X}','2020-01-02',1,'${A}',20);`);
 await run('migration_links_only_unambiguous_history_and_is_repeatable',async()=>{
   await migrate();await migrate();
   assert.equal((await logs(E)).length,1);
   assert.equal((await q('SELECT * FROM workout_logs WHERE calendar_event_id IS NULL')).length,1);
 });
 await as(A);
 let first,second,third;
 const base={client_id:C,event_date:'2020-02-01',event_hour:9,exercises:ex(10)};
 await run('second_session_requires_confirmation_without_partial_writes',async()=>{
   first=await save(base);
   const before=await q('SELECT * FROM calendar_events ORDER BY id');
   await assert.rejects(save({...base,event_hour:12,exercises:ex(20)}),/DUPLICATE_SESSION_CONFIRMATION_REQUIRED/);
   assert.deepEqual(await q('SELECT * FROM calendar_events ORDER BY id'),before);
   assert.equal((await logs(first.event.id))[0].weight_kg,'10.00');
 });
 await run('confirmed_sessions_have_independent_exercises_and_empty_new_session',async()=>{
   second=await save({...base,event_hour:12,confirm_duplicate:true,exercises:ex(20)});
   third=await save({...base,event_hour:15,confirm_duplicate:true,exercises:[]});
   assert.equal((await logs(first.event.id))[0].weight_kg,'10.00');
   assert.equal((await logs(second.event.id))[0].weight_kg,'20.00');
   assert.equal((await logs(third.event.id)).length,0);
 });
 await run('edit_clear_and_stale_save_do_not_change_other_session',async()=>{
   const stale=second.event;
   await edit(second.event.id,ex(25));
   await assert.rejects(save({...base,event_hour:12,expected_event_id:stale.id,expected_updated_at:stale.updated_at}),/Odśwież/);
   await edit(second.event.id,[]);
   assert.equal((await logs(second.event.id)).length,0);
   assert.equal((await logs(first.event.id))[0].weight_kg,'10.00');
   await edit(second.event.id,ex(25));
 });
 await run('invalid_log_rolls_back_both_calendar_metadata_and_log_replacement',async()=>{
   const before=(await q('SELECT * FROM calendar_events WHERE id=$1',[second.event.id]))[0];
   const beforeLogs=await logs(second.event.id);
   await assert.rejects(save({client_id:C,event_date:before.event_date,event_hour:before.event_hour,expected_event_id:before.id,expected_updated_at:before.updated_at,note:'must rollback',exercises:[{exercise_id:X,weight_kg:'invalid'}]}),/invalid input/);
   assert.deepEqual((await q('SELECT * FROM calendar_events WHERE id=$1',[second.event.id]))[0],before);
   assert.deepEqual(await logs(second.event.id),beforeLogs);
 });
 await run('legacy_day_writer_cannot_overwrite_multiple_sessions',async()=>{
   await assert.rejects(q('SELECT save_workout_batch_v2($1,$2,1,$3,$4::jsonb)',[C,'2020-02-01',A,JSON.stringify(ex(99))]),/konkretny trening/);
   assert.equal((await logs(first.event.id))[0].weight_kg,'10.00');
 });
 await run('same_day_swap_and_cross_day_move_follow_event_identity',async()=>{
   await mutate('swap',{date1:'2020-02-01',hour1:9,date2:'2020-02-01',hour2:12});
   await mutate('swap',{date1:'2020-02-01',hour1:9,date2:'2020-02-02',hour2:10});
   assert.equal(new Date((await logs(second.event.id))[0].session_date).toISOString().slice(0,10),'2020-02-02');
   assert.equal((await logs(second.event.id))[0].weight_kg,'25.00');
   assert.equal(new Date((await logs(first.event.id))[0].session_date).toISOString().slice(0,10),'2020-02-01');
 });
 await run('delete_one_session_preserves_other_and_ambiguous_legacy_history',async()=>{
   await mutate('delete',{event_date:'2020-02-01',event_hour:12});
   assert.equal((await logs(first.event.id)).length,0);
   assert.equal((await logs(second.event.id)).length,1);
   assert.equal((await q('SELECT * FROM workout_logs WHERE calendar_event_id IS NULL')).length,1);
 });
 await run('foreign_actor_and_anon_cannot_write_event_logs',async()=>{
   await as(B);
   await assert.rejects(q('SELECT save_event_workout_batch_v1($1,$2,$3,1,$4,$5::jsonb)',[second.event.id,C,'2020-02-02',B,JSON.stringify(ex(77))]),/Training not owned/);
   await as('','anon');
   await assert.rejects(save(base),/permission denied/);
   await as(A);
   assert.equal((await logs(second.event.id))[0].weight_kg,'25.00');
 });
 await run('direct_mismatched_event_link_rejected',async()=>{
   await assert.rejects(q('INSERT INTO workout_logs(client_id,exercise_id,session_date,week_number,trainer_id,calendar_event_id) VALUES ($1,$2,$3,1,$4,$5)',[C,X,'2020-02-03',A,second.event.id]),/nie odpowiada/);
 });
 console.log(JSON.stringify({scope:'PGlite real SQL, local synthetic data',tests:results}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.close());
