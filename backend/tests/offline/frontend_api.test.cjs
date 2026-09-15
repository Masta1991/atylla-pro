// Executes the actual API module with synthetic fetch/storage. No network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const frontend = path.resolve(__dirname, '../../../frontend');
const babel = require(require.resolve('@babel/core', { paths: [frontend] }));
const plugin = require.resolve('@babel/plugin-transform-modules-commonjs', { paths: [frontend] });
const source = fs.readFileSync(path.join(frontend, 'src/services/api.js'), 'utf8');
const compiled = babel.transformSync(source, { plugins: [plugin], configFile: false, babelrc: false }).code;
const response = (status, body = {}) => ({ status, ok: status < 400, json: async () => body });
function load(fetch, store = new Map(), locks = null) {
  const storage = {
    getItem: async k => store.get(k) || null, setItem: async (k, v) => store.set(k, v), removeItem: async k => store.delete(k),
  };
  const context = { exports: {}, fetch, __DEV__: true, URLSearchParams, console, global: {}, navigator: { locks },
    require: name => {
      assert.equal(name, '@react-native-async-storage/async-storage');
      return storage;
    },
  };
  vm.runInNewContext(compiled, context);
  return { api: context.exports, store };
}
const results = [];
async function test(name, run) { await run(); results.push({ name, status: 'PASS' }); }
(async () => {
  await test('refresh_token_only_in_body_and_retry_uses_new_token', async () => {
    const calls = [];
    const { api, store } = load(async (url, config) => {
      calls.push({ url, config });
      if (url.endsWith('/auth/refresh')) return response(200, { access_token: 'new', refresh_token: 'new-refresh' });
      return calls.length === 1 ? response(401) : response(200, { id: 'client' });
    });
    api.setAuthToken('old', 'synthetic-refresh');
    await api.getClient('client');
    assert.equal(calls[1].url, 'http://127.0.0.1:8000/auth/refresh');
    assert.deepEqual(JSON.parse(calls[1].config.body), { refresh_token: 'synthetic-refresh' });
    assert.equal(calls[2].config.headers.Authorization, 'Bearer new');
    assert.equal(JSON.parse(store.get(api.SESSION_STORAGE_KEY)).access_token, 'new');
  });
  await test('temporary_refresh_failure_keeps_session', async () => {
    let expired = 0;
    const { api, store } = load(async url => response(url.endsWith('/auth/refresh') ? 503 : 401));
    api.setAuthToken('old', 'refresh');
    store.set('auth_token', 'old');
    api.setSessionExpiredCallback(() => expired++);
    await assert.rejects(api.getClient('client'), /chwilowo/);
    assert.equal(expired, 0);
    assert.equal(store.get('auth_token'), 'old');
  });
  await test('forbidden_resource_does_not_log_user_out', async () => {
    let expired = 0;
    const { api } = load(async () => response(403, { detail: 'Brak uprawnień' }));
    api.setAuthToken('old', 'refresh');
    api.setSessionExpiredCallback(() => expired++);
    await assert.rejects(api.getClient('client'), /Brak uprawnień/);
    assert.equal(expired, 0);
  });
  await test('logout_during_refresh_cannot_restore_tokens', async () => {
    let release, started;
    const ready = new Promise(resolve => { started = resolve; });
    const { api, store } = load(async url => {
      if (url.endsWith('/auth/refresh')) {
        started();
        return new Promise(resolve => { release = resolve; });
      }
      return response(401);
    });
    api.setAuthToken('old', 'refresh');
    const pending = api.getClient('client');
    await ready;
    api.clearAuthToken();
    release(response(200, { access_token: 'new', refresh_token: 'new-refresh' }));
    await assert.rejects(pending, /zmieniona/);
    assert.equal(store.size, 0);
  });
  await test('concurrent_401_requests_share_one_refresh', async () => {
    let refreshes = 0;
    const { api } = load(async (url, config) => {
      if (url.endsWith('/auth/refresh')) {
        refreshes++;
        await new Promise(resolve => setTimeout(resolve, 5));
        return response(200, { access_token: 'new', refresh_token: 'next' });
      }
      return response(config.headers.Authorization === 'Bearer new' ? 200 : 401);
    });
    api.setAuthToken('old', 'refresh');
    await Promise.all([api.getClient('one'), api.getClient('two')]);
    assert.equal(refreshes, 1);
  });
  await test('concurrent_reads_of_same_dictionary_issue_one_request', async () => {
    let calls=0;
    const {api}=load(async()=>{calls++; await new Promise(r=>setTimeout(r,10)); return response(200,[]);});
    api.setAuthToken('one');
    await Promise.all(Array.from({length:10},()=>api.getWorkoutTypes()));
    assert.equal(calls,1);
  });
  await test('logout_clears_cache_and_discards_late_client_response', async () => {
    let release;
    const {api}=load(async(url,config)=>config.headers.Authorization==='Bearer old'
      ? new Promise(r=>{release=r;}) : response(200,[{id:'new-client'}]));
    api.setAuthToken('old');
    const pending=api.getClients();
    api.clearAuthToken(); api.setAuthToken('new');
    release(response(200,[{id:'old-client'}]));
    await assert.rejects(pending,/zmieniona/);
    assert.equal((await api.getClients())[0].id,'new-client');
  });
  await test('mutation_invalidates_old_counts_and_late_reads', async () => {
    let release, reads=0;
    const {api}=load(async(url,options)=>{
      if(options.method==='POST') return response(201,{id:'absence'});
      reads++;
      if(reads===1) return new Promise(r=>{release=r;});
      return response(200,[{package_current_count:0}]);
    });
    api.setAuthToken('one');
    const pending=api.getClients();
    await api.createAbsence({paid:false});
    release(response(200,[{package_current_count:1}]));
    await assert.rejects(pending,/Odśwież/);
    assert.equal((await api.getClients())[0].package_current_count,0);
  });
  await test('absence_and_workout_use_single_requests_and_no_mail_exports', async () => {
    const calls=[];
    const {api}=load(async(url,options)=>{calls.push({url,options});return response(200,{event:{id:'one'}});});
    await api.createAbsence({paid:false});
    await api.saveCalendarWorkout({client_id:'client',event_date:'2026-09-10',event_hour:11,exercises:[]});
    assert.equal(calls.length,2);
    assert.ok(calls[1].url.endsWith('/calendar/save-workout'));
    assert.equal(api.sendReportEmail,undefined);
    assert.equal(api.sendPlanEmail,undefined);
  });
  await test('billing_sends_reviewed_version_and_never_retries_unknown_commit',async()=>{
    const calls=[];
    const {api}=load(async(url,options)=>{calls.push({url,options});return response(502,{detail:'Odśwież dane'});});
    const stamp='2026-09-14T01:00:00Z';
    await assert.rejects(api.hardResetClient('client',stamp),/Odśwież/);
    await assert.rejects(api.closeClientCycle('client',{end_date:'2026-09-14',expected_updated_at:stamp}),/Odśwież/);
    assert.equal(calls.length,2);
    assert.deepEqual(JSON.parse(calls[0].options.body),{expected_updated_at:stamp});
    assert.equal(JSON.parse(calls[1].options.body).expected_updated_at,stamp);
  });
  const lease = { access_token:'old', refresh_token:'refresh', idle_token:'lease',
    idle_expires_at:1800259200, session_id:'session', revision:0 };
  await test('atomic_pair_survives_restart_and_refresh_does_not_extend_idle', async () => {
    const {api,store}=load(async(url,config)=>url.endsWith('/auth/refresh')
      ? response(200,{access_token:'new',refresh_token:'rotated'})
      : response(config.headers.Authorization==='Bearer new'?200:401,{}));
    await api.saveAuthSession(lease,'qa@example.invalid');
    await api.getClient('one');
    const saved=JSON.parse(store.get(api.SESSION_STORAGE_KEY));
    assert.equal(saved.access_token,'new'); assert.equal(saved.refresh_token,'rotated');
    assert.equal(saved.idle_expires_at,lease.idle_expires_at);
    const restarted=load(async()=>response(200),store);
    assert.equal((await restarted.api.restoreAuthSession()).refresh_token,'rotated');
    assert.equal(store.size,1);
  });
  await test('only_explicit_activity_extends_deadline', async()=>{
    let activities=0;
    const {api,store}=load(async url=>{
      if(url.endsWith('/auth/activity')){activities++;return response(200,{...lease,idle_token:'extended',idle_expires_at:1800432000});}
      return response(200,{});
    });
    await api.saveAuthSession(lease,'qa');
    await api.getClient('one'); await api.getClient('two');
    assert.equal(activities,0);
    await Promise.all([api.noteUserActivity(),api.noteUserActivity()]);
    assert.equal(activities,1);
    assert.equal(JSON.parse(store.get(api.SESSION_STORAGE_KEY)).idle_expires_at,1800432000);
  });
  await test('expired_idle_does_not_attempt_refresh_and_clears_storage', async()=>{
    const calls=[];let expired=0;
    const {api,store}=load(async url=>{calls.push(url);return response(401,{detail:{code:'idle_session_expired',message:'72h expired'}});});
    await api.saveAuthSession(lease,'qa');api.setSessionExpiredCallback(()=>expired++);
    await assert.rejects(api.noteUserActivity(),/72h expired/);
    assert.equal(calls.length,1);assert.equal(expired,1);assert.equal(store.size,0);
  });
  await test('network_failure_during_activity_preserves_durable_session', async()=>{
    const {api,store}=load(async()=>{throw Error('offline');});
    await api.saveAuthSession(lease,'qa');const before=store.get(api.SESSION_STORAGE_KEY);
    await assert.rejects(api.noteUserActivity(),/offline/);
    assert.equal(store.get(api.SESSION_STORAGE_KEY),before);
  });
  await test('two_tabs_rotate_shared_refresh_token_once', async()=>{
    const store=new Map();let queue=Promise.resolve(),refreshes=0;
    const locks={request:(name,work)=>{const next=queue.then(work);queue=next.catch(()=>{});return next;}};
    const fetch=async(url,config)=>{
      if(url.endsWith('/auth/refresh')){refreshes++;await new Promise(r=>setTimeout(r,5));return response(200,{access_token:'new',refresh_token:'rotated'});}
      return response(config.headers.Authorization==='Bearer new'?200:401,{});
    };
    const a=load(fetch,store,locks).api,b=load(fetch,store,locks).api;
    await a.saveAuthSession(lease,'qa');await b.restoreAuthSession();
    await Promise.all([a.getClient('a'),b.getClient('b')]);
    assert.equal(refreshes,1);
    assert.equal(JSON.parse(store.get(a.SESSION_STORAGE_KEY)).refresh_token,'rotated');
  });
  await test('activity_commit_does_not_overwrite_another_tabs_rotated_pair', async()=>{
    let release,started;const ready=new Promise(r=>started=r);
    const {api,store}=load(async()=>{started();return new Promise(r=>release=r);});
    await api.saveAuthSession(lease,'qa');const pending=api.noteUserActivity();await ready;
    store.set(api.SESSION_STORAGE_KEY,JSON.stringify({...lease,access_token:'other-new',refresh_token:'other-next',revision:1}));
    release(response(200,{...lease,idle_token:'extended',idle_expires_at:1800432000}));
    await pending;const saved=JSON.parse(store.get(api.SESSION_STORAGE_KEY));
    assert.equal(saved.refresh_token,'other-next');assert.equal(saved.idle_token,'extended');
  });
  await test('legacy_storage_requires_login_and_logout_removes_all_auth_keys', async()=>{
    const {api,store}=load(async()=>response(200));store.set('auth_token','legacy');
    assert.equal(await api.restoreAuthSession(),null);
    await api.clearStoredSession();assert.equal(store.size,0);
  });
  await test('same_day_sessions_have_separate_read_cache_keys', async()=>{
    const calls=[];
    const {api}=load(async url=>{calls.push(url);return response(200,[{calendar_event_id:new URL(url).searchParams.get('calendar_event_id')}]);});
    api.setAuthToken('synthetic','refresh');
    const first=await api.getClientWorkouts('client','2020-02-01','first');
    const second=await api.getClientWorkouts('client','2020-02-01','second');
    await api.getClientWorkouts('client','2020-02-01','first');
    assert.equal(first[0].calendar_event_id,'first');assert.equal(second[0].calendar_event_id,'second');
    assert.equal(calls.length,2);
  });
  await test('duplicate_confirmation_code_and_explicit_flag_survive_api',async()=>{
    const bodies=[];
    const {api}=load(async(url,config)=>{bodies.push(JSON.parse(config.body));return response(409,{detail:{code:'duplicate_session',message:'Potwierdź drugi trening'}});});
    api.setAuthToken('synthetic','refresh');
    await assert.rejects(api.saveCalendarWorkout({event_date:'2020-02-01',event_hour:12,client_id:'client',confirm_duplicate:true}),error=>error.code==='duplicate_session');
    assert.equal(bodies[0].confirm_duplicate,true);assert.equal(bodies.length,1);
  });
  console.log(JSON.stringify({ scope: 'API module, synthetic fetch and storage', tests: results }));
})().catch(error => { console.error(error); process.exitCode = 1; });
