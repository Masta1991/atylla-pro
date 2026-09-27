// Render the actual local PWA. Every API response/write is synthetic and intercepted.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=process.cwd(),build=path.resolve(root,process.argv[2]),baseline=process.argv[3]==='baseline';
const imageOnly=process.argv[3]==='image';
const {chromium}=require(path.join(root,'.tmp/billing-qa/node_modules/playwright'));
const AxeBuilder=require(path.join(root,'.tmp/billing-qa/node_modules/@axe-core/playwright')).default;
const fixture={clients:[],events:[],overview:{qa:{rows:[],clients:[],totals:{paid:0,free:0,unknown:0,done:0,planned:0}}}};
const out=path.join(root,'.tmp/audit-fixes-20260926/forms'+(process.env.ATYLLA_QA_ZOOM==='2'?'-zoom':''));fs.mkdirSync(out,{recursive:true});
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
 for(const width of (process.env.ATYLLA_QA_ZOOM==='2'?[720]:[390,1440,1024,768,320,1366])){
  const context=await browser.newContext({viewport:{width,height:process.env.ATYLLA_QA_ZOOM==='2'?500:1000},deviceScaleFactor:process.env.ATYLLA_QA_ZOOM==='2'?2:1,serviceWorkers:'block',reducedMotion:width===320?'reduce':'no-preference'});
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
  await pick('Wybierz partię lub plan','Plan · Trening A');
  const preview=page.getByTestId('preview-plan:p1');
  await preview.getByText('Seria 1: 1 × 5 km',{exact:true}).waitFor();
  const previewText=await preview.innerText();
  await page.getByRole('button',{name:'Wyślij plan przez WhatsApp',exact:true}).click();
  const shared=await page.evaluate(()=>window.syntheticShares);
  const shareText=new URL(shared[0]).searchParams.get('text');
  assert(planRows[0].superset_id && planRows[0].superset_id===planRows[1].superset_id);
  assert.equal((previewText.match(/Superseria 1/g)||[]).length,2); assert.equal((shareText.match(/Superseria 1/g)||[]).length,2);
  results.push({width,id:'PLAN-01',status:'PASS',previewText,shareText});
  await capture('superset-preserved');

  await open('Generator ćwiczeń i planów');
  await page.getByRole('button',{name:'Nowy plan',exact:true}).click();
  await page.getByLabel('Nazwa planu',{exact:true}).fill('Niezapisany plan QA');
  await page.getByRole('button',{name:'Nowa partia',exact:true}).click();
  await page.getByRole('dialog',{name:'Niezapisane zmiany'}).waitFor();
  await page.keyboard.press('Tab');
  assert(await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')));
  await page.keyboard.press('Escape');
  assert.equal(await page.getByLabel('Nazwa planu',{exact:true}).inputValue(),'Niezapisany plan QA');
  await capture('guard-switch-works');

  async function guardedBack(field,value,title) {
    await page.mouse.click(29,85);
    const dialog=page.getByRole('dialog',{name:title}); await dialog.waitFor();
    const focus=[];
    for(const key of ['Tab','Tab','Shift+Tab','Shift+Tab']) {
      await page.keyboard.press(key);
      const state=await page.evaluate(()=>({inside:!!document.activeElement.closest('[role="dialog"]'),hidden:!!document.activeElement.closest('[inert],[aria-hidden="true"]'),name:document.activeElement.textContent}));
      assert(state.inside&&!state.hidden);focus.push({key,...state});
    }
    await capture('guard-'+field);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByLabel(field,{exact:true}).inputValue(),value);
    await page.mouse.click(29,85); await dialog.waitFor();
    await dialog.getByRole('button',{name:'Odrzuć zmiany',exact:true}).press('Enter');
    await page.getByLabel(field,{exact:true}).waitFor({state:'detached'});
    results.push({width,id:'FORM-01',status:'PASS',field,focus});
  }
  await guardedBack('Nazwa planu','Niezapisany plan QA','Niezapisane zmiany');
  await open('Generator ćwiczeń i planów');
  await page.getByRole('button',{name:'Nowa partia',exact:true}).click();
  await page.getByLabel('Nazwa partii',{exact:true}).fill('Niezapisana partia QA');
  await guardedBack('Nazwa partii','Niezapisana partia QA','Niezapisany formularz');
  await open('Generator ćwiczeń i planów');
  await pick('Partia lub plan do edycji','Plan · Trening A');
  await page.getByTestId('plan-exercise-1').waitFor();
  await page.getByRole('button',{name:'Stwórz nowe ćwiczenie',exact:true}).click();
  await page.getByLabel('Nazwa nowego ćwiczenia',{exact:true}).fill('Niezapisane ćwiczenie QA');
  await guardedBack('Nazwa nowego ćwiczenia','Niezapisane ćwiczenie QA','Niezapisane zmiany');
  // Empty and successfully saved forms leave without a spurious warning.
  await open('Generator ćwiczeń i planów');
  await page.getByRole('button',{name:'Nowy plan',exact:true}).click();
  await page.getByLabel('Nazwa planu',{exact:true}).waitFor(); await page.mouse.click(29,85);
  await page.getByLabel('Nazwa planu',{exact:true}).waitFor({state:'detached'}); assert.equal(await page.getByRole('dialog').count(),0);
  await open('Generator ćwiczeń i planów');
  await page.getByRole('button',{name:'Nowy plan',exact:true}).click();
  await page.getByLabel('Nazwa planu',{exact:true}).fill('Zapisany QA');
  await page.getByRole('button',{name:'Utwórz plan',exact:true}).click();
  await page.getByText('0 ćwiczeń · 0 serii',{exact:true}).waitFor();
  await page.mouse.click(29,85); await page.getByText('0 ćwiczeń · 0 serii',{exact:true}).waitFor({state:'detached'});
  assert.equal(await page.getByRole('dialog').count(),0);
  assert.deepEqual(blocked,[]); assert.deepEqual(errors,[]);
  results.push({width,network:'Only local build and synthetic API; share intercepted',errors,blocked});
  await context.close();
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({build,results},null,2));
 console.log(JSON.stringify({status:'PASS',results}));
})().catch(async e=>{console.error(e);process.exitCode=1;if(page&&!page.isClosed()){await page.screenshot({path:path.join(out,'failure.png')});fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText());}}).finally(async()=>{if(browser)await browser.close();server.close();});
