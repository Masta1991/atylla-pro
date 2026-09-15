// Real built UI and browser storage; Auth responses are synthetic, network blocked.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const {chromium}=require(path.join(root,'.tmp/billing-qa/node_modules/playwright'));
const build=path.resolve(root,process.argv[2]||'');
if(!build.startsWith(path.join(root,'.tmp')+path.sep))throw Error('Expected local build');
const out=path.join(root,'docs/audits/SESSION_BROWSER_2026-09-14.json');
const server=http.createServer((req,res)=>{
  let file=path.resolve(build,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
  if(!file.startsWith(build+path.sep)&&file!==build){res.writeHead(403);res.end();return;}
  if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(build,'index.html');
  res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.ttf':'font/ttf','.css':'text/css'})[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
let browser;
const results=[],errors=[],blocked=[];
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-background-networking','--no-first-run']});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  let mode='normal',activities=0,refreshes=0;
  const lease={access_token:'old',refresh_token:'refresh',idle_token:'lease',session_id:'session',idle_expires_at:Math.floor(Date.now()/1000)+259200};
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin===origin)return route.continue();
    if(url.origin!=='http://127.0.0.1:8000'){blocked.push(url.origin);return route.abort();}
    let body=[],status=200;
    if(url.pathname==='/auth/login')body=lease;
    else if(url.pathname==='/auth/refresh'){refreshes++;body={access_token:'new',refresh_token:'rotated'};}
    else if(url.pathname==='/auth/activity'){
      activities++;
      if(mode==='offline')return route.abort('internetdisconnected');
      if(mode==='expired'){status=401;body={detail:{code:'idle_session_expired',message:'72h expired'}};}
      else if(mode==='refresh'&&req.headers().authorization==='Bearer old'){status=401;body={detail:'expired JWT'};}
      else body={...lease,idle_token:'renewed',idle_expires_at:lease.idle_expires_at+100};
    }
    else if(url.pathname.endsWith('/exercises/by-group'))body={};
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':'*'}});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  await page.getByPlaceholder('E-mail').fill('qa@example.invalid');
  await page.getByPlaceholder('Hasło').fill('synthetic-password');
  await page.getByText('ZALOGUJ',{exact:true}).click();
  await page.getByText('ATYLLA PRO',{exact:true}).first().waitFor();
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('atylla_session_v2')));
  assert.equal((await saved()).refresh_token,'refresh');results.push('login_persists_atomic_session');
  mode='refresh';await page.reload();
  await page.getByText('ATYLLA PRO',{exact:true}).first().waitFor();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('atylla_session_v2'))?.refresh_token==='rotated');
  assert.equal(refreshes,1);results.push('reload_refreshes_jwt_without_login');
  await page.waitForTimeout(800);const count=activities;
  await page.waitForTimeout(1800);assert.equal(activities,count);results.push('idle_visible_page_does_not_send_heartbeats');
  await page.keyboard.press('Tab');await page.waitForTimeout(800);
  assert.ok(activities>count);results.push('trusted_keyboard_activity_renews_session');
  mode='offline';await page.reload();await page.getByText('ATYLLA PRO',{exact:true}).first().waitFor();
  await page.waitForTimeout(500);assert.equal((await saved()).refresh_token,'rotated');results.push('network_failure_preserves_login');
  mode='normal';const second=await context.newPage();await second.goto(origin);
  await second.getByText('ATYLLA PRO',{exact:true}).first().waitFor();
  mode='expired';await page.bringToFront();await page.reload();
  await page.getByText('ZALOGUJ',{exact:true}).waitFor();assert.equal(await saved(),null);
  await second.getByText('ZALOGUJ',{exact:true}).waitFor();results.push('expired_idle_logs_out_all_tabs');
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  fs.writeFileSync(out,JSON.stringify({status:'PASS',scope:'built Chrome PWA + synthetic API; not live Supabase',build,results,errors,blocked},null,2));
  console.log(JSON.stringify({status:'PASS',results}));
})().catch(e=>{console.error(e);fs.writeFileSync(out,JSON.stringify({status:'FAIL',results,error:e.message},null,2));process.exitCode=1;})
.finally(async()=>{if(browser)await browser.close();await new Promise(r=>server.close(r));});
