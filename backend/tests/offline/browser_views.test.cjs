// Local built PWA, synthetic intercepted API only. No production connections.
const fs=require('node:fs'), path=require('node:path'), http=require('node:http');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const {chromium}=require(path.join(root,'.tmp/billing-qa/node_modules/playwright'));
const AxeBuilder=require(path.join(root,'.tmp/billing-qa/node_modules/@axe-core/playwright')).default;
const build=path.resolve(root,process.argv[2] || '.tmp/local-build-2.1.0-0374ee851484419b8fbd1152fcb0f363');
if(!build.startsWith(path.join(root,'.tmp')+path.sep)) throw Error('Build must be local .tmp');
const reportName=process.argv[3]||'browser-billing-qa';
if(!/^[a-z0-9-]+$/.test(reportName))throw Error('Invalid report folder');
const out=path.join(root,'.tmp',reportName); fs.mkdirSync(out,{recursive:true});
const cid='00000000-0000-4000-8000-000000000002';
const fixture={id:cid,name:'Synthetic QA',billing_type:'package',package_size:10,package_current_count:0,
  active_package_id:'00000000-0000-4000-8000-000000000004',package_pending_start:true,package_purchase_date:null,
  shared_with:[],training_schedule:[],strength_progression:[],payment_history:[]};
const contentTypes={'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.gif':'image/gif','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
  const requested=decodeURIComponent(new URL(req.url,'http://local').pathname);
  let file=path.resolve(build,'.'+requested);
  if(!file.startsWith(build+path.sep)&&file!==build){res.writeHead(403);res.end();return;}
  if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(build,'index.html');
  res.setHeader('Content-Type',contentTypes[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
let browser;
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args:['--disable-background-networking','--disable-component-update','--no-first-run']});
  const results=[];
  for(const width of [1440,1024,768,390,320]){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:width===320?'reduce':'no-preference',serviceWorkers:'block'});
    const page=await context.newPage();
    let pending=0,last=0;
    const calls=[],errors=[],blocked=[];
    page.on('pageerror',e=>errors.push(e.message));
    await context.addInitScript(()=>{localStorage.setItem('atylla_session_v2',JSON.stringify({access_token:'synthetic-offline',refresh_token:'synthetic-refresh',idle_token:'synthetic-lease',idle_expires_at:Math.floor(Date.now()/1000)+259200,session_id:'synthetic-session',email:'nobody@example.invalid',revision:0}));});
    await context.route('**/*',async route=>{
      const u=new URL(route.request().url());
      if(u.origin===origin)return route.continue();
      if(u.origin!=='http://127.0.0.1:8000'){blocked.push(u.origin);return route.abort();}
      pending++; calls.push({path:u.pathname+u.search,method:route.request().method(),at:Date.now()});
      await new Promise(r=>setTimeout(r,100));
      let body=[];
      if(u.pathname==='/auth/activity')body={idle_token:'synthetic-renewed',idle_expires_at:Math.floor(Date.now()/1000)+259200,session_id:'synthetic-session'};
      else if(u.pathname==='/clients/')body=[fixture];
      else if(u.pathname===`/clients/${cid}`)body=fixture;
      else if(u.pathname.endsWith('/exercises/by-group'))body={};
      else if(u.pathname.startsWith('/calendar/week-summary/'))body={events:[],absences:[],deleted:[],summary:{}};
      else if(/^\/calendar\/\d{4}-\d\d-\d\d\/\d+$/.test(u.pathname))body=null;
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':'*'}});
      pending--;last=Date.now();
    });
    async function quiet(){const end=Date.now()+8000;while(Date.now()<end){if(!pending&&Date.now()-last>250)return;await new Promise(r=>setTimeout(r,40));}throw Error('Requests did not settle');}
    async function record(name,fn){const start=Date.now(),offset=calls.length;await fn();await quiet();
      const data=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,
        resources:performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,bytes:r.transferSize})),
        focus:{tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.slice(0,80)}}));
      results.push({width,name,elapsedWithQuietWindowMs:Date.now()-start,api:calls.slice(offset),...data});
      await page.screenshot({path:path.join(out,`${width}-${name}.png`)});
      console.log(JSON.stringify({width,name,requests:calls.length-offset,errors}));
    }
    async function calendarPage(){await page.goto(origin);await page.getByText('ATYLLA PRO',{exact:true}).first().waitFor();await page.waitForTimeout(200);await quiet();}
    await record('calendar',calendarPage);
    // Native-stack screens are exercised through actual menu taps, no private navigation hooks.
    for(const [label,name] of [['Klienci','clients'],['Rozliczenia','payments'],['Raporty','reports'],['Pomiary','measurements'],['Podsumowanie tygodnia','week-summary']]){
      await calendarPage();
      await page.mouse.click(32,105);
      await page.getByText('Wyloguj',{exact:true}).waitFor();
      await record(name,async()=>{await page.getByText(label,{exact:true}).click();await page.getByText(label,{exact:true}).first().waitFor();});
      if(name==='payments'){
        await page.getByText('oczekuje na kolejny trening',{exact:true}).waitFor();
        if(await page.getByText('Nowy Pakiet',{exact:true}).count())throw Error('Waiting package offers duplicate package');
      }
      if(name==='reports'){
        await page.getByText('Wybierz klienta',{exact:true}).click();
        await page.getByRole('dialog',{name:'Wybierz klienta'}).waitFor();
        const dialog=page.getByRole('dialog',{name:'Wybierz klienta'});
        await page.getByRole('button',{name:'Zamknij wybór'}).waitFor();
        const focusSequence=[];
        for(const key of ['Tab','Tab','Tab','Shift+Tab','Shift+Tab','Shift+Tab']){
          await page.keyboard.press(key);
          const focus=await page.evaluate(()=>({
            name:document.activeElement.getAttribute('aria-label'),
            inDialog:!!document.activeElement.closest('[role="dialog"]'),
            hidden:!!document.activeElement.closest('[inert],[aria-hidden="true"]'),
            outline:getComputedStyle(document.activeElement).outlineStyle
          }));
          assert.equal(focus.inDialog,true);
          assert.equal(focus.hidden,false);
          assert.equal(focus.outline,'solid');
          focusSequence.push({key,...focus});
        }
        assert.equal(await page.evaluate(()=>document.getElementById('root').inert),true);
        const before=await page.evaluate(()=>({tag:document.activeElement.tagName,text:document.activeElement.textContent.slice(0,80)}));
        const axe=await new AxeBuilder({page}).analyze();
        await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await page.keyboard.press('Escape');
        await page.waitForTimeout(350);
        const after=await page.evaluate(()=>({tag:document.activeElement.tagName,text:document.activeElement.textContent.slice(0,80)}));
        assert.equal(await page.getByRole('button',{name:'Wybierz klienta',exact:true}).getAttribute('aria-expanded'),'false');
        assert.equal(await page.getByRole('button',{name:'Wybierz klienta',exact:true}).evaluate(el=>el===document.activeElement),true);
        await page.keyboard.press('Enter');
        await dialog.waitFor();
        await page.getByRole('button',{name:'Zamknij wybór'}).press('Space');
        await dialog.waitFor({state:'detached'});
        await page.keyboard.press('Space');
        await dialog.waitFor();
        await page.screenshot({path:path.join(out,`${width}-picker.png`)});
        await page.mouse.click(5,5);
        await dialog.waitFor({state:'detached'});
        results.push({width,name:'picker-accessibility',before,after,focusSequence,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({html:n.html,target:n.target}))}))});
        assert.equal(axe.violations.filter(v=>v.impact==='critical'||v.impact==='serious').length,0,'Picker critical/serious accessibility violation');
        // Reopen if Escape dismissed the native modal.
        if(!await page.getByText('Synthetic QA',{exact:true}).isVisible())await page.getByText('Wybierz klienta',{exact:true}).first().click();
        await page.getByText('Synthetic QA',{exact:true}).click();
        await record('generate-report',()=>page.getByText('Generuj raport',{exact:true}).click());
      }
    }
    await calendarPage();
    await record('training',async()=>{
      await page.getByText('Pon',{exact:true}).click();
      await page.getByText('Rejestracja treningu',{exact:true}).waitFor();
    });
    results.push({width,errors,blocked});
    await context.close();
  }
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({build,apiDelayMs:100,scope:'synthetic API browser checks; not production timings',results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
