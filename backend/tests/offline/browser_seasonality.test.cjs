// Actual local web bundle, synthetic intercepted API only; no external network.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const {chromium}=require(path.join(root,'.tmp/billing-qa/node_modules/playwright'));
const AxeBuilder=require(path.join(root,'.tmp/billing-qa/node_modules/@axe-core/playwright')).default;
const build=path.resolve(root,process.argv[2]||'.tmp/local-build-2.1.18-20261002-seasonality');
assert(build.startsWith(path.join(root,'.tmp')+path.sep),'Only local build allowed');
const out=path.join(root,'.tmp/changes-20261002/seasonality-browser');fs.mkdirSync(out,{recursive:true});
const months=['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
const now=new Date(),year=now.getFullYear(),past=year-1;
const server=http.createServer((req,res)=>{
 let file=path.resolve(build,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
 if(!file.startsWith(build+path.sep)&&file!==build){res.writeHead(403);return res.end();}
 if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(build,'index.html');
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.ttf':'font/ttf','.png':'image/png','.css':'text/css','.ico':'image/x-icon'})[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).pipe(res);
});
let browser,debugPage;
const results=[];
const write=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({build,results},null,2));
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-background-networking','--disable-component-update','--no-first-run']});
 const widths=process.env.ATYLLA_QA_WIDTH?[Number(process.env.ATYLLA_QA_WIDTH)]:[320,390,768,1024,1366,1440];
 for(const width of widths){
  const context=await browser.newContext({viewport:{width,height:width===1366||width===1024?768:1000},serviceWorkers:'block',reducedMotion:width===320?'reduce':'no-preference',timezoneId:'Europe/Warsaw'});
  const page=await context.newPage();debugPage=page;page.setDefaultTimeout(10000);
  const calls=[],errors=[],blocked=[],nativeDialogs=[],focusChecks=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{nativeDialogs.push(d.type());await d.dismiss();});
  let serial=1,failRead=false,failWrite=false,conflict=false;
  const manual=new Map();
  const stamp=()=>new Date(Date.UTC(2020,0,1,0,0,serial++)).toISOString();
  for(let y=year-4;y<year;y++)for(let m=1;m<=12;m++)manual.set(`${y}-${m}`,{training_count:m*10,updated_at:stamp()});
  // Explicitly distinguish app observation, unknown and manual zero.
  manual.delete(`${past}-1`);manual.delete(`${past}-2`);manual.set(`${past}-3`,{training_count:0,updated_at:stamp()});
  const report=(start,end)=>{
   const cells=[];
   for(let y=start;y<=end;y++)for(let m=1;m<=12;m++){
    const row=manual.get(`${y}-${m}`),app=y===past&&m===1?42:null;
    cells.push({year:y,month:m,count:row?row.training_count:app,app_count:app,source:row?'manual':app==null?'missing':'app',partial:y===year&&m===now.getMonth()+1,eligible:y<year&&(!!row||app!=null),updated_at:row?.updated_at||null});
   }
   const usable=cells.filter(c=>c.eligible),min=Math.min(...usable.map(c=>c.count)),max=Math.max(...usable.map(c=>c.count));
   return {start_year:start,end_year:end,cells,years:Array.from({length:end-start+1},(_,i)=>({year:start+i,total:0,months:12})),best:usable.filter(c=>c.count===max),worst:usable.filter(c=>c.count===min),comparable_years:[year-4,year-3,year-2],updated_at:new Date().toISOString(),seasonal:months.map((_,i)=>({month:i+1,average:(i+1)*10,samples:3,quiet_years:i<3?3:0,busy_years:i>=9?3:0,recurring_quiet:i<3,recurring_busy:i>=9}))};
  };
  await context.addInitScript(()=>{
   localStorage.setItem('atylla_session_v2',JSON.stringify({access_token:'synthetic-offline',refresh_token:'synthetic-refresh',idle_token:'synthetic-lease',idle_expires_at:Math.floor(Date.now()/1000)+259200,session_id:'synthetic-session',email:'nobody@example.invalid',revision:0}));
   if(innerWidth===320)localStorage.setItem('appThemeMode','light');
  });
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin===origin)return route.continue();
   if(url.origin!=='http://127.0.0.1:8000'){blocked.push(url.origin);return route.abort();}
   calls.push({path:url.pathname,method:req.method(),body:req.postData()?req.postDataJSON():null});
   let body=[],status=200;
   if(url.pathname==='/auth/activity')body={idle_token:'synthetic-lease',idle_expires_at:Math.floor(Date.now()/1000)+259200,session_id:'synthetic-session'};
   else if(url.pathname==='/trainer/overview')body={totals:{done:0,planned:0,paid:0,unknown:0,clients_done:0,clients_planned:0},previous_done:0,previous_label:'',months:months.map((_,i)=>({month:i+1,total:0,done:0,paid:0,planned:0})),weeks:[],rows:[],updated_at:new Date().toISOString()};
   else if(url.pathname==='/trainer/seasonality'){
    if(failRead){failRead=false;status=503;body={detail:'Syntetyczny błąd odczytu raportu'};}
    else body=report(Number(url.searchParams.get('start_year')),Number(url.searchParams.get('end_year')));
   }else if(url.pathname.startsWith('/trainer/history/')){
    const [, , ,ys,ms]=url.pathname.split('/'),key=`${Number(ys)}-${Number(ms)}`,prior=manual.get(key),payload=req.postDataJSON();
    if(failWrite){failWrite=false;status=503;body={detail:'Syntetyczny błąd zapisu'};}
    else if(conflict){conflict=false;manual.set(key,{training_count:65,updated_at:stamp()});status=409;body={detail:'Dane zmieniły się. Odśwież raport przed zapisem.'};}
    else if((payload.expected_updated_at||null)!==(prior?.updated_at||null)){status=409;body={detail:'Nieaktualna wersja wpisu'};}
    else if(req.method()==='DELETE'){manual.delete(key);body={deleted:true};}
    else {body={training_count:payload.training_count,updated_at:stamp()};manual.set(key,body);}
   }
   await new Promise(r=>setTimeout(r,40));
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':'*'}});
  });
  const editor=()=>page.getByTestId('historical-month-editor');
  const countInput=()=>page.getByRole('textbox',{name:'Liczba treningów',exact:true});
  const tableCell=(month,y=past)=>page.getByRole('button',{name:new RegExp(`^${months[month-1]} ${y}:`)});
  const mutations=()=>calls.filter(c=>c.path.startsWith('/trainer/history/'));
  const snapshot=async name=>{
   await page.screenshot({path:path.join(out,`${width}-${name}.png`)});
   const violations=(await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact));
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   const entry={width,name,overflow,violations:violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)}))};results.push(entry);write();
   assert(!overflow,JSON.stringify(entry));assert.equal(violations.length,0,JSON.stringify(entry));
  };
  const focus=async name=>{
   await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Liczba treningów');
   const state=await page.evaluate(()=>({label:document.activeElement.getAttribute('aria-label'),connected:document.activeElement.isConnected,hidden:!!document.activeElement.closest('[inert],[aria-hidden="true"]')}));
   assert(state.connected&&!state.hidden);focusChecks.push({name,...state});
  };
  const select=async month=>{await tableCell(month).focus();await page.keyboard.press('Enter');await focus('table-'+month);};
  const save=async value=>{
   await countInput().fill(value);await page.getByRole('button',{name:'Zapisz miesiąc',exact:true}).click();
   await page.getByText('Zapisano dane historyczne.',{exact:true}).waitFor();await focus('saved-'+value);
  };
  const dismiss=async()=>{await page.getByRole('dialog').getByRole('button',{name:'OK',exact:true}).click();};
  await page.goto(origin);await page.getByText('ATYLLA PRO',{exact:true}).first().waitFor();
  await page.locator('[data-slot-hour="9"]').first().waitFor();await page.waitForTimeout(300);
  await page.mouse.click(32,105);await page.getByText('Wyloguj',{exact:true}).waitFor();
  await page.getByText('Strefa Trenera',{exact:true}).click();
  await page.getByRole('button',{name:'Raport sezonowości · porównaj lata',exact:true}).click();
  await page.getByTestId('seasonality-patterns').waitFor();
  await snapshot('overview');
  assert.match(await tableCell(1).innerText(),/42/);assert.match(await tableCell(2).innerText(),/Brak danych/);assert.match(await tableCell(3).innerText(),/^0\s/);
  await tableCell(1).scrollIntoViewIfNeeded();await snapshot('comparison');
  await select(1);assert.equal(await countInput().inputValue(),'42');
  await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await focus('editor-tab-return');
  await snapshot('editor');
  await countInput().fill('1.5');const beforeInvalid=mutations().length;
  await page.getByRole('button',{name:'Zapisz miesiąc',exact:true}).click();
  await page.getByRole('dialog').getByText('Podaj całkowitą liczbę treningów od 0 do 10000.',{exact:true}).waitFor();
  await snapshot('invalid-input-dialog');assert.equal(mutations().length,beforeInvalid);await dismiss();
  await save('0');assert.match(await tableCell(1).innerText(),/^0\s+Ręcznie/);
  await save('55');assert.match(await tableCell(1).innerText(),/^55\s+Ręcznie/);
  const firstSave=mutations().find(c=>c.method==='PUT');assert.equal(firstSave.body.expected_updated_at,null);
  assert(mutations().filter(c=>c.method==='PUT').at(-1).body.expected_updated_at);
  await page.getByRole('button',{name:'Usuń ręczny wpis',exact:true}).click();
  await page.getByRole('dialog').waitFor();await snapshot('delete-dialog');
  for(const key of ['Tab','Shift+Tab']){await page.keyboard.press(key);assert(await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')));}
  await page.getByRole('dialog').getByRole('button',{name:'Usuń wpis',exact:true}).click();
  await page.getByText('Usunięto ręczny wpis.',{exact:true}).waitFor();await focus('deleted');
  assert.match(await tableCell(1).innerText(),/^42\s+Aplikacja/);
  await select(2);assert.equal(await countInput().inputValue(),'');await save('0');assert.match(await tableCell(2).innerText(),/^0\s+Ręcznie/);
  failWrite=true;await countInput().fill('9');await page.getByRole('button',{name:'Zapisz miesiąc',exact:true}).click();
  await page.getByRole('dialog').getByText('Syntetyczny błąd zapisu',{exact:true}).waitFor();await snapshot('write-error');await dismiss();
  await focus('write-error-refresh');assert.equal(await countInput().inputValue(),'0');
  conflict=true;await countInput().fill('10');await page.getByRole('button',{name:'Zapisz miesiąc',exact:true}).click();
  await page.getByRole('dialog').getByText('Dane zmieniły się. Odśwież raport przed zapisem.',{exact:true}).waitFor();await dismiss();
  await focus('conflict-refresh');assert.equal(await countInput().inputValue(),'65');assert.match(await tableCell(2).innerText(),/^65\s+Ręcznie/);
  await page.getByRole('button',{name:'Rok historii',exact:true}).click();await page.getByRole('dialog',{name:'Rok historii'}).getByRole('button',{name:String(year),exact:true}).click();
  await page.getByRole('button',{name:'Miesiąc historii',exact:true}).click();await page.getByRole('dialog',{name:'Miesiąc historii'}).getByRole('button',{name:months[now.getMonth()],exact:true}).click();
  assert(await page.getByRole('button',{name:'Zapisz miesiąc',exact:true}).isDisabled());assert(!(await countInput().isEditable()));
  await page.getByRole('textbox',{name:'Od roku',exact:true}).fill('1999');await page.getByRole('button',{name:'Wygeneruj raport',exact:true}).click();
  await page.getByText(/Wybierz od jednego do dziesięciu lat w zakresie 2000–2100\./).waitFor();
  await page.getByRole('textbox',{name:'Od roku',exact:true}).fill(String(year-4));failRead=true;
  await page.getByRole('button',{name:'Wygeneruj raport',exact:true}).click();
  await page.getByText(/Syntetyczny błąd odczytu raportu/).waitFor();await snapshot('read-error');
  await page.getByRole('button',{name:'Wygeneruj raport',exact:true}).click();await page.getByTestId('seasonality-patterns').waitFor();
  await select(1);await snapshot('recovered-editor');
  assert.deepEqual(errors,[]);assert.deepEqual(nativeDialogs,[]);
  results.push({width,name:'behavior',status:'PASS',focusChecks,mutations:mutations(),pageErrors:errors,blocked,viewport:page.viewportSize()});write();
  console.log(JSON.stringify({width,status:'PASS',mutations:mutations().length}));await context.close();
 }
})().catch(async error=>{
 results.push({status:'FAIL',message:error.message});write();
 if(debugPage&&!debugPage.isClosed()){await debugPage.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'failure.txt'),await debugPage.locator('body').innerText().catch(()=>''));}
 console.error(error);process.exitCode=1;
}).finally(async()=>{if(browser)await browser.close();await new Promise(r=>server.close(r));});
