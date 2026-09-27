// Browser QA of the built app. All API traffic is synthetic and intercepted.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=process.cwd();
const {chromium}=require(path.join(root,'.tmp/billing-qa/node_modules/playwright'));
const AxeBuilder=require(path.join(root,'.tmp/billing-qa/node_modules/@axe-core/playwright')).default;
const build=path.resolve(root,process.argv[2]||'.tmp/local-build-2.1.4-ui-final');
const out=path.join(root,'.tmp/audit-fixes-20260926/training');fs.mkdirSync(out,{recursive:true});
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
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:width===320?'reduce':'no-preference'});
  const page=await context.newPage(),errors=[],calls=[],nativeDialogs=[];
  debugPage=page;debugCalls=calls;
  page.setDefaultTimeout(7000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',async d=>{nativeDialogs.push(d.type());await d.dismiss();});
  const events=[{id:E,client_id:C,event_date:date,event_hour:9,status:'active',is_settled:false,note:'Pierwsza sesja',main_group:'Plecy',added_groups:[],updated_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',clients:fixture}];
  const eventLogs={[E]:[{id:id(6),client_id:C,calendar_event_id:E,exercise_id:X,session_date:date,weight_kg:10,reps:5}]};
  let serial=20, delaySave=false, saveStarted=false, failNextSave=false;
  await context.addInitScript(()=>{
   localStorage.setItem('atylla_session_v2',JSON.stringify({access_token:'synthetic-offline',refresh_token:'synthetic-refresh',idle_token:'synthetic-lease',idle_expires_at:Math.floor(Date.now()/1000)+259200,session_id:'synthetic-session',email:'nobody@example.invalid',revision:0}));
   if(innerWidth===320)localStorage.setItem('appThemeMode','light');
  });
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin===origin)return route.continue();
   if(u.origin!=='http://127.0.0.1:8000')return route.abort();
   calls.push({path:u.pathname,query:u.search,method:req.method(),payload:req.postData()?req.postDataJSON():null});
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
    const p=req.postDataJSON(); saveStarted=true; if(delaySave) {delaySave=false; await new Promise(r=>setTimeout(r,4500));}
    const prior=events.find(e=>e.event_date===p.event_date&&e.event_hour===p.event_hour);
    if(failNextSave){failNextSave=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Syntetyczny błąd zapisu'})});}
    if(prior && (p.expected_event_id!==prior.id || p.expected_updated_at!==prior.updated_at)){return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({detail:'Nieaktualna wersja'})});}
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


  const writeCalls=()=>calls.filter(c=>c.path==='/calendar/save-workout');
  async function until(test){for(let n=0;n<100&&!test();n++)await page.waitForTimeout(100);assert(test());}
  async function enter(){await slot(9).click();await page.getByText('Trening',{exact:true}).click();await page.getByLabel('Ciężar: Wioslowanie QA').waitFor();}
  await boot();await enter();
  // A first edit within the old 1200ms suppression window must be saved.
  await page.getByPlaceholder('Opcjonalna notatka...').fill('Szybka zmiana');
  await until(()=>events.find(e=>e.id===E).note==='Szybka zmiana');
  await page.getByText('Zmiany zapisane',{exact:true}).waitFor();
  const offset=writeCalls().length;saveStarted=false;delaySave=true;
  await page.getByPlaceholder('Opcjonalna notatka...').fill('Wersja A');
  await until(()=>saveStarted);
  await page.getByPlaceholder('Opcjonalna notatka...').fill('Wersja B - najnowsza');
  await page.mouse.click(29,85);await page.getByRole('dialog',{name:'Trwa zapisywanie'}).waitFor();
  await page.keyboard.press('Escape');
  await until(()=>events.find(e=>e.id===E).note==='Wersja B - najnowsza');
  await page.getByText('Zmiany zapisane',{exact:true}).waitFor();
  assert.equal(writeCalls().length-offset,2);
  assert.notEqual(writeCalls().at(-1).payload.expected_updated_at,writeCalls().at(-2).payload.expected_updated_at);
  await page.screenshot({path:path.join(out,width+'-latest-saved.png')});
  await page.mouse.click(29,85); await enter();
  assert.equal(await page.getByPlaceholder('Opcjonalna notatka...').inputValue(),'Wersja B - najnowsza');
  // No automatic retry after an uncertain failure, even if the user keeps typing.
  failNextSave=true;
  await page.getByPlaceholder('Opcjonalna notatka...').fill('Zapis z błędem');
  await page.getByRole('dialog',{name:'Brak potwierdzenia automatycznego zapisu'}).waitFor();await page.keyboard.press('Escape');
  const failedCount=writeCalls().length;
  await page.getByPlaceholder('Opcjonalna notatka...').fill('Po błędzie - zachowaj');await page.waitForTimeout(1800);
  assert.equal(writeCalls().length,failedCount);
  await page.mouse.click(29,85);await page.getByRole('dialog',{name:'Niezapisane zmiany'}).waitFor();
  await page.keyboard.press('Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')));
  await page.keyboard.press('Escape');assert.equal(await page.getByPlaceholder('Opcjonalna notatka...').inputValue(),'Po błędzie - zachowaj');
  await page.getByText('ZAPISZ TRENING',{exact:true}).click();await page.getByRole('dialog',{name:'Sukces'}).waitFor();
  await page.getByRole('button',{name:'OK',exact:true}).click();await enter();
  assert.equal(await page.getByPlaceholder('Opcjonalna notatka...').inputValue(),'Po błędzie - zachowaj');
  assert.equal(nativeDialogs.length,0);assert.deepEqual(errors,[]);
  results.push({width,status:'PASS',checks:['first-fast-edit','slow-write-latest-wins','exit-during-write','new-version-for-next-write','reopen-retains-latest','failure-stops-retry','exit-cancel-retains-draft','manual-save-after-failure'],writes:writeCalls()});
  await context.close();
 }

 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({build,results},null,2));
 console.log(JSON.stringify({status:'PASS',results}));
})().catch(async e=>{console.error(e);if(debugPage){await debugPage.screenshot({path:path.join(out,'failure.png')});console.error((await debugPage.locator('body').innerText()).slice(-2500));console.error(JSON.stringify(debugCalls.slice(-8)));}process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
