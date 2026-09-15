// Render the actual local PWA. Every API response/write is synthetic and intercepted.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'),build=path.resolve(root,process.argv[2]),baseline=process.argv[3]==='baseline';
const imageOnly=process.argv[3]==='image';
const {chromium}=require(path.join(root,'.tmp/billing-qa/node_modules/playwright'));
const AxeBuilder=require(path.join(root,'.tmp/billing-qa/node_modules/@axe-core/playwright')).default;
const fixture=JSON.parse(fs.readFileSync(path.join(root,'.tmp/trainer-panels-20260915/fixture.json'),'utf8'));
const out=path.join(root,'.tmp/generator-20260915',baseline?'baseline':'browser');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 let file=path.resolve(build,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
 if(!file.startsWith(build+path.sep)&&file!==build){res.writeHead(403);return res.end();}
 if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(build,'index.html');
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
let browser,page;const results=[];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-background-networking','--no-first-run']});
 for(const width of (imageOnly?[390]:baseline?[390,1440]:[390,1440,1024,768,320])){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:width===320?'reduce':'no-preference'});
  page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[],blocked=[],calls=[];let failSave=false,failLibrary=false,failPlanRead=false;
  const groups=[{id:'g1',name:'Nogi'},{id:'g2',name:'Cardio'}];
  const exercises=[{id:'e1',name:'Przysiad',unit:'KG',muscle_group_id:'g1',sort_order:0},{id:'e2',name:'Bieg',unit:'KM',muscle_group_id:'g2',sort_order:0},{id:'e3',name:'Plank',unit:'SEK',muscle_group_id:'g1',sort_order:1}];
  const plans=[{id:'p1',name:'Trening A'},{id:'p2',name:'Trening B'}];
  let planRows=[{id:'r1',plan_id:'p1',exercise_id:'e1',sort_order:0,sets_data:[{reps:'8',weight:'40'}],superset_id:'00000000-0000-4000-8000-000000000009'},
    {id:'r2',plan_id:'p1',exercise_id:'e2',sort_order:1,sets_data:[{reps:'1',weight:'5'}],superset_id:'00000000-0000-4000-8000-000000000009'}];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{errors.push('System dialog: '+d.type());await d.dismiss();});
  await context.addInitScript(()=>{window.syntheticShares=[];window.open=url=>{window.syntheticShares.push(url);return null;};Object.defineProperty(navigator,'canShare',{value:undefined,configurable:true});localStorage.setItem('atylla_session_v2',JSON.stringify({access_token:'synthetic-offline',refresh_token:'synthetic-refresh',idle_token:'synthetic-lease',idle_expires_at:Math.floor(Date.now()/1000)+259200,session_id:'synthetic-session',email:'nobody@example.invalid',revision:0}));if(innerWidth===320)localStorage.setItem('appThemeMode','light');});
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());if(u.origin===origin)return route.continue();
   if(u.origin!=='http://127.0.0.1:8000'){blocked.push(u.origin);return route.abort();}
   calls.push({path:u.pathname,method:req.method(),body:req.postData()});let body=[],status=200;
   const payload=req.postData()?req.postDataJSON():null;
   if(u.pathname==='/auth/activity')body={idle_token:'synthetic-lease',idle_expires_at:Math.floor(Date.now()/1000)+259200,session_id:'synthetic-session'};
   else if(u.pathname==='/clients/')body=fixture.clients;
   else if(u.pathname.startsWith('/calendar/week/'))body=fixture.events;
   else if(u.pathname==='/calendar/stats')body={chart_data:[]};
   else if(u.pathname==='/trainer/overview'){
    body=structuredClone(Object.values(fixture.overview)[0]);
    body.months=Array.from({length:12},(_,i)=>({month:i+1,done:i===0?550:i===7?3:12,planned:i===7?1:0,paid:i===7?2:0,free:i===7?1:0,unknown:0,total:i===0?550:i===7?7:12}));
   }else if(u.pathname==='/config/muscle-groups'){
    if(req.method()==='POST'){body={id:'g'+(groups.length+1),...payload};groups.push(body);}else body=groups;
   }else if(u.pathname==='/config/exercises/by-group'){
    if(failLibrary){status=503;body={detail:'Syntetyczny błąd biblioteki'};}
    else body=Object.fromEntries(groups.map(g=>[g.name,exercises.filter(e=>e.muscle_group_id===g.id)]));
   }else if(u.pathname==='/config/exercises'&&req.method()==='POST'){
    body={id:'e'+(exercises.length+1),...payload};exercises.push(body);
   }else if(u.pathname==='/config/plans'){
    if(req.method()==='POST'){body={id:'p'+(plans.length+1),...payload};plans.push(body);}else body=plans;
   }else if(/^\/config\/plans\/[^/]+\/exercises$/.test(u.pathname)){
    const id=u.pathname.split('/')[3];
    if(req.method()==='POST'){body={id:'r'+(planRows.length+1),plan_id:id,...payload};planRows.push(body);}
    else if(failPlanRead){status=503;body={detail:'Syntetyczny błąd planu'};}else body=planRows.filter(r=>r.plan_id===id).sort((a,b)=>a.sort_order-b.sort_order).map(r=>({...r,exercises:{...exercises.find(e=>e.id===r.exercise_id),muscle_groups:{name:groups.find(g=>g.id===exercises.find(e=>e.id===r.exercise_id)?.muscle_group_id)?.name}}}));
   }else if(u.pathname.startsWith('/config/plan-exercises/')){
    const id=u.pathname.split('/').at(-1);
    if(req.method()==='PUT'){if(failSave&&id==='r2'){status=503;body={detail:'Syntetyczny błąd zapisu'};}else{body=planRows.find(r=>r.id===id);Object.assign(body,payload);}}
    else if(req.method()==='DELETE'){planRows=planRows.filter(r=>r.id!==id);body={status:'deleted'};}
   }
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':'*'}});
  });
  async function open(label){await page.goto(origin);await page.getByText('ATYLLA PRO',{exact:true}).first().waitFor();await page.waitForTimeout(350);await page.mouse.click(32,105);await page.getByText('Wyloguj',{exact:true}).waitFor();await page.getByText(label,{exact:true}).click();await page.waitForTimeout(300);}
  async function pick(label,option){await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('dialog',{name:label}).getByRole('button',{name:option,exact:true}).click();}
  async function capture(name){
   await page.screenshot({path:path.join(out,`${width}-${name}.png`)});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   const axe=await new AxeBuilder({page}).analyze(),violations=axe.violations.filter(v=>['serious','critical'].includes(v.impact));
   results.push({width,name,overflow,violations:violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)}))});
   if(!baseline){assert(!overflow,name+' overflow');assert.equal(violations.length,0,JSON.stringify(results.at(-1)));}
  }
  await open('Plany treningowe');
  assert.equal(await page.getByRole('button',{name:'Nowy plan',exact:true}).count(),0);
  await pick('Wybierz partię lub plan','Partia · Nogi');
  await pick('Wybierz partię lub plan','Plan · Trening A');
  const groupPreview=page.getByTestId('preview-group:g1'),planPreview=page.getByTestId('preview-plan:p1');
  await planPreview.getByText('Seria 1: 1 × 5 km',{exact:true}).waitFor();
  await groupPreview.getByText('1. Przysiad',{exact:true}).waitFor();
  assert.equal(await page.getByRole('textbox').count(),0);await capture('combined-preview');
  if(imageOnly){
    await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{value:()=>true,configurable:true});Object.defineProperty(navigator,'share',{value:async data=>{const f=data.files[0];window.syntheticImage={name:f.name,type:f.type,size:f.size,bytes:Array.from(new Uint8Array(await f.arrayBuffer()))};},configurable:true});});
    await page.getByRole('button',{name:'Wyślij plan przez WhatsApp',exact:true}).click();await page.waitForFunction(()=>!!window.syntheticImage,{},{timeout:30000});
    const exported=await page.evaluate(()=>window.syntheticImage);assert.equal(exported.type,'image/png');assert(exported.size>1000);fs.writeFileSync(path.join(out,'combined-export.png'),Buffer.from(exported.bytes));assert.deepEqual(await page.evaluate(()=>window.syntheticShares),[]);assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);
    console.log(JSON.stringify({status:'PASS',scope:'local PNG export with intercepted navigator.share; no recipient or network',bytes:exported.size}));await context.close();continue;
  }
  const previewOrder=await page.locator('[data-testid^="preview-"]').evaluateAll(elements=>elements.map(e=>e.dataset.testid));
  assert.deepEqual(previewOrder,['preview-group:g1','preview-plan:p1']);
  await page.getByRole('button',{name:'Wyślij plan przez WhatsApp',exact:true}).click();
  const shared=await page.evaluate(()=>window.syntheticShares);
  assert.equal(shared.length,1);const text=new URL(shared[0]).searchParams.get('text');
  assert(text.includes('*Nogi*'));assert(text.includes('*Trening A*'));assert(text.includes('1 × 5 km'));assert(text.indexOf('*Nogi*')<text.indexOf('*Trening A*'));
  await page.getByRole('button',{name:'Usuń Nogi z podglądu',exact:true}).click();assert.equal(await groupPreview.count(),0);
  assert(!calls.some(c=>c.method==='DELETE'));
  // A failed plan remains explicit and cannot be sent; retry retains other selected blocks.
  await open('Plany treningowe');failPlanRead=true;
  await pick('Wybierz partię lub plan','Partia · Cardio');await pick('Wybierz partię lub plan','Plan · Trening A');
  await page.getByText(/Nie udało się pobrać tego planu/).waitFor();
  assert(await page.getByRole('button',{name:'Wyślij plan przez WhatsApp',exact:true}).isDisabled());await capture('preview-read-error');
  failPlanRead=false;await page.getByRole('button',{name:'Pobierz ponownie',exact:true}).click();await page.getByText('Seria 1: 1 × 5 km',{exact:true}).waitFor();await page.getByTestId('preview-group:g2').waitFor();
  await open('Generator ćwiczeń i planów');await capture('generator');
  await pick('Partia lub plan do edycji','Partia · Nogi');await page.getByText('Nogi · 2 ćwiczeń',{exact:true}).waitFor();
  assert.equal(await page.getByText('Bieg',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Przejdź do planów',exact:true}).count(),0);
  await page.getByRole('button',{name:'Nowe ćwiczenie',exact:true}).click();await page.getByLabel('Nazwa ćwiczenia',{exact:true}).fill('Wspięcia QA');
  await pick('Jednostka wyniku','POW · powtórzenia');await page.getByRole('button',{name:'Dodaj ćwiczenie',exact:true}).click();
  await page.getByText('Wspięcia QA',{exact:true}).waitFor();assert.equal(exercises.at(-1).muscle_group_id,'g1');assert.equal(exercises.at(-1).unit,'POW');await capture('selected-group');
  await page.getByRole('button',{name:'Nowa partia',exact:true}).click();await page.getByLabel('Nazwa partii',{exact:true}).fill('Mobilność');await page.getByRole('button',{name:'Dodaj partię',exact:true}).click();
  await page.getByText('Mobilność · 0 ćwiczeń',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Nowe ćwiczenie',exact:true}).click();await page.getByLabel('Nazwa ćwiczenia',{exact:true}).fill('Rozciąganie QA');await pick('Jednostka wyniku','MIN · minuty');await page.getByRole('button',{name:'Dodaj ćwiczenie',exact:true}).click();await page.getByText('Rozciąganie QA',{exact:true}).waitFor();
  await pick('Partia lub plan do edycji','Plan · Trening A');
  const first=page.getByTestId('plan-exercise-0'),second=page.getByTestId('plan-exercise-1');await second.waitFor();await capture('selected-plan');
  assert.equal(await page.getByRole('button',{name:'Podgląd i udostępnianie',exact:true}).count(),0);
  await second.getByLabel('Dystans (km)',{exact:true}).fill('6.5');
  await pick('Partia lub plan do edycji','Partia · Nogi');
  const guard=page.getByRole('dialog',{name:'Niezapisane zmiany'});await guard.waitFor();
  await page.keyboard.press('Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')));await page.keyboard.press('Escape');await second.waitFor();
  assert.equal(await second.getByLabel('Dystans (km)',{exact:true}).inputValue(),'6.5');
  await page.mouse.click(29,85);await page.getByRole('dialog',{name:'Niezapisane zmiany'}).waitFor();await page.keyboard.press('Escape');await second.waitFor();
  await first.getByRole('button',{name:'Rozłącz superserię',exact:true}).click();
  failSave=true;await page.getByRole('button',{name:'Zapisz plan',exact:true}).first().click();await page.getByRole('dialog').getByText(/Nie wszystkie zmiany/).waitFor();await page.getByRole('dialog').getByRole('button',{name:'OK',exact:true}).click();
  failSave=false;await page.getByRole('button',{name:'Zapisz plan',exact:true}).first().click();await page.getByText('Plan zapisany.',{exact:true}).waitFor();assert(planRows.every(r=>r.superset_id===null));
  await pick('Ćwiczenie do dodania','Rozciąganie QA · Mobilność · min');await page.getByRole('button',{name:'Dodaj do planu',exact:true}).click();await page.getByTestId('plan-exercise-2').waitFor();
  await page.getByRole('button',{name:'Nowy plan',exact:true}).click();await page.getByLabel('Nazwa planu',{exact:true}).fill('Nowy QA');await page.getByRole('button',{name:'Utwórz plan',exact:true}).click();await page.getByText('0 ćwiczeń · 0 serii',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Stwórz nowe ćwiczenie',exact:true}).click();await page.getByLabel('Nazwa nowego ćwiczenia',{exact:true}).fill('Trucht QA');await pick('Partia nowego ćwiczenia','Cardio');await pick('Jednostka nowego ćwiczenia','KM · kilometry');await capture('create-in-plan');
  await page.getByRole('button',{name:'Utwórz i dodaj do planu',exact:true}).click();await page.getByText('1. Trucht QA',{exact:true}).waitFor();assert.equal(exercises.at(-1).muscle_group_id,'g2');assert.equal(planRows.at(-1).plan_id,'p3');assert.equal(planRows.at(-1).exercise_id,exercises.at(-1).id);
  await page.getByTestId('plan-exercise-0').getByRole('button',{name:'Dodaj serię',exact:true}).click();await page.getByLabel('Dystans (km)',{exact:true}).fill('2');await page.getByLabel('Razy',{exact:true}).fill('1');await page.getByRole('button',{name:'Zapisz plan',exact:true}).first().click();await page.getByText('Plan zapisany.',{exact:true}).waitFor();
  await open('Plany treningowe');await pick('Wybierz partię lub plan','Plan · Nowy QA');await pick('Wybierz partię lub plan','Partia · Mobilność');await page.getByText('Seria 1: 1 × 2 km',{exact:true}).waitFor();await page.getByText('1. Rozciąganie QA',{exact:true}).waitFor();await capture('new-combined-preview');
  await open('Strefa Trenera');await page.getByRole('button',{name:/^Sierpień 2026:/}).click();await page.getByTestId('annual-chart').scrollIntoViewIfNeeded();
  const bars=await page.locator('[data-testid$="-total"]').evaluateAll(elements=>elements.map(e=>({color:getComputedStyle(e).backgroundColor,height:e.getBoundingClientRect().height})));
  assert.equal(bars.length,12);assert.equal(new Set(bars.map(b=>b.color)).size,1);assert(Math.abs(bars[7].height-280*7/552)<0.1);await capture('single-color-year');
  const detail=page.getByTestId('month-exact-values');await detail.scrollIntoViewIfNeeded();await detail.getByText('Sierpień 2026 · 7 sesji',{exact:true}).waitFor();await detail.getByText('Odwołane, nieopłacone',{exact:true}).waitFor();await capture('month-details');
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);results.push({width,status:'PASS',writes:calls.filter(c=>['POST','PUT','DELETE'].includes(c.method)),share:'intercepted window.open; no message sent'});console.log(JSON.stringify({width,status:'PASS'}));await context.close();

 }
 fs.writeFileSync(path.join(out,imageOnly?'image-report.json':'report.json'),JSON.stringify({build,baseline,results},null,2));
})().catch(async e=>{console.error(e);process.exitCode=1;if(page&&!page.isClosed()){await page.screenshot({path:path.join(out,'failure.png')});fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText());}}).finally(async()=>{if(browser)await browser.close();server.close();});
