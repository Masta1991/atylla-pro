// Real local PostgreSQL/PGlite. Synthetic data and no external services.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const {PGlite}=require(path.join(root,'.tmp/billing-qa/node_modules/@electric-sql/pglite'));
const db=new PGlite(),tests=[],id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),B=id(2),C=id(3),D=id(4),E=id(5),F=id(6),G=id(7),X=id(8);
const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
const test=async(name,fn)=>{await fn();tests.push({name,status:'PASS'});};
const as=async(uid,role='authenticated')=>{await db.exec('RESET ROLE; SET ROLE '+role);await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid]);};
const ack=async(event,note)=>(await q('SELECT acknowledge_workout_note_v1($1,$2) result',[event,note]))[0].result;
const source=async()=>(await q('SELECT * FROM calendar_events WHERE id=$1',[E]))[0];
const migration=()=>db.exec(fs.readFileSync(path.join(root,'database/migrations/012_workout_note_reminders.sql'),'utf8'));
(async()=>{
 await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;");
 for(const file of ['schema.sql','migration_v2.1_rozliczenia_ssot.sql','release/atylla-2.1.3-supabase.sql','migrations/010_workout_event_sessions.sql','migrations/011_safe_week_copy.sql'])await db.exec(fs.readFileSync(path.join(root,'database',file),'utf8'));
 await db.exec(`GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
 INSERT INTO auth.users VALUES ('${A}'),('${B}');
 INSERT INTO clients(id,name,trainer_id) VALUES ('${C}','Notes QA','${A}'),('${D}','Foreign QA','${B}');
 INSERT INTO muscle_groups(id,name,trainer_id) VALUES ('${G}','QA','${A}');
 INSERT INTO exercises(id,name,muscle_group_id,trainer_id) VALUES ('${X}','QA','${G}','${A}');
 INSERT INTO calendar_events(id,client_id,event_date,event_hour,trainer_id,note) VALUES
 ('${E}','${C}','2020-01-03',9,'${A}','Pamiętaj o barku'),('${F}','${D}','2020-01-03',10,'${B}','Other trainer private note');
 INSERT INTO workout_logs(client_id,exercise_id,session_date,week_number,trainer_id,weight_kg,calendar_event_id) VALUES ('${C}','${X}','2020-01-03',1,'${A}',10,'${E}');`);
 await test('migration_is_repeatable_and_preserves_text',async()=>{await migration();await migration();assert.equal((await source()).note,'Pamiętaj o barku');});
 await as(A);
 await test('read_is_persistent_idempotent_and_does_not_modify_workout_version_or_logs',async()=>{
   const before=await source(),logs=await q('SELECT * FROM workout_logs');
   const result=await ack(E,before.note),again=await ack(E,before.note),after=await source();
   assert(result.note_acknowledged_at);assert.deepEqual(result,again);
   assert.deepEqual({...after,note_acknowledged_at:null},{...before,note_acknowledged_at:null});
   assert.deepEqual(await q('SELECT * FROM workout_logs'),logs);
 });
 await test('changed_note_reopens_reminder_and_stale_ack_cannot_hide_it',async()=>{
   await q('UPDATE calendar_events SET note=$1 WHERE id=$2',['Nowa notatka',E]);assert.equal((await source()).note_acknowledged_at,null);
   await assert.rejects(ack(E,'Pamiętaj o barku'),/Treść notatki/);assert.equal((await source()).note_acknowledged_at,null);
   await ack(E,'Nowa notatka');
 });
 await test('billing_marker_only_change_keeps_read_state',async()=>{
   const before=await source();await q('UPDATE calendar_events SET note=$1 WHERE id=$2',['[BILLING:KONIEC_PAKIETU]Nowa notatka',E]);
   assert.deepEqual((await source()).note_acknowledged_at,before.note_acknowledged_at);
 });
 await test('ack_does_not_conflict_with_concurrent_workout_save_version',async()=>{
   const before=await source();await ack(E,before.note);
   await q('SELECT save_calendar_workout_v4($1::jsonb)',[JSON.stringify({client_id:C,event_date:'2020-01-03',event_hour:9,expected_event_id:E,expected_updated_at:before.updated_at,note:before.note,exercises:[{exercise_id:X,weight_kg:15,reps:5}]})]);
   assert((await source()).note_acknowledged_at);
 });
 await test('foreign_trainer_cannot_read_or_ack_another_note',async()=>{
   await as(B);assert.equal((await q('SELECT * FROM calendar_events WHERE id=$1',[E])).length,0);
   await assert.rejects(ack(E,'[BILLING:KONIEC_PAKIETU]Nowa notatka'),/Note not accessible/);await as(A);
 });
 await test('anonymous_cannot_ack',async()=>{await as(A,'anon');await assert.rejects(ack(E,'x'),/permission denied/);await as(A);});
 await test('clearing_note_resets_read_state_and_blocks_ack',async()=>{await q('UPDATE calendar_events SET note=$1 WHERE id=$2',['',E]);assert.equal((await source()).note_acknowledged_at,null);await assert.rejects(ack(E,''),/nie jest już dostępna/);});
 await test('closed_package_allows_ack_without_changing_financial_facts',async()=>{
   await q('UPDATE calendar_events SET note=$1 WHERE id=$2',['Notatka archiwalna',E]);
   await q('INSERT INTO client_packages(client_id,trainer_id,size,start_training_id,end_training_id) VALUES ($1,$2,10,$3,$3)',[C,A,E]);
   const before=await q('SELECT * FROM client_packages');await ack(E,'Notatka archiwalna');assert.deepEqual(await q('SELECT * FROM client_packages'),before);
 });
 console.log(JSON.stringify({engine:'PGlite SQL',tests}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.close());
