// Browser contract tests with synthetic HTTP responses; SQL is tested separately.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=process.cwd(),{chromium}=require(path.join(root,'.tmp/billing-qa/node_modules/playwright'));
const build=path.resolve(process.argv[2]),out=path.resolve(process.env.ATYLLA_QA_OUTPUT||path.join(root,'.tmp/absences-20261011/browser'));fs.mkdirSync(out,{recursive:true});
const apiOrigin=process.env.ATYLLA_QA_API_ORIGIN||'http://127.0.0.1:8000';
const server=http.createServer((req,res)=>{const requested=decodeURIComponent(req.url.split('?')[0]);let f=path.join(build,requested);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){if(requested.startsWith('/assets/')||requested.startsWith('/_expo/')){res.writeHead(404);res.end();return;}f=path.join(build,'index.html');}res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.ico':'image/x-icon'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res)});
const clients=['Adam QA','Beata QA'].map((name,i)=>({id:`00000000-0000-4000-8000-00000000000${i+1}`,name,training_schedule:i?[]:[{day:0,hour:9}],billing_type:'package',payment_history:[],strength_progression:[]}));
const date=days=>{const d=new Date();d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const day=date(2),future=date(9),revision='2026-10-11T00:00:00Z';
const option=(hour,extra={})=>({date:day,hour,kind:'event',event_id:`00000000-0000-4000-8000-${String(100+hour).padStart(12,'0')}`,updated_at:revision,paired:false,...extra});
let browser;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=process.env.ATYLLA_QA_LIVE_BASE||`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const results=[];
 const variants=[...['dark','light'].flatMap(theme=>[320,390,768,1024,1366,1440].map(width=>({theme,width,height:width===1366?768:900}))),{theme:'dark',width:844,height:390},{theme:'dark',width:720,height:500,reflow200:true}];
 for(const variant of variants){
  const {width,height,theme}=variant,key=`${theme}-${width}${variant.reflow200?'-reflow200':''}`;
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:variant.reflow200?2:1,serviceWorkers:'block',reducedMotion:width===1440?'no-preference':'reduce',timezoneId:'Europe/Warsaw'});
  const page=await context.newPage();page.setDefaultTimeout(10000);let abs=[],writes=[],deletes=0,optionsError=false,writeError=false,unknownCommit=false,readError=false,slowWrite=false,conflictSchedule=false,becameEvent=false;
  const errors=[],blocked=[],consoleErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('status of 503')&&!m.text().includes('status of 502')&&!m.text().includes('status of 409'))consoleErrors.push(m.text())});
  await context.addInitScript(({theme})=>{localStorage.setItem('atylla_session_v2',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',idle_token:'synthetic',idle_expires_at:Math.floor(Date.now()/1000)+259200,session_id:'synthetic',email:'nobody@example.invalid',revision:0}));localStorage.setItem('appThemeMode',theme);},{theme});
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   // Live mode reads public static files only. Every API call, including writes,
   // is fulfilled below with synthetic fixtures before it reaches the server.
   if(url.origin===origin&&(!process.env.ATYLLA_QA_LIVE_BASE||(req.method()==='GET'&&(url.pathname==='/'||url.pathname.startsWith('/assets/')||url.pathname.startsWith('/_expo/')||['/favicon.ico','/manifest.json','/apple-touch-icon.png','/icon-192.png','/icon-512.png'].includes(url.pathname)))))return route.continue();
   if(url.origin!==apiOrigin){blocked.push(url.origin);return route.abort();}
   let body=[],status=200;
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS'}});
   if(url.pathname==='/auth/activity')body={idle_token:'synthetic',idle_expires_at:Math.floor(Date.now()/1000)+259200,session_id:'synthetic'};
   else if(url.pathname==='/clients/')body=clients;
   else if(url.pathname.startsWith('/calendar/absence-options/')){
    const cid=url.pathname.split('/').pop();
    if(optionsError){status=503;body={detail:'Syntetyczny błąd terminów'};}
    else body=[option(9),option(10,{paired:true}),option(11),...(cid===clients[0].id?[option(9,{date:future,kind:becameEvent?'event':'scheduled',event_id:becameEvent?'00000000-0000-4000-8000-000000000999':null,updated_at:becameEvent?revision:null})]:[])].filter(o=>!abs.some(a=>a.client_id===cid&&a.absence_date===o.date&&a.absence_hour===o.hour));
   } else if(url.pathname==='/calendar/absences/batch'){
    const items=req.postDataJSON().items;writes.push(items);if(slowWrite)await new Promise(r=>setTimeout(r,250));
    if(conflictSchedule){status=409;becameEvent=true;conflictSchedule=false;body={detail:'Termin został zmieniony. Odśwież listę terminów.'};}
    else if(writeError){status=503;body={detail:'Syntetyczny błąd zapisu — nic nie zapisano'};}
    else {body=items.map((item,i)=>({...item,id:`absence-${writes.length}-${i}`,clients:{name:clients.find(c=>c.id===item.client_id).name}}));abs.push(...body);if(unknownCommit){status=502;body={detail:'Nie udało się potwierdzić zapisu'};}}
   } else if(url.pathname==='/calendar/absences'){
    if(readError){status=503;body={detail:'Syntetyczny błąd historii'};}else body=abs;
   } else if(req.method()==='DELETE'&&url.pathname.startsWith('/calendar/absences/')){deletes++;abs=abs.filter(a=>a.id!==url.pathname.split('/').pop());body={status:'deleted'};}
   else if(url.pathname==='/trainer/overview')body={rows:[],clients,totals:{paid:0,free:0,unknown:0},updated_at:new Date().toISOString()};
   else if(url.pathname==='/calendar/stats')body={chart_data:[]};
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':'*'}});
  });
  async function iconFonts(){
    await page.evaluate(()=>document.fonts.ready);
    const fonts=await page.evaluate(()=>Array.from(document.fonts,f=>({family:f.family,status:f.status})));
    for(const family of ['ionicons','material-community'])assert(fonts.some(f=>f.family.toLowerCase().includes(family)&&f.status==='loaded'),`${key}: missing icon font ${family}: ${JSON.stringify(fonts)}`);
    assert(!fonts.some(f=>f.status==='error'),`${key}: failed font`);
    return fonts;
  }
  async function open(){try{await page.goto(origin);await page.getByText('ATYLLA PRO',{exact:true}).first().waitFor();await page.waitForTimeout(400);await page.screenshot({path:path.join(out,`${key}-calendar.png`),fullPage:true});await iconFonts();await page.getByRole('button',{name:'Otwórz menu',exact:true}).click();await page.getByText('Wyloguj',{exact:true}).waitFor();await page.screenshot({path:path.join(out,`${key}-menu.png`),fullPage:true});await page.getByText('Absencje',{exact:true}).click();await page.getByText('Zgłoś Absencję',{exact:true}).waitFor();}catch(e){await page.screenshot({path:path.join(out,`${key}-startup-error.png`),fullPage:true});console.error(JSON.stringify({key,errors,blocked,consoleErrors,body:await page.locator('body').innerText()}));throw e;}}
  async function choose(name='Adam QA'){await page.getByRole('button',{name:'Wybierz klienta',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();await page.getByRole('button',{name:'— Rozwiń listę dat —',exact:true}).click();await page.getByRole('button',{name:new RegExp(`9:00 \\(${day}\\)`)}).waitFor();}
  const slot=hour=>page.getByRole('button',{name:new RegExp(`${hour}:00 \\(${day}\\)`)});
  async function snap(state){
    await page.waitForTimeout(100);const fonts=await iconFonts();await page.screenshot({path:path.join(out,`${key}-${state}.png`),fullPage:true});
    await page.addScriptTag({path:path.join(root,'.tmp/billing-qa/node_modules/axe-core/axe.min.js')});
    const violations=await page.evaluate(async()=> (await axe.run()).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)})));
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!overflow,`${key}/${state} overflow`);assert.deepEqual(violations,[],`${key}/${state} axe`);
    results.push({...variant,state,overflow,violations,fonts});
  }
  await open();await page.getByText('Brak zgłoszonych absencji w wyświetlanym okresie.',{exact:true}).waitFor();
  await choose();await snap('options');
  const regular=page.getByRole('button',{name:new RegExp(`\\(${future}\\)`)});assert.notEqual(await regular.getAttribute('aria-disabled'),'true');await regular.click();
  await slot(9).focus();await page.keyboard.press('Space');assert.equal(await slot(9).getAttribute('aria-pressed'),'true');
  await slot(10).click();assert.equal(await slot(10).getAttribute('aria-pressed'),'true');
  slowWrite=true;const save=page.getByRole('button',{name:'Zapisz Absencję',exact:true});await save.click();
  await page.getByText('Zapisano absencje',{exact:true}).waitFor();assert.equal(writes.length,1);assert.equal(writes[0].length,3);
  assert(writes[0].every(p=>p.client_id===clients[0].id&&(p.mode==='cancel'?p.paid&&p.expected_event_id&&p.expected_updated_at===revision:!p.paid&&p.expected_event_id===null&&p.expected_updated_at===null)));
  assert.equal(writes[0].filter(p=>p.mode==='schedule').length,1);assert.equal(abs.length,3);await snap('success');
  await page.getByRole('button',{name:'OK',exact:true}).click();assert.equal(await page.getByRole('button',{name:/Usuń absencję/}).count(),3);
  const trash=page.getByRole('button',{name:/Usuń absencję/}).first();await trash.click();await page.getByText('Usuń oznaczenie absencji',{exact:true}).waitFor();
  await snap('delete-confirm');
  for(let i=0;i<7;i++){await page.keyboard.press(i%2?'Shift+Tab':'Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')));}
  await page.keyboard.press('Escape');assert.equal(deletes,0);assert(await trash.evaluate(e=>e===document.activeElement));
  await trash.click();await page.getByRole('button',{name:'Usuń oznaczenie',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('[aria-label]')].filter(e=>e.getAttribute('aria-label').startsWith('Usuń absencję')).length===2);assert.equal(deletes,1);
  writeError=true;await slot(11).click();await page.getByRole('button',{name:'Zapisz Absencję',exact:true}).click();await page.getByText('Syntetyczny błąd zapisu — nic nie zapisano',{exact:true}).waitFor();await snap('write-error');await page.getByRole('button',{name:'OK',exact:true}).click();
  assert.equal(writes.length,2);assert.equal(abs.length,2);assert.equal(await slot(11).getAttribute('aria-pressed'),'true');
  writeError=false;unknownCommit=true;await page.getByRole('button',{name:'Zapisz Absencję',exact:true}).click();await page.getByText('Nie udało się potwierdzić zapisu',{exact:true}).waitFor();await page.getByRole('button',{name:'OK',exact:true}).click();assert.equal(writes.length,3);assert.equal(abs.length,3);assert.equal(await slot(11).count(),0);
  // An option-read failure must not turn into an empty state or enable writes.
  optionsError=true;await page.getByRole('button',{name:'Wybierz klienta',exact:true}).click();await page.getByRole('button',{name:'Beata QA',exact:true}).click();await page.getByRole('button',{name:'— Rozwiń listę dat —',exact:true}).click();await page.getByText('Syntetyczny błąd terminów',{exact:true}).waitFor();await snap('options-error');
  optionsError=false;await page.getByRole('button',{name:'Ponów odczyt terminów',exact:true}).click();await slot(9).waitFor();
  // A stale free scheduling choice must never become consent to a paid cancellation.
  abs=[];unknownCommit=false;conflictSchedule=true;await choose('Adam QA');
  await page.getByRole('button',{name:new RegExp(`\\(${future}\\)`)}).click();
  await page.getByRole('button',{name:'Zapisz Absencję',exact:true}).click();await page.getByText('Termin został zmieniony. Odśwież listę terminów.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'OK',exact:true}).click();
  const changed=page.getByRole('button',{name:new RegExp(`\\(${future}\\)`)});
  assert.equal(await changed.getAttribute('aria-pressed'),'false');
  assert.equal(await page.getByRole('button',{name:'Zapisz Absencję',exact:true}).getAttribute('aria-disabled'),'true');
  assert.equal(writes.length,4);assert.equal(writes[3][0].mode,'schedule');assert.equal(abs.length,0);
  await snap('changed-slot-requires-new-selection');
  await changed.click();await page.getByRole('button',{name:'Zapisz Absencję',exact:true}).click();await page.getByText('Zapisano absencje',{exact:true}).waitFor();
  assert.equal(writes.length,5);assert.equal(writes[4][0].mode,'cancel');assert.equal(writes[4][0].paid,true);await page.getByRole('button',{name:'OK',exact:true}).click();
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);assert.deepEqual(consoleErrors,[]);results.push({...variant,status:'PASS',batchWrites:writes.length,errors,blocked,consoleErrors});await context.close();
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',synthetic:true,results},null,2));console.log(JSON.stringify({status:'PASS',variants:variants.length,states:results.length}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();server.close();});
