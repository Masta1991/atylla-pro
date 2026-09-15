// Browser QA of the built app. All API traffic is synthetic and intercepted.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const {chromium}=require(path.join(root,'.tmp/billing-qa/node_modules/playwright'));
const AxeBuilder=require(path.join(root,'.tmp/billing-qa/node_modules/@axe-core/playwright')).default;
const build=path.resolve(root,process.argv[2]||'.tmp/local-build-2.1.4-ui-final');
const out=path.join(root,'.tmp/session-browser-20260915');fs.mkdirSync(out,{recursive:true});
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const C=id(1),E=id(2),X=id(3),G=id(4);
const now=new Date(),monday=new Date(now);monday.setDate(now.getDate()-((now.getDay()+6)%7));
const date=[monday.getFullYear(),String(monday.getMonth()+1).padStart(2,'0'),String(monday.getDate()).padStart(2,'0')].join('-');
const fixture={id:C,name:'Session QA',billing_type:'package',package_size:10,package_current_count:1,active_package_id:id(5),updated_at:'2026-01-01T00:00:00Z',shared_with:[],training_schedule:[],strength_progression:[],payment_history:[]};
const server=http.createServer((req,res)=>{
 let file=path.resolve(build,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
 if(!file.startsWith(build+path.sep)&&file!==build){res.writeHead(403);return res.end();}
 if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(build,'index.html');
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.ttf':'font/ttf','.png':'image/png','.css':'text/css'})[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).pipe(res);
});
let browser,debugPage,debugCalls;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-background-networking','--disable-component-update','--no-first-run']});
 const results=[];
 for(const width of [390,1440,1024,768,320]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:width===320?'reduce':'no-preference'});
  const page=await context.newPage(),errors=[],calls=[],nativeDialogs=[];
  debugPage=page;debugCalls=calls;
  page.setDefaultTimeout(7000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',async d=>{nativeDialogs.push(d.type());await d.dismiss();});
  const events=[{id:E,client_id:C,event_date:date,event_hour:9,status:'active',is_settled:false,note:'Pierwsza sesja',main_group:'Plecy',added_groups:[],updated_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',clients:fixture}];
  const eventLogs={[E]:[{id:id(6),client_id:C,calendar_event_id:E,exercise_id:X,session_date:date,weight_kg:10,reps:5}]};
  let serial=20;
  await context.addInitScript(()=>{
   localStorage.setItem('atylla_session_v2',JSON.stringify({access_token:'synthetic-offline',refresh_token:'synthetic-refresh',idle_token:'synthetic-lease',idle_expires_at:Math.floor(Date.now()/1000)+259200,session_id:'synthetic-session',email:'nobody@example.invalid',revision:0}));
   if(innerWidth===320)localStorage.setItem('appThemeMode','light');
  });
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin===origin)return route.continue();
   if(u.origin!=='http://127.0.0.1:8000')return route.abort();
   calls.push({path:u.pathname,query:u.search,method:req.method()});
   await new Promise(r=>setTimeout(r,u.pathname==='/clients/'?400:60));
   let body=[],status=200;
   if(u.pathname==='/auth/activity')body={idle_token:'synthetic-lease',idle_expires_at:Math.floor(Date.now()/1000)+259200,session_id:'synthetic-session'};
   else if(u.pathname==='/clients/')body=[fixture];
   else if(u.pathname==='/clients/'+C)body=fixture;
   else if(u.pathname.includes('/exercises/by-group'))body={Plecy:[{id:X,name:'Wioslowanie QA',unit:'KG'}]};
   else if(u.pathname.includes('/muscle-groups'))body=[{id:G,name:'Plecy'}];
   else if(u.pathname.startsWith('/calendar/week/'))body=events;
   else if(u.pathname==='/calendar/')body=events.filter(e=>e.event_date===u.searchParams.get('date_from')&&e.client_id===u.searchParams.get('client_id'));
   else if(/^\/calendar\/\d{4}-\d\d-\d\d\/\d+$/.test(u.pathname)){
    const parts=u.pathname.split('/');body=events.find(e=>e.event_date===parts[2]&&e.event_hour===Number(parts[3]));
    if(!body){status=404;body={detail:'Not found'};}
   }else if(u.pathname==='/workouts/client/'+C){
    const event=u.searchParams.get('calendar_event_id');
    body=event?eventLogs[event]||[]:Object.values(eventLogs).flat();
   }else if(u.pathname==='/calendar/save-workout'){
    const p=req.postDataJSON();
    const prior=events.find(e=>e.event_date===p.event_date&&e.event_hour===p.event_hour);
    if(!prior&&events.some(e=>e.client_id===p.client_id&&e.event_date===p.event_date)&&!p.confirm_duplicate){
      status=409;body={detail:{code:'duplicate_session',message:'Trening dla tego klienta jest już zarejestrowany tego dnia. Dodać kolejny?'}};
    }else{
      const event={...prior,...p,id:prior?.id||id(serial++),updated_at:new Date().toISOString(),clients:fixture};
      if(prior)events.splice(events.indexOf(prior),1,event);else events.push(event);
      eventLogs[event.id]=p.exercises.map((log,index)=>({...log,id:id(100+index),calendar_event_id:event.id,client_id:C,session_date:p.event_date}));
      body={event,logs:eventLogs[event.id]};
    }
   }
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':'*'}});
  });
  async function boot(){await page.goto(origin);await page.locator('[data-slot-hour="9"]').getByText(/Session QA/).first().waitFor();}
  const slot=h=>page.locator('[data-slot-date="'+date+'"][data-slot-hour="'+h+'"]');
  await boot();
  await page.evaluate(()=>{
   window.drawerFrames=[];
   const observe=()=>{
    const drawer=document.querySelector('[data-testid="calendar-drawer"]');
    if(drawer){window.drawerFrames.push({text:drawer.textContent,height:drawer.getBoundingClientRect().height});}
    if(window.drawerFrames.length<12)requestAnimationFrame(observe);
   };requestAnimationFrame(observe);
  });
  const offset=calls.length;
  await slot(9).click();
  await page.getByText('Zakończ pakiet',{exact:true}).waitFor();
  await page.waitForTimeout(260);
  const drawer=await page.evaluate(()=>window.drawerFrames);
  assert(drawer.length>0&&drawer.every(f=>f.text.includes('Zakończ pakiet')));
  assert.equal(new Set(drawer.map(f=>f.height)).size,1);
  assert(!calls.slice(offset).some(c=>c.path==='/clients/'+C),'Drawer must not fetch individual client');
  await page.screenshot({path:path.join(out,width+'-drawer.png')});
  // Open a new slot and choose the same client.
  await boot();await slot(12).click();await page.getByText('Dodaj',{exact:true}).click();
  await page.getByRole('button',{name:'Wybierz',exact:true}).waitFor();
  async function chooseClient(){
   await page.getByRole('button',{name:'Wybierz',exact:true}).click();
   await page.getByRole('button',{name:'Session QA',exact:true}).click();
   await page.getByRole('dialog',{name:'Kolejny trening tego dnia'}).waitFor();
  }
  await chooseClient();
  const dialog=page.getByRole('dialog',{name:'Kolejny trening tego dnia'});
  const focus=[];
  for(const key of ['Tab','Tab','Shift+Tab','Shift+Tab']){
   await page.keyboard.press(key);
   const state=await page.evaluate(()=>({name:document.activeElement.getAttribute('aria-label'),inside:!!document.activeElement.closest('[role="dialog"]'),hidden:!!document.activeElement.closest('[inert],[aria-hidden="true"]'),outline:getComputedStyle(document.activeElement).outlineStyle}));
   assert(state.inside&&!state.hidden);assert.equal(state.outline,'solid');focus.push({key,...state});
  }
  const axe=await new AxeBuilder({page}).analyze();
  const violations=axe.violations.filter(v=>['critical','serious'].includes(v.impact));
  await page.screenshot({path:path.join(out,width+'-confirmation.png')});
  fs.writeFileSync(path.join(out,'latest-axe.json'),JSON.stringify(violations,null,2));
  assert.equal(violations.length,0);
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  assert.equal(events.length,1);
  assert.equal(await page.getByRole('button',{name:'Wybierz',exact:true}).evaluate(el=>el===document.activeElement),true);
  await chooseClient();
  await page.getByRole('button',{name:'Anuluj',exact:true}).press('Space');
  await dialog.waitFor({state:'detached'});
  assert.equal(events.length,1);
  await chooseClient();await page.getByRole('button',{name:'OK',exact:true}).press('Enter');
  await dialog.waitFor({state:'detached'});
  await page.waitForTimeout(100);
  assert.equal(await page.getByLabel('Ciężar: Wioslowanie QA').count(),0);
  assert.equal(await page.getByPlaceholder('Opcjonalna notatka...').inputValue(),'');
  assert(!calls.some(c=>c.path==='/workouts/client/'+C),'New session must not read day logs');
  await page.getByRole('button',{name:'Brak',exact:true}).click();
  await page.getByRole('button',{name:'Plecy',exact:true}).click();
  await page.getByText('Wioslowanie QA',{exact:true}).click();
  await page.getByLabel('Ciężar: Wioslowanie QA').fill('20');
  await page.getByPlaceholder('Opcjonalna notatka...').fill('Druga sesja');
  await page.getByText('ZAPISZ TRENING',{exact:true}).click();
  await page.getByRole('dialog',{name:'Sukces'}).waitFor();
  await page.getByRole('button',{name:'OK',exact:true}).click();
  await page.getByText('ATYLLA PRO',{exact:true}).first().waitFor();
  assert.equal(events.length,2);
  assert.equal(eventLogs[E][0].weight_kg,10);
  const second=events.find(e=>e.event_hour===12);
  assert.equal(eventLogs[second.id][0].weight_kg,20);
  await slot(12).click();await page.getByText('Trening',{exact:true}).click();
  await page.getByLabel('Ciężar: Wioslowanie QA').waitFor();
  assert.equal(await page.getByLabel('Ciężar: Wioslowanie QA').inputValue(),'20');
  assert(calls.some(c=>c.path==='/workouts/client/'+C&&c.query.includes('calendar_event_id='+second.id)));
  assert.equal(nativeDialogs.length,0);assert.deepEqual(errors,[]);
  results.push({width,drawerFrames:drawer,focus,violations,nativeDialogs,errors,readRequests:calls.filter(c=>c.method==='GET').length,scope:'synthetic API; 400ms clients delay; real rendered build'});
  console.log(JSON.stringify({width,status:'PASS',drawerFrames:drawer.length}));
  await context.close();
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({build,results},null,2));
})().catch(async e=>{console.error(e);if(debugPage){await debugPage.screenshot({path:path.join(out,'failure.png')});console.error((await debugPage.locator('body').innerText()).slice(-3500));console.error(JSON.stringify(debugCalls.slice(-8)));}process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
