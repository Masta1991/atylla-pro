// Synthetic local PostgreSQL. Never reads production configuration.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { PGlite } = require(path.join(root, '.tmp/billing-qa/node_modules/@electric-sql/pglite'));
const db = new PGlite(), tests = [];
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002';
const CA='00000000-0000-4000-8000-000000000003', CB='00000000-0000-4000-8000-000000000004';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
const test=async(name,fn)=>{await fn();tests.push({name,status:'PASS'});};
const as=async(uid,role='authenticated')=>{await db.exec('RESET ROLE; SET ROLE '+role);await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[uid]);};
const defaults=()=>({start_hour:6,session_minutes:60,start_on_hour:true,goal:'balance',max_consecutive:null,end_hour:null,allowed_weekdays:null,protected_windows:[],locked_client_ids:[],session_price:null});
const migration=()=>db.exec(fs.readFileSync(path.join(root,'database/migrations/014_trainer_planning.sql'),'utf8'));
const preferences=()=>q('SELECT * FROM trainer_planning_preferences');
const analyses=()=>q('SELECT * FROM trainer_planning_analyses');
const savePrefs=async(p=defaults(),rev=0)=>(await q('SELECT save_trainer_planning_preferences_v1($1::jsonb,$2) result',[JSON.stringify(p),rev]))[0].result;
const request=(n,extra={})=>({request_id:id(n),months:3,preferences:defaults(),answers:{},save_preferences:false,expected_revision:0,...extra});
const snapshot=req=>({months:req.months,preferences:req.preferences,answers:{},questions:[],result:{proposals:[],stats:{sessions:0}}});
const rawSave=async(actor,req,snap=snapshot(req))=>(await q('SELECT save_trainer_planning_analysis_v1($1::uuid,$2::jsonb,$3::jsonb) result',[actor,JSON.stringify(req),JSON.stringify(snap)]))[0].result;
// Emulate only the backend's narrowly scoped service transaction, restoring the test user.
const save=async(req,snap=snapshot(req))=>{
  const [{actor,role}]=await q('SELECT auth.uid() actor,current_user role');
  await as('', 'service_role');
  try{return await rawSave(actor,req,snap);}finally{await as(actor||'',role);}
};
const rejectsCode=(p,code)=>assert.rejects(p,e=>e.code===code);

(async()=>{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
    INSERT INTO auth.users VALUES('${A}'),('${B}');
    CREATE TABLE public.clients(id uuid PRIMARY KEY,trainer_id uuid REFERENCES auth.users(id));
    INSERT INTO public.clients VALUES('${CA}','${A}'),('${CB}','${B}');`);
  await migration(); await as(A);
  await test('new_actor_needs_no_seed_and_first_revision_is_one',async()=>{
    assert.deepEqual(await preferences(),[]);assert.deepEqual(await analyses(),[]);
    const saved=await savePrefs(); assert.equal(saved.revision,1);assert.deepEqual(saved.preferences,defaults());
  });
  await test('compare_and_swap_rejects_stale_and_updates_current',async()=>{
    await assert.rejects(savePrefs(defaults(),0),/Preferencje zmieniły/);
    assert.equal((await preferences())[0].revision,1);
    const saved=await savePrefs({...defaults(),goal:'time'},1);assert.equal(saved.revision,2);
  });
  await test('profiles_are_isolated_by_rls_and_no_caller_owner_argument',async()=>{
    await as(B);assert.deepEqual(await preferences(),[]);
    const other=await savePrefs({...defaults(),allowed_weekdays:[]});assert.equal(other.revision,1);
    await as(A);assert.equal((await preferences())[0].preferences.goal,'time');assert.equal((await preferences()).length,1);
  });
  await test('foreign_locked_client_and_direct_table_writes_are_denied',async()=>{
    await rejectsCode(savePrefs({...defaults(),locked_client_ids:[CB]},2),'42501');
    await rejectsCode(q("UPDATE trainer_planning_preferences SET revision=99"),'42501');
    await rejectsCode(q("DELETE FROM trainer_planning_preferences"),'42501');
    await rejectsCode(q("INSERT INTO trainer_planning_analyses(trainer_id,id) VALUES($1,$2)",[A,id(70)]),'42501');
    assert.equal((await preferences())[0].revision,2);
  });
  await test('analysis_and_preferences_save_atomically',async()=>{
    const req=request(100,{save_preferences:true,expected_revision:2,preferences:{...defaults(),locked_client_ids:[CA],session_price:150}});
    const result=await save(req);assert.equal(result.trainer_id,A);assert.equal(result.id,id(100));
    assert.equal((await preferences())[0].revision,3);assert.equal((await analyses()).length,1);
    assert.equal(result.request_fingerprint.length,64);
  });
  await test('idempotent_retry_returns_original_even_after_profile_changes',async()=>{
    const before=(await analyses())[0], req=before.request_payload;
    await savePrefs({...defaults(),goal:'income'},3);
    const replay=await save(req,{...snapshot(req),result:{proposals:[],ignoredNewCalculation:true}});
    assert.equal(new Date(replay.created_at).getTime(),new Date(before.created_at).getTime());
    assert.deepEqual(replay.result,before.result);assert.equal((await analyses()).length,1);
    assert.equal((await preferences())[0].revision,4);
  });
  await test('request_collision_cannot_overwrite_snapshot',async()=>{
    const before=await analyses();
    await assert.rejects(save(request(100,{expected_revision:4,months:6})),/identyfikator analizy/);
    assert.deepEqual(await analyses(),before);
    await rejectsCode(q("UPDATE trainer_planning_analyses SET goal='income'"),'42501');
    await rejectsCode(q('DELETE FROM trainer_planning_analyses'),'42501');
  });
  await test('same_request_id_in_another_profile_is_separate_and_invisible',async()=>{
    await as(B);assert.deepEqual(await analyses(),[]);
    const saved=await save(request(100,{expected_revision:1}));assert.equal(saved.trainer_id,B);
    assert.equal((await analyses()).length,1);await as(A);assert.equal((await analyses()).length,1);
  });
  await test('snapshot_failure_rolls_back_preference_write',async()=>{
    const prefs=await preferences(), history=await analyses();
    const req=request(101,{save_preferences:true,expected_revision:4});
    const snap=snapshot(req);snap.result.padding='x'.repeat(210000);
    await rejectsCode(save(req,snap),'23514');
    assert.deepEqual(await preferences(),prefs);assert.deepEqual(await analyses(),history);
  });
  await test('analysis_stale_revision_and_foreign_proposal_clients_are_rejected',async()=>{
    await assert.rejects(save(request(102,{expected_revision:3})),/Preferencje zmieniły/);
    const req=request(103,{expected_revision:4}),snap=snapshot(req);
    snap.result.proposals=[{clients:[{id:CB,name:'foreign'}],moves:[]}];
    await rejectsCode(save(req,snap),'42501');assert.equal((await analyses()).length,1);
    snap.result.proposals=[{clients:[],moves:[{client_ids:[CB]}]}];await rejectsCode(save(req,snap),'42501');
  });
  await test('preserve_answers_can_add_durable_windows_but_never_remove_existing',async()=>{
    const req=request(104,{expected_revision:4,save_preferences:true});
    const snap=snapshot(req);snap.preferences={...req.preferences,protected_windows:[{weekday:0,date:null,start_hour:9,end_hour:11}]};
    const saved=await save(req,snap);assert.equal(saved.preferences.protected_windows.length,1);
    assert.deepEqual((await preferences())[0].preferences.protected_windows,saved.preferences.protected_windows);
    const bad=request(105,{expected_revision:5,preferences:saved.preferences});
    await assert.rejects(save(bad,{...snapshot(bad),preferences:defaults()}),/Nie można usunąć/);
  });
  await test('invalid_sql_preferences_do_not_bypass_python_validation',async()=>{
    for(const invalid of [{start_hour:5},{session_minutes:45},{start_on_hour:false},{goal:null},{end_hour:6},{allowed_weekdays:[0,0]},{allowed_weekdays:[true]},
      {session_price:-1},{session_price:'150'},{locked_client_ids:[CA,CA]},
      {protected_windows:[{weekday:0,date:'2026-10-05',start_hour:9,end_hour:11}]},
      {protected_windows:[{date:'2026-02-30',start_hour:9,end_hour:11}]}]){
      await assert.rejects(savePrefs({...defaults(),...invalid},5));
    }
    assert.equal((await preferences())[0].revision,5);
  });
  await test('anonymous_and_missing_actor_cannot_read_or_execute',async()=>{
    await as(A,'anon');await rejectsCode(preferences(),'42501');await rejectsCode(analyses(),'42501');
    await rejectsCode(savePrefs(),'42501');await rejectsCode(rawSave(A,request(106)),'42501');
    await as('');await rejectsCode(savePrefs(),'42501');await rejectsCode(save(request(106)),'42501');
    await as(A);
  });
  await test('authenticated_cannot_forge_snapshots_or_call_actor_helper',async()=>{
    const before=await analyses();
    await rejectsCode(rawSave(A,request(109),{...snapshot(request(109)),result:{forged:true}}),'42501');
    await rejectsCode(rawSave(B,request(109)),'42501');
    await rejectsCode(q('SELECT write_trainer_planning_preferences_v1($1,$2::jsonb,$3)',[B,JSON.stringify(defaults()),1]),'42501');
    assert.deepEqual(await analyses(),before);
    const old=await q("SELECT to_regprocedure('public.save_trainer_planning_analysis_v1(jsonb,jsonb)') old");
    assert.equal(old[0].old,null);
  });
  await test('missing_result_arrays_fail_closed_without_profile_update',async()=>{
    const before=await preferences();const req=request(108,{expected_revision:5,save_preferences:true});
    const snap=snapshot(req);delete snap.result.proposals;
    await assert.rejects(save(req,snap),/Nieprawidłowy wynik/);
    assert.deepEqual(await preferences(),before);
  });
  await test('repeatable_migration_preserves_data_and_permissions',async()=>{
    const before=await analyses();await db.exec('RESET ROLE');await migration();await migration();await as(A);
    assert.deepEqual(await analyses(),before);await rejectsCode(q('DELETE FROM trainer_planning_analyses'),'42501');
    await rejectsCode(rawSave(A,request(110)),'42501');
  });
  console.log(JSON.stringify({engine:'PGlite SQL',tests}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.close());
