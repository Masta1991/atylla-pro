// Browser QA of the built app. All API traffic is synthetic and intercepted.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=process.cwd();
const {chromium}=require(path.join(root,'.tmp/billing-qa/node_modules/playwright'));
const AxeBuilder=require(path.join(root,'.tmp/billing-qa/node_modules/@axe-core/playwright')).default;
const build=path.resolve(root,process.argv[2]||'.tmp/local-build-2.1.4-ui-final');
const out=path.join(root,'.tmp/changes-20261002/notes-browser'+(process.env.ATYLLA_QA_ZOOM==='2'?'-zoom':''));fs.mkdirSync(out,{recursive:true});
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
 for(const width of (process.env.ATYLLA_QA_WIDTH?[Number(process.env.ATYLLA_QA_WIDTH)]:process.env.ATYLLA_QA_ZOOM==='2'?[720]:[390,1440,1024,768,320,1366])){
  const context=await browser.newContext({viewport:{width,height:process.env.ATYLLA_QA_ZOOM==='2'?500:1000},deviceScaleFactor:process.env.ATYLLA_QA_ZOOM==='2'?2:1,serviceWorkers:'block',reducedMotion:width===320?'reduce':'no-preference'});
  const page=await context.newPage(),errors=[],calls=[],nativeDialogs=[];
  debugPage=page;debugCalls=calls;
  page.setDefaultTimeout(7000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',async d=>{nativeDialogs.push(d.type());await d.dismiss();});
  const events=[{id:E,client_id:C,event_date:date,event_hour:9,status:'active',is_settled:false,note:'Pierwsza sesja',main_group:'Plecy',added_groups:[],updated_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',clients:fixture}];
  const previousFriday=new Date(monday);previousFriday.setDate(monday.getDate()-3);
  const priorDate=[previousFriday.getFullYear(),String(previousFriday.getMonth()+1).padStart(2,'0'),String(previousFriday.getDate()).padStart(2,'0')].join('-');
  const nextDate=new Date(monday);nextDate.setDate(monday.getDate()+1);
  const tomorrow=[nextDate.getFullYear(),String(nextDate.getMonth()+1).padStart(2,'0'),String(nextDate.getDate()).padStart(2,'0')].join('-');
  const older={id:id(30),client_id:C,event_date:priorDate,event_hour:9,status:'active',note:'Piątek: pamiętaj o wcześniejszym zaleceniu.'};
  const newer={id:id(31),client_id:C,event_date:priorDate,event_hour:12,status:'active',note:'Piątek: sprawdź bark przed treningiem. '+('Dłuższa treść notatki. '.repeat(70))};
  const notes=[older,newer];
  events.push({...events[0],id:id(32),event_date:tomorrow,note:''});
  let failAck=false;
  const enrich=event=>({...event,pending_notes:[...notes,...events].filter(n=>!n.note_acknowledged_at&&n.note&&n.id!==event.id&&(n.event_date+'|'+String(n.event_hour).padStart(2,'0'))<(event.event_date+'|'+String(event.event_hour).padStart(2,'0'))).sort((a,b)=>b.event_date.localeCompare(a.event_date)||b.event_hour-a.event_hour)});
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
   else if(u.pathname.startsWith('/calendar/week/'))body=events.map(enrich);
   else if(/^\/calendar\/notes\/[^/]+\/read$/.test(u.pathname)){
    const note=[...notes,...events].find(n=>n.id===u.pathname.split('/')[3]);
    if(failAck){failAck=false;status=503;body={detail:'Nie udało się potwierdzić odczytu.'};}
    else if(!note||note.note!==req.postDataJSON().expected_note){status=409;body={detail:'Treść notatki zmieniła się. Otwórz ją ponownie.'};}
    else{note.note_acknowledged_at=new Date().toISOString();body={id:note.id,note_acknowledged_at:note.note_acknowledged_at};}
   }else if(u.pathname==='/calendar/')body=events.filter(e=>e.event_date===u.searchParams.get('date_from')&&e.client_id===u.searchParams.get('client_id'));
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


  const ackCalls=()=>calls.filter(c=>c.path.includes('/notes/'));
  const capture=async name=>{
    await page.screenshot({path:path.join(out,width+'-'+name+'.png')});
    const violations=(await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact));
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    results.push({width,name,violations:violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)})),overflow});
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({build,results},null,2));assert(!overflow);assert.equal(violations.length,0,JSON.stringify(results.at(-1)));
  };
  const openFirst=async()=>{await page.getByTestId('calendar-note-preview').first().click();await page.getByRole('dialog').waitFor();};
  const markRead=async()=>{await page.getByRole('dialog').getByRole('button',{name:'Oznacz jako przeczytaną',exact:true}).click();};
  await boot();const noteIndicator=slot(9).getByTestId('calendar-note-indicator');
  assert.equal(await noteIndicator.count(),1);
  assert.equal(await noteIndicator.getByTestId('calendar-note-document-icon').count(),1);
  assert.equal(await noteIndicator.getByText('2',{exact:true}).count(),0);
  await slot(9).click();await page.getByTestId('calendar-note-preview').first().waitFor();
  assert((await page.getByTestId('calendar-note-preview').first().innerText()).includes('sprawdź bark'));
  assert.equal(await page.getByTestId('calendar-note-preview-icon').count(),3);
  assert.equal(await page.getByTestId('calendar-note-preview').count(),3);
  assert.equal(await page.getByTestId('calendar-note-mark-read').first().count(),1);
  const compactReadButton=await page.getByTestId('calendar-note-mark-read').first().boundingBox();
  assert.equal(compactReadButton.width,44);assert.equal(compactReadButton.height,44);
  assert(!(await page.getByTestId('calendar-note-mark-read').first().innerText()).includes('Oznacz'));
  const drawerFocus=[];
  await page.getByTestId('calendar-note-preview').first().focus();
  for(const key of ['Tab','Shift+Tab']){
    await page.keyboard.press(key);
    const state=await page.evaluate(()=>({label:document.activeElement?.getAttribute('aria-label'),outline:getComputedStyle(document.activeElement).outlineStyle,hidden:!!document.activeElement?.closest('[inert],[aria-hidden="true"]')}));
    assert(!state.hidden);assert.equal(state.outline,'solid');drawerFocus.push({key,...state});
  }
  await openFirst();assert((await page.getByRole('dialog').innerText()).includes('sprawdź bark'));
  assert.equal(await page.getByRole('button',{name:/Następna/}).count(),0);
  await page.keyboard.press('Escape');assert.equal(ackCalls().length,0);
  await capture('drawer-preview');
  const drawer=await page.getByTestId('calendar-drawer').boundingBox();assert(drawer.y>=0);
  await openFirst();
  const reading=page.getByRole('region',{name:'Treść komunikatu'});
  await reading.focus();await page.keyboard.press('End');await page.waitForTimeout(150);
  assert(await reading.evaluate(node=>node.scrollTop>0),'Keyboard must scroll the full note');
  await page.keyboard.press('Home');
  const focus=[];for(const key of ['Tab','Tab','Shift+Tab']){await page.keyboard.press(key);const ok=await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')&&!document.activeElement.closest('[inert],[aria-hidden="true"]'));assert(ok);focus.push({key,inside:true});}
  await capture('long-note-dialog');
  await page.keyboard.press('Escape');
  await page.getByTestId('calendar-note-mark-read').first().press('Enter');await page.waitForTimeout(350);assert(newer.note_acknowledged_at);
  assert(await page.getByTestId('calendar-note-preview').first().evaluate(el=>el===document.activeElement));
  assert((await page.getByTestId('calendar-note-preview').first().innerText()).includes('wcześniejszym zaleceniu'));
  failAck=true;await page.getByTestId('calendar-note-mark-read').first().click();
  await page.getByRole('dialog',{name:'Nie udało się wykonać operacji'}).waitFor();
  await page.keyboard.press('Escape');assert(!older.note_acknowledged_at);
  await openFirst();assert((await page.getByRole('dialog').innerText()).includes('wcześniejszym zaleceniu'));
  // A changed server note cannot be acknowledged using stale displayed text.
  older.note='Zmieniona notatka — nie wolno jej ukryć';
  await markRead();await page.getByRole('dialog',{name:'Nie udało się wykonać operacji'}).waitFor();await page.keyboard.press('Escape');
  assert(!older.note_acknowledged_at);
  await page.waitForTimeout(450);assert((await page.getByTestId('calendar-note-preview').first().innerText()).includes('Zmieniona notatka'));
  await page.getByTestId('calendar-note-mark-read').first().click();await page.waitForTimeout(350);assert(older.note_acknowledged_at);
  assert((await page.getByTestId('calendar-note-preview').first().innerText()).includes('Pierwsza sesja'));
  await page.getByTestId('calendar-note-mark-read').first().click();await page.waitForTimeout(350);assert(events[0].note_acknowledged_at);
  assert(await page.getByTestId('calendar-drawer-close').evaluate(el=>el===document.activeElement));
  assert.equal(await slot(9).getByTestId('calendar-note-indicator').count(),0);
  await page.reload();await slot(9).getByText(/Session QA/).first().waitFor();
  assert.equal(await slot(9).getByTestId('calendar-note-indicator').count(),0);
  assert.equal(await page.locator('[data-slot-date="'+tomorrow+'"][data-slot-hour="9"]').getByTestId('calendar-note-indicator').count(),0);
  // A later note edit reopens the server reminder; both Monday and Tuesday receive it.
  newer.note='Ponownie ważna notatka';newer.note_acknowledged_at=null;
  await page.reload();await slot(9).getByText(/Session QA/).first().waitFor();
  assert.equal(await page.locator('[data-slot-date="'+tomorrow+'"][data-slot-hour="9"]').getByTestId('calendar-note-indicator').count(),1);
  await capture('reminder-reopened');assert.deepEqual(errors,[]);
  results.push({width,status:'PASS',checks:['single-note-icon-no-count','friday-to-monday','drawer-two-lines','direct-drawer-read','view-does-not-ack','durable-read','all-reminders-removed','failed-read-retained','stale-text-conflict','original-note-preserved','edited-note-reopened'],drawerFocus,focus,errors,ackCount:ackCalls().length});
  await context.close();
 }

 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({build,results},null,2));
 console.log(JSON.stringify({status:'PASS',results}));
})().catch(async e=>{console.error(e);if(debugPage){await debugPage.screenshot({path:path.join(out,'failure.png')});console.error((await debugPage.locator('body').innerText()).slice(-2500));console.error(JSON.stringify(debugCalls.slice(-8)));}process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
