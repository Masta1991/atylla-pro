// Real PostgreSQL in disposable PGlite, synthetic users. No network or production data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const {PGlite}=require(path.join(root,'.tmp/billing-qa/node_modules/@electric-sql/pglite'));
const db=new PGlite(),results=[],id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A=id(1),B=id(2),C=id(3),D=id(4),F=id(5);
const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
const actor=async(uid,role='authenticated')=>{await db.exec('RESET ROLE; SET ROLE '+role);await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid]);};
const run=async(name,fn)=>{await fn();results.push({name,status:'PASS'});};
let day;
const item=(hour,extra={})=>({client_id:C,absence_date:day,absence_hour:hour,paid:true,...extra});
const reviewed=async p=>{
 const e=(await q('SELECT * FROM calendar_events WHERE event_date=$1 AND event_hour=$2',[p.absence_date,p.absence_hour]))[0];
 return {expected_event_id:e?.id||null,expected_updated_at:e?.updated_at||null,...p};
};
const record=async p=>(await q('SELECT record_absence_v4($1::jsonb) result',[JSON.stringify(await reviewed(p))]))[0].result;
const batch=async items=>(await q('SELECT record_absences_v1($1::jsonb) result',[JSON.stringify(await Promise.all(items.map(reviewed)))]))[0].result;
const ev=async hour=>(await q('SELECT * FROM calendar_events WHERE event_date=$1 AND event_hour=$2',[day,hour]))[0];
const insert=async(hour,cid=C,partner=null)=> (await q('INSERT INTO calendar_events(trainer_id,client_id,partner_client_id,event_date,event_hour) VALUES ($1,$2,$3,$4,$5) RETURNING *',[A,cid,partner,day,hour]))[0];
const remove=async aid=>(await q('SELECT delete_absence_v1($1) result',[aid]))[0].result;
const scheduled=(hour,extra={})=>item(hour,{mode:'schedule',paid:false,expected_event_id:null,expected_updated_at:null,...extra});
const copyItem=hour=>({key:'copy-'+hour,client_id:C,event_date:day,event_hour:hour});
const preview=async items=>(await q('SELECT copy_week_safe_v1($1,$2::jsonb,false) result',[day,JSON.stringify(items)]))[0].result;
(async()=>{
 await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;");
 for(const f of ['schema.sql','migration_v2.1_rozliczenia_ssot.sql','release/atylla-2.1.3-supabase.sql','migrations/010_workout_event_sessions.sql','migrations/011_safe_week_copy.sql'])await db.exec(fs.readFileSync(path.join(root,'database',f),'utf8'));
 await db.exec(`GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated; INSERT INTO auth.users VALUES ('${A}'),('${B}'); INSERT INTO clients(id,name,trainer_id) VALUES ('${C}','QA A','${A}'),('${D}','QA Partner','${A}'),('${F}','QA Foreign','${B}');`);
 day=(await q("SELECT to_char(date_trunc('week',current_date+14),'YYYY-MM-DD') AS target_date"))[0].target_date;
 await actor(A);
 await q('UPDATE clients SET training_schedule=$1::jsonb WHERE id=$2',[JSON.stringify([6,14,15,16,17,18,19,20,21].map(hour=>({day:0,hour}))),C]);
 await run('original_scheduled_slot_failure_is_reproduced_before_migration',async()=>{
   await assert.rejects(q('SELECT record_absence_v3($1::jsonb)',[JSON.stringify(item(9))]),/Brak treningu do odwołania z płatnością/);
   assert.equal((await q('SELECT * FROM absences')).length,0);
 });
 await db.exec('RESET ROLE');
 for(let i=0;i<2;i++)await db.exec(fs.readFileSync(path.join(root,'database/migrations/015_absence_contract.sql'),'utf8'));
 await actor(A);
 await run('active_package_anchor_keeps_identity_and_counts_one_cancellation',async()=>{
   const e=await insert(8);await q('INSERT INTO client_packages(client_id,start_training_id,trainer_id,shared_client_ids) VALUES ($1,$2,$3,$4)',[C,e.id,A,[D]]);
   const a=await record(item(8,{expected_event_id:e.id,expected_updated_at:e.updated_at}));
   assert.equal((await ev(8)).status,'cancelled');assert.equal((await ev(8)).is_settled,true);
   assert.equal((await q('SELECT start_training_id FROM client_packages'))[0].start_training_id,e.id);
   const before=await ev(8);assert.equal((await record(item(8,{expected_event_id:e.id,expected_updated_at:e.updated_at}))).id,a.id);
   assert.deepEqual(await ev(8),before);
   assert.equal((await q('SELECT * FROM absences')).length,1);
 });
 await run('future_regular_absence_without_tile_saves_only_marker_and_keeps_package',async()=>{
   const events=await q('SELECT * FROM calendar_events ORDER BY id'),packages=await q('SELECT * FROM client_packages');
   const a=await record(scheduled(14));assert.equal(a.absence_hour,14);
   assert.equal((await record(scheduled(14))).id,a.id);
   assert.deepEqual(await q('SELECT * FROM calendar_events ORDER BY id'),events);
   assert.deepEqual(await q('SELECT * FROM client_packages'),packages);
   assert.equal((await q('SELECT * FROM absences WHERE absence_hour=14')).length,1);
 });
 await run('copy_week_skips_scheduled_absence_for_primary_or_partner',async()=>{
   const first=await preview([copyItem(14)]);assert.equal(first.rows[0].action,'absence');
   const partner=await preview([{...copyItem(14),client_id:D,partner_client_id:C}]);assert.equal(partner.rows[0].action,'absence');
   const result=(await q('SELECT copy_week_safe_v1($1,$2::jsonb,true) result',[day,JSON.stringify([{...copyItem(14),fingerprint:first.rows[0].fingerprint}])]))[0].result;
   assert.equal(result.inserted,0);assert.equal(result.skipped,1);assert.equal(await ev(14),undefined);
 });
 await run('removing_future_marker_allows_normal_week_copy_without_cancellation',async()=>{
   const a=(await q('SELECT * FROM absences WHERE absence_hour=14'))[0];await remove(a.id);
   const p=await preview([copyItem(14)]);assert.equal(p.rows[0].action,'add');
   await q('SELECT copy_week_safe_v1($1,$2::jsonb,true)',[day,JSON.stringify([{...copyItem(14),fingerprint:p.rows[0].fingerprint}])]);
   assert.equal((await ev(14)).status,'active');assert.equal((await ev(14)).is_settled,false);
 });
 await run('new_absence_invalidates_copy_preview_and_rolls_back_other_slots',async()=>{
   const items=[copyItem(16),copyItem(17)],p=await preview(items);await record(scheduled(17));
   await assert.rejects(q('SELECT copy_week_safe_v1($1,$2::jsonb,true)',[day,JSON.stringify(items.map((row,i)=>({...row,fingerprint:p.rows[i].fingerprint})))]),/Odśwież/);
   assert.equal(await ev(16),undefined);assert.equal(await ev(17),undefined);
 });
 await run('future_marker_requires_current_schedule_and_future_time',async()=>{
   await assert.rejects(record(scheduled(7)),/harmonogramu/);
   await assert.rejects(record(scheduled(15,{absence_date:'2000-01-03'})),/przyszłego/);
   await q('UPDATE clients SET training_schedule=$1::jsonb WHERE id=$2',[JSON.stringify([6,14,16,17,18,19,20,21].map(hour=>({day:0,hour}))),C]);
   await assert.rejects(record(scheduled(15)),/harmonogramu/);
 });
 await run('booking_added_after_preview_is_preserved_for_both_own_and_other_client',async()=>{
   for(const [hour,cid] of [[18,C],[19,D]]){
     const existing=await insert(hour,cid);await assert.rejects(record(scheduled(hour)),/Termin został zmieniony/);
     assert.deepEqual(await ev(hour),existing);assert.equal((await q('SELECT * FROM absences WHERE absence_hour=$1',[hour])).length,0);
   }
 });
 await run('partner_cancels_shared_session_once_without_creating_a_second_event',async()=>{
   const e=await insert(9,C,D);await batch([
     item(9,{client_id:D,expected_event_id:e.id,expected_updated_at:e.updated_at}),
     item(9,{expected_event_id:e.id,expected_updated_at:e.updated_at})]);
   assert.equal((await ev(9)).status,'cancelled');assert.equal((await ev(9)).partner_client_id,D);
   assert.equal((await q('SELECT * FROM calendar_events WHERE event_hour=9')).length,1);
 });
 await run('stale_event_version_and_replaced_id_do_not_cancel',async()=>{
   const e=await insert(10);await q("UPDATE calendar_events SET note='new',updated_at=clock_timestamp() WHERE id=$1",[e.id]);
   await assert.rejects(record(item(10,{expected_event_id:e.id,expected_updated_at:e.updated_at})),/zmieniony/);
   await assert.rejects(record(item(10,{expected_event_id:id(900),expected_updated_at:(await ev(10)).updated_at})),/zmieniony/);
   assert.equal((await ev(10)).status,'active');
 });
 await run('deleted_training_is_not_revived_and_charged',async()=>{
   const e=await insert(11);await q("UPDATE calendar_events SET status='deleted' WHERE id=$1",[e.id]);
   await assert.rejects(record(item(11)),/usunięty/);assert.equal((await ev(11)).status,'deleted');
 });
 await run('batch_failure_rolls_back_prior_cancellation_and_marker',async()=>{
   const before=await ev(10),markers=await q('SELECT * FROM absences ORDER BY id');
   await assert.rejects(batch([scheduled(20),item(10),item(11)]),/usunięty/);
   assert.deepEqual(await ev(10),before);assert.deepEqual(await q('SELECT * FROM absences ORDER BY id'),markers);
   assert.equal(await ev(20),undefined);
 });
 await run('batch_success_and_duplicate_items_are_idempotent',async()=>{
   await insert(12);const rows=await batch([item(10),item(12),item(12)]);
   assert.equal(rows[1].id,rows[2].id);assert.equal((await ev(10)).status,'cancelled');assert.equal((await ev(12)).status,'cancelled');
   assert.equal((await q('SELECT * FROM absences WHERE absence_hour=12')).length,1);
 });
 await run('removing_marker_never_undoes_payment_or_package_anchor',async()=>{
   const before=await ev(8),a=(await q('SELECT id FROM absences WHERE absence_hour=8'))[0];
   await remove(a.id);await remove(a.id);assert.deepEqual(await ev(8),before);
   assert.equal((await q('SELECT start_training_id FROM client_packages'))[0].start_training_id,before.id);
 });
 await run('foreign_user_cannot_record_or_delete_another_trainers_absence',async()=>{
   const a=(await q('SELECT * FROM absences ORDER BY id'))[0];await actor(B);
   await assert.rejects(record(item(10)),/Client not owned/);await remove(a.id);
   assert.equal((await q('SELECT * FROM absences')).length,0);await actor(A);
   assert.equal((await q('SELECT * FROM absences WHERE id=$1',[a.id])).length,1);
 });
 await run('anon_cannot_execute_single_batch_or_delete',async()=>{
   await actor('','anon');await assert.rejects(record(item(10)),/permission denied/);
   await assert.rejects(batch([item(10)]),/permission denied/);await assert.rejects(remove(id(800)),/permission denied/);await actor(A);
 });
 await run('closed_package_cancellation_rolls_back_and_retry_preserves_history',async()=>{
   const end=await insert(13),inside=await insert(7); // Separate next date so 7 lies inside the existing package.
   await q('UPDATE calendar_events SET event_date=$1::date+1 WHERE id=$2',[day,inside.id]);
   await q('UPDATE calendar_events SET event_date=$1::date+2 WHERE id=$2',[day,end.id]);
   await q('UPDATE client_packages SET end_training_id=$1 WHERE client_id=$2',[end.id,C]);
   const next=(await q("SELECT to_char($1::date+1,'YYYY-MM-DD') AS target_date",[day]))[0].target_date;
   await assert.rejects(record(item(7,{absence_date:next})),/zamkniętego pakietu/);
   assert.equal((await q('SELECT * FROM absences WHERE absence_date=$1',[next])).length,0);
   const before=await ev(9);await record(item(9,{client_id:D}));assert.deepEqual(await ev(9),before);
 });
 await run('unpaid_invalid_hour_and_invalid_batch_are_rejected',async()=>{
   await assert.rejects(record(item(10,{paid:false})),/bez płatności/);
   await assert.rejects(record(item(22)),/Nieprawidłowy/);
   await assert.rejects(batch([]),/1 do 30/);await assert.rejects(batch(Array(31).fill(item(10))),/1 do 30/);
   await assert.rejects(record(scheduled(21,{paid:true})),/nie jest płatnym/);
 });
 await run('old_rpc_and_omitted_review_cannot_bypass_the_new_contract',async()=>{
   await assert.rejects(q('SELECT record_absence_v3($1::jsonb)',[JSON.stringify(item(10))]),/permission denied/);
   await assert.rejects(q('SELECT record_absence_v4($1::jsonb)',[JSON.stringify(item(10))]),/Odśwież aplikację/);
 });
 await run('rollback_restores_legacy_permission_and_reapply_restores_protection',async()=>{
   const markers=await q('SELECT * FROM absences ORDER BY id');
   await db.exec('RESET ROLE; GRANT EXECUTE ON FUNCTION public.record_absence_v3(jsonb) TO authenticated;');
   await actor(A);
   await assert.rejects(q('SELECT record_absence_v3($1::jsonb)',[JSON.stringify(item(6))]),/Brak treningu do odwołania z płatnością/);
   assert.deepEqual(await q('SELECT * FROM absences ORDER BY id'),markers);
   await db.exec('RESET ROLE');
   await db.exec(fs.readFileSync(path.join(root,'database/migrations/015_absence_contract.sql'),'utf8'));
   await actor(A);
   await assert.rejects(q('SELECT record_absence_v3($1::jsonb)',[JSON.stringify(item(6))]),/permission denied/);
   assert.deepEqual(await q('SELECT * FROM absences ORDER BY id'),markers);
 });
 console.log(JSON.stringify({engine:'PGlite PostgreSQL',synthetic:true,tests:results}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.close());
