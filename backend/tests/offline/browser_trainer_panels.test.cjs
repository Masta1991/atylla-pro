// Real local PWA; all API responses synthetic. Optional "baseline" mode captures 2.1.5.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'),build=path.resolve(root,process.argv[2]);
const baseline=process.argv[3]==='baseline';
const apiOrigin=process.env.ATYLLA_QA_API_ORIGIN||'http://127.0.0.1:8000';
const {chromium}=require(path.join(root,'.tmp/billing-qa/node_modules/playwright'));
const AxeBuilder=require(path.join(root,'.tmp/billing-qa/node_modules/@axe-core/playwright')).default;
const fixture=JSON.parse(fs.readFileSync(path.join(root,'.tmp/trainer-panels-20260915/fixture.json'),'utf8'));
const out=path.resolve(root,process.env.ATYLLA_QA_OUT||(baseline?'.tmp/trainer-panels-20260915/baseline':'.tmp/manager-restore-20260915/browser'));
assert(out.startsWith(path.join(root,'.tmp')+path.sep));fs.mkdirSync(out,{recursive:true});
assert(build.startsWith(path.join(root,'.tmp')+path.sep));
const server=http.createServer((req,res)=>{
 let file=path.resolve(build,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
 if(!file.startsWith(build+path.sep)&&file!==build){res.writeHead(403);return res.end();}
 if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(build,'index.html');
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
let browser,debugPage;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-background-networking','--disable-component-update','--no-first-run']});
 const results=[];
 for(const width of (baseline?[390,1440]:[390,1440,1024,768,320])){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:width===320?'reduce':'no-preference'});
  const page=await context.newPage();debugPage=page;page.setDefaultTimeout(10000);
  const errors=[],calls=[],blocked=[],dialogs=[];let failRead=false,staleCopy=false,failManager=false,emptyManager=false;
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.type());await d.dismiss();});
  await context.addInitScript(()=>{localStorage.setItem('atylla_session_v2',JSON.stringify({access_token:'synthetic-offline',refresh_token:'synthetic-refresh',idle_token:'synthetic-lease',idle_expires_at:Math.floor(Date.now()/1000)+259200,session_id:'synthetic-session',email:'nobody@example.invalid',revision:0}));if(innerWidth===320)localStorage.setItem('appThemeMode','light');});
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());if(u.origin===origin)return route.continue();
   if(u.origin!==apiOrigin){blocked.push(u.origin);return route.abort();}
   calls.push({path:u.pathname+u.search,method:req.method(),body:req.postData()});let body=[],status=200;
   if(u.pathname==='/auth/activity')body={idle_token:'synthetic-lease',idle_expires_at:Math.floor(Date.now()/1000)+259200,session_id:'synthetic-session'};
   else if(u.pathname==='/clients/')body=fixture.clients;
   else if(u.pathname.startsWith('/calendar/week/'))body=fixture.events;
   else if(u.pathname==='/calendar/absences')body=[];
   else if(u.pathname==='/calendar/stats')body={chart_data:[]};
   else if(u.pathname.includes('/exercises/by-group'))body={};
   else if(u.pathname==='/trainer/overview'){
    if(failRead){status=503;body={detail:'Syntetyczna awaria odczytu'};}
    else{body=fixture.overview[[u.searchParams.get('year'),u.searchParams.get('month'),u.searchParams.get('client_id')||''].join('|')];}
   }else if(u.pathname==='/trainer/manager'){
    if(failManager){status=503;body={detail:'Syntetyczna awaria menadżera'};}
    else body={...fixture.manager,items:emptyManager?[]:fixture.manager.items};
   }
   else if(u.pathname==='/trainer/copy-preview'||u.pathname==='/trainer/copy'){
    const p=req.postDataJSON();const rows=p.items.map(i=>({key:i.key,event_date:i.event_date,event_hour:i.event_hour,
      action:i.key==='item-0'?'add':i.key==='item-1'?'absence':i.replace?'replace':'conflict',can_replace:i.key==='item-2',occupied_client_id:i.key==='item-2'?fixture.clients[1].id:null,fingerprint:'synthetic-'+i.key}));
    if(u.pathname==='/trainer/copy'&&staleCopy){status=409;body={detail:'Dane zmieniły się od podglądu. Odśwież podgląd przed zapisem.'};}
    else body={rows,inserted:u.pathname==='/trainer/copy'?rows.filter(r=>r.action==='add').length:0,replaced:rows.some(r=>r.action==='replace')?1:0,skipped:rows.filter(r=>!['add','replace'].includes(r.action)).length};
   }
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body??[]),headers:{'Access-Control-Allow-Origin':'*'}});
  });
  async function openScreen(label){
    await page.goto(origin);await page.getByText('ATYLLA PRO',{exact:true}).first().waitFor();await page.waitForTimeout(450);
    await page.mouse.click(32,105);await page.getByText('Wyloguj',{exact:true}).waitFor();await page.getByText(label,{exact:true}).click();await page.waitForTimeout(500);
  }
  async function capture(name){
    // TouchableOpacity fades back after a press; audit the settled frame.
    await page.waitForTimeout(400);
    await page.screenshot({path:path.join(out,`${width}-${name}.png`)});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    const axe=await new AxeBuilder({page}).analyze();const violations=axe.violations.filter(v=>['serious','critical'].includes(v.impact));
    results.push({width,name,overflow,violations:violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,html:n.html}))}))});
    if(!baseline){assert(!overflow,name+' overflow');assert.equal(violations.length,0,JSON.stringify(results.at(-1)));}
  }
  await openScreen('Absencje');
  if(baseline){await capture('absences');await openScreen('Strefa Trenera');await capture('trainer');await openScreen('Menadżer');await capture('manager');await context.close();continue;}
  await page.getByText('Podgląd absencji',{exact:true}).waitFor();
  assert.equal(await page.getByText('Zgłoś Absencję',{exact:true}).count(),0);
  await capture('absences');
  await page.getByRole('button',{name:'Filtr klienta',exact:true}).press('Enter');
  const picker=page.getByRole('dialog',{name:'Filtr klienta'});await picker.waitFor();
  for(const key of ['Tab','Tab','Shift+Tab']){await page.keyboard.press(key);assert(await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')&&!document.activeElement.closest('[inert],[aria-hidden="true"]')));}
  await capture('client-filter');await page.keyboard.press('Escape');
  assert(await page.getByRole('button',{name:'Filtr klienta',exact:true}).evaluate(el=>el===document.activeElement));
  await page.getByRole('button',{name:'Filtr klienta',exact:true}).press('Space');await picker.getByRole('button',{name:'Adam QA',exact:true}).click();
  await page.getByText('Lista absencji · 1',{exact:true}).waitFor();
  assert(!await page.getByText('Celina QA',{exact:true}).isVisible());
  await page.getByRole('button',{name:'Następny miesiąc',exact:true}).click();await page.getByText('Brak wpisów w wybranym okresie.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Bieżący miesiąc',exact:true}).click();await page.getByText('Lista absencji · 1',{exact:true}).waitFor();
  await openScreen('Strefa Trenera');await page.getByText('Twój miesiąc pracy',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Odbyte: 1',exact:true}).waitFor();
  await page.getByRole('button',{name:'Zaplanowane: 1',exact:true}).waitFor();await capture('trainer');
  await page.getByRole('button',{name:'Zaplanowane: 1',exact:true}).click();await page.getByText('Zaplanowane · 1',{exact:true}).waitFor();
  const currentMonth=new Date().getMonth()+1;
  await page.getByRole('button',{name:new RegExp('^'+['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'][currentMonth%12]+' '+new Date().getFullYear()+':')}).click();
  await page.getByRole('button',{name:'Odbyte: 0',exact:true}).waitFor();
  await page.getByRole('button',{name:'Bieżący miesiąc',exact:true}).click();await page.getByRole('button',{name:'Odbyte: 1',exact:true}).waitFor();
  failRead=true;await page.getByRole('button',{name:'Odśwież podsumowanie',exact:true}).click();await page.getByText(/Nie udało się pobrać kompletnych danych/).waitFor();
  assert.equal(await page.getByRole('button',{name:'Odbyte: 1',exact:true}).count(),0);await capture('read-error');
  failRead=false;await page.getByRole('button',{name:'Spróbuj ponownie',exact:true}).click();await page.getByRole('button',{name:'Odbyte: 1',exact:true}).waitFor();
  await openScreen('Menadżer');await page.getByText('Aktualny tydzień',{exact:true}).waitFor();await capture('manager');
  assert.equal(await page.getByText('Zaplanuj kolejny tydzień',{exact:true}).count(),0);
  assert.equal(await page.getByTestId('copy-preview').count(),0);
  const schedule=page.getByTestId('manager-schedule'),other=page.getByTestId('manager-other');
  const selectSchedule=()=>schedule.getByRole('button',{name:'Zaznacz wszystkie: Treningi z Harmonogramu',exact:true});
  const weekCopy=()=>schedule.getByRole('button',{name:'Kopiuj zaznaczone (2) na następny tydzień: Treningi z Harmonogramu',exact:true});
  const monthCopy=()=>other.getByRole('button',{name:'Kopiuj zaznaczone (1) na następny miesiąc: Pozostałe Treningi',exact:true});
  await selectSchedule().press('Space');
  await other.getByRole('button',{name:'Zaznacz wszystkie: Pozostałe Treningi',exact:true}).click();
  await capture('manager-selected');
  await weekCopy().press('Enter');
  const confirm=page.getByRole('dialog',{name:'Potwierdź kopiowanie'});await confirm.waitFor();
  assert.match(await confirm.innerText(),/Do dodania: 1.*Do zastąpienia: 0.*Pominięte: 1/s);
  await capture('copy-confirm');
  for(const key of ['Tab','Tab','Shift+Tab']){await page.keyboard.press(key);assert(await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')&&!document.activeElement.closest('[inert],[aria-hidden="true"]')));}
  await page.keyboard.press('Escape');await confirm.waitFor({state:'hidden'});
  assert(!calls.some(c=>c.path==='/trainer/copy'));
  staleCopy=true;await weekCopy().click();await confirm.getByRole('button',{name:'Kopiuj',exact:true}).click();
  const copyError=page.getByRole('dialog',{name:'Nie udało się skopiować treningów'});
  await copyError.waitFor();assert.match(await copyError.innerText(),/Dane zmieniły się od podglądu/);await capture('copy-stale');
  await copyError.getByRole('button',{name:'OK',exact:true}).click();
  const previewsBefore=calls.filter(c=>c.path==='/trainer/copy-preview').length;
  staleCopy=false;await weekCopy().click();await confirm.getByRole('button',{name:'Kopiuj',exact:true}).click();
  const result=page.getByRole('dialog',{name:'Kopiowanie zakończone'});await result.waitFor();await capture('copy-result');
  assert.equal(calls.filter(c=>c.path==='/trainer/copy-preview').length,previewsBefore+1);
  const scheduleWrite=JSON.parse(calls.filter(c=>c.path==='/trainer/copy').at(-1).body);
  assert.deepEqual(scheduleWrite.items.map(i=>i.key),['item-0','item-1']);
  assert.equal(scheduleWrite.items[0].partner_client_id,fixture.clients[1].id);
  assert.deepEqual(scheduleWrite.items[0].added_groups,['Nogi']);
  assert(scheduleWrite.items.every(i=>i.fingerprint&&!i.replace));
  const offset=(day,shift)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+shift);return d.toISOString().slice(0,10);};
  assert.equal(scheduleWrite.target,offset(fixture.manager.source,7));
  await result.getByRole('button',{name:'OK',exact:true}).click();
  assert(await schedule.getByRole('button',{name:'Kopiuj zaznaczone (0) na następny tydzień: Treningi z Harmonogramu',exact:true}).isDisabled());
  await monthCopy().click();const conflict=page.getByRole('dialog',{name:'Zajęty termin'});await conflict.waitFor();await capture('copy-conflict');
  await conflict.getByRole('button',{name:'Pomiń termin',exact:true}).click();
  const nothing=page.getByRole('dialog',{name:'Brak treningów do skopiowania'});await nothing.waitFor();
  await nothing.getByRole('button',{name:'OK',exact:true}).click();assert.equal(calls.filter(c=>c.path==='/trainer/copy').length,2);
  await other.getByRole('button',{name:/Kopiowany: Celina QA/}).click();
  const beforeOverride=calls.filter(c=>c.path==='/trainer/copy-preview').length;
  await monthCopy().click();await conflict.getByRole('button',{name:'Zastąp trening',exact:true}).click();await confirm.waitFor();
  assert.equal(calls.filter(c=>c.path==='/trainer/copy-preview').length,beforeOverride+2);
  assert.match(await confirm.innerText(),/Do zastąpienia: 1/);
  await confirm.getByRole('button',{name:'Kopiuj',exact:true}).click();await result.waitFor();
  const replacement=JSON.parse(calls.filter(c=>c.path==='/trainer/copy').at(-1).body);
  assert.equal(replacement.items.length,1);assert.equal(replacement.items[0].key,'item-2');
  assert.equal(replacement.items[0].client_id,fixture.clients[0].id);assert.equal(replacement.items[0].replace,true);
  assert.equal(replacement.target,offset(fixture.manager.source,28));assert.equal(replacement.items[0].event_date,offset(fixture.manager.items[2].source_date,28));
  await result.getByRole('button',{name:'OK',exact:true}).click();
  await page.getByRole('button',{name:'Wyczyść ten tydzień',exact:true}).click();
  const clear=page.getByRole('dialog',{name:'Wyczyścić ten tydzień?'});await clear.waitFor();await clear.getByRole('button',{name:'Anuluj',exact:true}).click();
  assert(!calls.some(c=>/replace-week|clear-week/.test(c.path)));
  failManager=true;await page.getByRole('button',{name:'Następny tydzień',exact:true}).click();await page.getByText(/Syntetyczna awaria menadżera/).waitFor();await capture('manager-read-error');
  assert.equal(await page.getByTestId('manager-schedule').count(),0);
  failManager=false;emptyManager=true;await page.getByRole('button',{name:'Spróbuj ponownie',exact:true}).click();
  await page.getByText('Brak klientów z harmonogramem',{exact:true}).waitFor();await capture('manager-empty');
  await page.getByRole('button',{name:'Poprzedni tydzień',exact:true}).click();await page.getByText('Brak klientów z harmonogramem',{exact:true}).waitFor();
  if(width===320){await page.evaluate(()=>document.querySelectorAll('[dir="auto"]').forEach(el=>{const cs=getComputedStyle(el);el.style.fontSize=parseFloat(cs.fontSize)*2+'px';el.style.lineHeight=parseFloat(cs.lineHeight)*2+'px';}));await capture('text-200-percent');}
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);assert.deepEqual(dialogs,[]);
  results.push({width,status:'PASS',errors,blocked,systemDialogs:dialogs,calls});console.log(JSON.stringify({width,status:'PASS'}));await context.close();
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({build,baseline,results},null,2));
})().catch(async e=>{console.error(e);process.exitCode=1;if(debugPage&&!debugPage.isClosed()){await debugPage.screenshot({path:path.join(out,'failure.png')});fs.writeFileSync(path.join(out,'failure.txt'),await debugPage.locator('body').innerText());}}).finally(async()=>{if(browser)await browser.close();server.close();});
