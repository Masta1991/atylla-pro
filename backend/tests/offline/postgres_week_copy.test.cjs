// SQL regression in disposable PGlite. Synthetic trainers; no external database.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const {PGlite}=require(path.join(root,'.tmp/billing-qa/node_modules/@electric-sql/pglite'));
const db=new PGlite(),results=[],id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),B=id(2),C=id(3),D=id(4),F=id(5),X=id(6),G=id(7);
const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
const run=async(name,fn)=>{await fn();results.push({name,status:'PASS'});};
const actor=async(uid,role='authenticated')=>{await db.exec('RESET ROLE; SET ROLE '+role);await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid]);};
let monday;
const item=(hour,client=C,extra={})=>({key:'key-'+hour,event_date:monday,event_hour:hour,client_id:client,...extra});
const preview=async(items)=>(await q('SELECT copy_week_safe_v1($1,$2::jsonb,false) result',[monday,JSON.stringify(items)]))[0].result;
const commit=async(items,p)=>{
 const rows=p||await preview(items);const data=items.map(i=>({...i,fingerprint:rows.rows.find(r=>r.key===i.key).fingerprint}));
 return (await q('SELECT copy_week_safe_v1($1,$2::jsonb,true) result',[monday,JSON.stringify(data)]))[0].result;
};
(async()=>{
 await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;");
 for(const f of ['schema.sql','migration_v2.1_rozliczenia_ssot.sql','release/atylla-2.1.3-supabase.sql','migrations/010_workout_event_sessions.sql','migrations/011_safe_week_copy.sql','migrations/011_safe_week_copy.sql'])await db.exec(fs.readFileSync(path.join(root,'database',f),'utf8'));
 await db.exec(`GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated; INSERT INTO auth.users VALUES ('${A}'),('${B}');
 INSERT INTO clients(id,name,trainer_id) VALUES ('${C}','QA A','${A}'),('${D}','QA B','${A}'),('${F}','Foreign','${B}');
 INSERT INTO muscle_groups(id,name,trainer_id) VALUES ('${G}','QA','${A}');
 INSERT INTO exercises(id,name,muscle_group_id,trainer_id) VALUES ('${X}','QA exercise','${G}','${A}');`);
 monday=(await q("SELECT to_char(date_trunc('week',current_date+14),'YYYY-MM-DD') AS target_date"))[0].target_date;
 await actor(A);
 await run('preview_is_read_only_and_pair_copy_has_no_results_or_settlement',async()=>{
   const items=[item(9,C,{partner_client_id:D,main_group:'Plecy',added_groups:['Nogi']})];
   const p=await preview(items);assert.equal(p.rows[0].action,'add');assert.equal((await q('SELECT * FROM calendar_events')).length,0);
   const result=await commit(items,p);assert.equal(result.inserted,1);
   const ev=(await q('SELECT * FROM calendar_events'))[0];assert.equal(ev.partner_client_id,D);assert.equal(ev.main_group,'Plecy');
   assert.equal(ev.is_settled,false);assert.equal(ev.status,'active');assert.equal(ev.note,null);
   assert.equal((await q('SELECT * FROM workout_logs')).length,0);
   await assert.rejects(commit(items,p),/Odśwież/);assert.equal((await q('SELECT * FROM calendar_events')).length,1);
   assert.equal((await preview(items)).rows[0].action,'existing');
 });
 await run('occupied_slot_is_preserved_unless_explicitly_selected_for_replacement',async()=>{
   const items=[item(9,D)];assert.equal((await preview(items)).rows[0].action,'conflict');
   assert.equal((await commit(items)).skipped,1);assert.equal((await q('SELECT client_id FROM calendar_events'))[0].client_id,C);
   const replacing=[item(9,D,{replace:true})];assert.equal((await preview(replacing)).rows[0].action,'replace');
   assert.equal((await commit(replacing)).replaced,1);
   assert.equal((await q('SELECT client_id FROM calendar_events'))[0].client_id,D);
 });
 await run('absence_is_hour_scoped_and_checks_both_participants',async()=>{
   await q('INSERT INTO absences(client_id,absence_date,absence_hour,trainer_id) VALUES ($1,$2,11,$3)',[D,monday,A]);
   const items=[item(10,C,{partner_client_id:D}),item(11,C,{partner_client_id:D}),item(12,D)];
   assert.deepEqual((await preview(items)).rows.map(r=>r.action),['add','absence','add']);
   const r=await commit(items);assert.equal(r.inserted,2);assert.equal(r.skipped,1);
 });
 await run('whole_day_absence_blocks_every_hour',async()=>{
   await q('INSERT INTO absences(client_id,absence_date,absence_hour,trainer_id) VALUES ($1,$2,NULL,$3)',[D,monday,A]);
   assert.deepEqual((await preview([item(13,D),item(14,C,{partner_client_id:D})])).rows.map(r=>r.action),['absence','absence']);
   await q('DELETE FROM absences WHERE absence_hour IS NULL');
 });
 await run('stale_target_rolls_back_other_inserts_in_the_same_batch',async()=>{
   const items=[item(13),item(14)],p=await preview(items);
   await commit([item(14,D)]);
   await assert.rejects(commit(items,p),/Odśwież/);
   assert.equal((await q('SELECT * FROM calendar_events WHERE event_hour=13')).length,0);
   assert.equal((await q('SELECT client_id FROM calendar_events WHERE event_hour=14'))[0].client_id,D);
 });
 await run('new_absence_after_preview_rejects_every_change',async()=>{
   const items=[item(15),item(16)],p=await preview(items);
   await q('INSERT INTO absences(client_id,absence_date,absence_hour,trainer_id) VALUES ($1,$2,16,$3)',[C,monday,A]);
   await assert.rejects(commit(items,p),/Odśwież/);
   assert.equal((await q('SELECT * FROM calendar_events WHERE event_hour=15')).length,0);
 });
 await run('double_source_slot_is_not_silently_overwritten',async()=>{
   const items=[item(17),item(17,D,{key:'second'})];
   assert.deepEqual((await preview(items)).rows.map(r=>r.action),['duplicate','duplicate']);
   assert.equal((await commit(items)).inserted,0);
 });
 await run('paid_session_log_and_package_anchor_are_protected',async()=>{
   await commit([item(18),item(19),item(20)]);
   await q('UPDATE calendar_events SET is_settled=true WHERE event_hour=18');
   const evs=await q('SELECT id,event_hour FROM calendar_events WHERE event_hour>=19 ORDER BY event_hour');
   await q('INSERT INTO workout_logs(client_id,exercise_id,session_date,week_number,trainer_id,calendar_event_id) VALUES($1,$2,$3,1,$4,$5)',[C,X,monday,A,evs[0].id]);
   await q('INSERT INTO client_packages(client_id,size,start_training_id,trainer_id) VALUES($1,10,$2,$3)',[C,evs[1].id,A]);
   assert.deepEqual((await preview([18,19,20].map(h=>item(h,D,{replace:true})))).rows.map(r=>r.action),['protected','protected','protected']);
 });
 await run('foreign_client_plan_anon_and_past_cannot_write',async()=>{
   await assert.rejects(preview([item(21,F)]),/Client not owned/);
   await assert.rejects(preview([item(21,C,{plan_id:id(99)})]),/Plan not owned/);
   await actor('','anon');await assert.rejects(preview([item(21)]),/permission denied/);
   await actor(A);const future=monday;monday='2020-01-06';
   assert.equal((await preview([item(21)])).rows[0].action,'past');assert.equal((await commit([item(21)])).inserted,0);monday=future;
 });
 console.log(JSON.stringify({scope:'PGlite SQL; synthetic data; migration installed twice',tests:results}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.close());
