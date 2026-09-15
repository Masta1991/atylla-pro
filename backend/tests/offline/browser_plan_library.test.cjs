// Render the actual local PWA. Every API response/write is synthetic and intercepted.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'),build=path.resolve(root,process.argv[2]),baseline=process.argv[3]==='baseline';
const {chromium}=require(path.join(root,'.tmp/billing-qa/node_modules/playwright'));
const AxeBuilder=require(path.join(root,'.tmp/billing-qa/node_modules/@axe-core/playwright')).default;
const fixture=JSON.parse(fs.readFileSync(path.join(root,'.tmp/trainer-panels-20260915/fixture.json'),'utf8'));
const out=path.join(root,'.tmp/library-20260915',baseline?'baseline':'browser');fs.mkdirSync(out,{recursive:true});
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
 for(const width of (baseline?[390,1440]:[390,1440,1024,768,320])){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:width===320?'reduce':'no-preference'});
  page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[],blocked=[],calls=[];let failSave=false,failLibrary=false;
  const groups=[{id:'g1',name:'Nogi'},{id:'g2',name:'Cardio'}];
  const exercises=[{id:'e1',name:'Przysiad',unit:'KG',muscle_group_id:'g1',sort_order:0},{id:'e2',name:'Bieg',unit:'KM',muscle_group_id:'g2',sort_order:0},{id:'e3',name:'Plank',unit:'SEK',muscle_group_id:'g1',sort_order:1}];
  const plans=[{id:'p1',name:'Trening A'},{id:'p2',name:'Trening B'}];
  let planRows=[{id:'r1',plan_id:'p1',exercise_id:'e1',sort_order:0,sets_data:[{reps:'8',weight:'40'}],superset_id:'00000000-0000-4000-8000-000000000009'},
    {id:'r2',plan_id:'p1',exercise_id:'e2',sort_order:1,sets_data:[{reps:'1',weight:'5'}],superset_id:'00000000-0000-4000-8000-000000000009'}];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{errors.push('System dialog: '+d.type());await d.dismiss();});
  await context.addInitScript(()=>{localStorage.setItem('atylla_session_v2',JSON.stringify({access_token:'synthetic-offline',refresh_token:'synthetic-refresh',idle_token:'synthetic-lease',idle_expires_at:Math.floor(Date.now()/1000)+259200,session_id:'synthetic-session',email:'nobody@example.invalid',revision:0}));if(innerWidth===320)localStorage.setItem('appThemeMode','light');});
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
    else body=planRows.filter(r=>r.plan_id===id).sort((a,b)=>a.sort_order-b.sort_order).map(r=>({...r,exercises:{...exercises.find(e=>e.id===r.exercise_id),muscle_groups:{name:groups.find(g=>g.id===exercises.find(e=>e.id===r.exercise_id)?.muscle_group_id)?.name}}}));
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
  await open('Strefa Trenera');await page.getByRole('button',{name:/^Sierpień 2026:/}).click();
  if(baseline){await page.getByText('Treningi w roku 2026',{exact:true}).scrollIntoViewIfNeeded();await capture('chart');
   await open('Ustawienia');await page.getByText('Edytor planów treningowych',{exact:true}).click();await page.waitForTimeout(300);
   await page.getByRole('button').filter({hasText:'Wybierz plan'}).click();await page.getByRole('dialog').getByRole('button',{name:'Trening A',exact:true}).click();await capture('plan');
   await open('Ustawienia');await page.getByText('Ćwiczenia z podziałem na partie mięśniowe',{exact:true}).click();await capture('library');await context.close();continue;
  }
  await page.getByTestId('annual-chart').scrollIntoViewIfNeeded();await capture('chart');
  const exact=page.getByTestId('month-exact-values');await exact.scrollIntoViewIfNeeded();
  for(const v of ['Sierpień 2026 · 7 sesji','3','1','2'])assert(await exact.getByText(v,{exact:true}).count()>0);
  assert.equal(await page.getByTestId('month-bars-8').evaluate(el=>el.getBoundingClientRect().height),280);
  const height=await page.getByTestId('month-8-done').evaluate(el=>el.getBoundingClientRect().height);assert(Math.abs(height-280*3/552)<0.1);
  await capture('august-values');await page.getByRole('button',{name:'Pokaż liczby całego roku',exact:true}).click();await page.getByText('Styczeń · 550 sesji',{exact:true}).waitFor();
  await open('Ćwiczenia i partie');await page.getByText('Biblioteka ćwiczeń',{exact:true}).waitFor();await capture('library');
  await page.getByLabel('Szukaj ćwiczenia',{exact:true}).fill('Bieg');assert.equal(await page.getByText('Przysiad',{exact:true}).count(),0);await page.getByText('Bieg',{exact:true}).waitFor();
  await page.getByLabel('Szukaj ćwiczenia',{exact:true}).fill('');
  await page.getByRole('button',{name:'Partie mięśniowe',exact:true}).click();await page.getByLabel('Nazwa partii',{exact:true}).fill('Mobilność');await page.getByRole('button',{name:'Dodaj partię',exact:true}).click();await page.getByText('Mobilność',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Ćwiczenia',exact:true}).click();await page.getByRole('button',{name:'Nowe ćwiczenie',exact:true}).click();
  await page.getByLabel('Nazwa ćwiczenia',{exact:true}).fill('Rozciąganie QA');await pick('Jednostka wyniku','MIN · minuty');await capture('new-exercise');
  await page.getByRole('button',{name:'Dodaj ćwiczenie',exact:true}).click();await page.getByText('Ćwiczenie dodane do biblioteki.',{exact:true}).waitFor();
  assert.equal(exercises.at(-1).unit,'MIN');assert.equal(exercises.at(-1).muscle_group_id,'g3');
  await page.getByRole('button',{name:'Usuń ćwiczenie Rozciąganie QA',exact:true}).click();const deletion=page.getByRole('dialog',{name:'Usunąć „Rozciąganie QA”?' });await deletion.waitFor();await capture('delete-confirm');await page.keyboard.press('Escape');
  assert(!calls.some(c=>c.method==='DELETE'));await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Usuń ćwiczenie Rozciąganie QA');
  await open('Plany treningowe');await pick('Wybierz plan','Trening A');await page.getByTestId('plan-exercise-0').waitFor();await capture('plan');
  const first=page.getByTestId('plan-exercise-0'),second=page.getByTestId('plan-exercise-1');
  await second.getByLabel('Dystans (km)',{exact:true}).fill('6.5');await first.getByRole('button',{name:'Rozłącz superserię',exact:true}).click();
  failSave=true;await page.getByRole('button',{name:'Zapisz plan',exact:true}).first().click();await page.getByRole('dialog').getByText(/Nie wszystkie zmiany/).waitFor();await page.getByRole('dialog').getByRole('button',{name:'OK',exact:true}).click();
  assert.equal(await second.getByLabel('Dystans (km)',{exact:true}).inputValue(),'6.5');await page.getByText('Masz niezapisane zmiany',{exact:true}).waitFor();
  failSave=false;await page.getByRole('button',{name:'Zapisz plan',exact:true}).first().click();await page.getByText('Plan zapisany.',{exact:true}).waitFor();
  assert(planRows.every(r=>r.superset_id===null));assert.equal(planRows[1].sets_data[0].weight,'6.5');
  await first.getByRole('button',{name:'Dodaj serię',exact:true}).click();assert.equal(await first.getByLabel('Ciężar (kg)',{exact:true}).last().inputValue(),'');
  await pick('Wybierz plan','Trening B');await page.getByRole('dialog',{name:'Niezapisane zmiany'}).getByRole('button',{name:'Anuluj',exact:true}).click();await first.waitFor();
  await page.getByRole('button',{name:'Zapisz plan',exact:true}).first().click();await page.getByText('Plan zapisany.',{exact:true}).waitFor();
  await pick('Ćwiczenie do dodania','Rozciąganie QA · Mobilność · min');await page.getByRole('button',{name:'Dodaj do planu',exact:true}).click();await page.getByTestId('plan-exercise-2').waitFor();assert.equal(planRows[0].sets_data.length,2);
  const third=page.getByTestId('plan-exercise-2');await third.getByRole('button',{name:'Dodaj serię',exact:true}).click();await third.getByLabel('Czas (min)',{exact:true}).fill('3');await third.scrollIntoViewIfNeeded();await capture('unit-series');
  await page.mouse.click(29,85);const unsaved=page.getByRole('dialog',{name:'Niezapisane zmiany'});await unsaved.waitFor();
  for(const key of ['Tab','Shift+Tab']){await page.keyboard.press(key);assert(await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')&&!document.activeElement.closest('[inert]')));}
  await page.keyboard.press('Escape');await third.waitFor();
  await page.getByRole('button',{name:'Zapisz plan',exact:true}).first().click();await page.getByText('Plan zapisany.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Podgląd i udostępnianie',exact:true}).click();
  await page.getByRole('button',{name:'— Wybierz plan —',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Trening A',exact:true}).click();await page.getByText(/Seria 1:\s+1 × 6.5 km/).waitFor();await capture('preview');
  await open('Plany treningowe');await page.getByRole('button',{name:'Nowy plan',exact:true}).click();await page.getByLabel('Nazwa planu',{exact:true}).fill('Nowy QA');await page.getByRole('button',{name:'Utwórz plan',exact:true}).click();await page.getByText('0 ćwiczeń · 0 serii',{exact:true}).waitFor();
  failLibrary=true;await open('Ćwiczenia i partie');await page.getByText(/Nie udało się pobrać kompletnych danych/).waitFor();await capture('read-error');failLibrary=false;await page.getByRole('button',{name:'Spróbuj ponownie',exact:true}).click();await page.getByText('Ćwiczenia · 4',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);results.push({width,status:'PASS',writes:calls.filter(c=>['POST','PUT','DELETE'].includes(c.method))});console.log(JSON.stringify({width,status:'PASS'}));await context.close();
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({build,baseline,results},null,2));
})().catch(async e=>{console.error(e);process.exitCode=1;if(page&&!page.isClosed()){await page.screenshot({path:path.join(out,'failure.png')});fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText());}}).finally(async()=>{if(browser)await browser.close();server.close();});
