const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(require('path').join(process.cwd(),'.tmp/billing-qa/node_modules/playwright'));
const root=process.cwd(),build=path.resolve(process.argv[2]),baseline=process.argv.includes('--baseline'),out=path.join(root,'.tmp/audit-fixes-20260926/absences'+(process.env.ATYLLA_QA_ZOOM==='2'?'-zoom':''));fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let f=path.join(build,decodeURIComponent(req.url.split('?')[0]));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(build,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res)});
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today=iso(new Date());
const clients=['Adam QA','Beata QA','Celina QA'].map((name,i)=>({id:`00000000-0000-4000-8000-00000000000${i+1}`,name,training_schedule:i===2?[]:[{day:1,hour:9+i}],billing_type:'package',payment_history:[],strength_progression:[]}));
let browser;
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const results=[];
for(const width of (process.env.ATYLLA_QA_ZOOM==='2'?[720]:[390,1440,1024,768,320,1366])){
const ctx=await browser.newContext({viewport:{width,height:process.env.ATYLLA_QA_ZOOM==='2'?500:1000},deviceScaleFactor:process.env.ATYLLA_QA_ZOOM==='2'?2:1,serviceWorkers:'block',reducedMotion:'reduce'}),page=await ctx.newPage();page.setDefaultTimeout(8000);let abs=[{id:'sample',client_id:clients[0].id,clients:{name:'Adam QA'},absence_date:'2000-01-01',absence_hour:9}],failRead=false,onAbsences=false,failWrite=false,writes=[],errors=[],blocked=[];
page.on('pageerror',e=>errors.push(e.message));
await ctx.addInitScript(()=>{localStorage.setItem('atylla_session_v2',JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',idle_token:'synthetic',idle_expires_at:Math.floor(Date.now()/1000)+259200,session_id:'synthetic',email:'nobody@example.invalid',revision:0}));if(innerWidth===320)localStorage.setItem('appThemeMode','light')});
await ctx.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.origin===origin)return route.continue();if(u.origin!==(process.env.ATYLLA_QA_API_ORIGIN||'http://127.0.0.1:8000')){blocked.push(u.origin);return route.abort()}let body=[],status=200;
if(u.pathname==='/auth/activity')body={idle_token:'synthetic',idle_expires_at:Math.floor(Date.now()/1000)+259200,session_id:'synthetic'};
else if(u.pathname==='/clients/')body=clients;
else if(u.pathname==='/calendar/absences'){
 if(req.method()==='POST'){const p=req.postDataJSON();writes.push(p);if(failWrite){status=503;body={detail:'Syntetyczny błąd zapisu'}}else {body={...p,id:'new'+writes.length,clients:{name:clients.find(c=>c.id===p.client_id).name}};abs.push(body)}}else if(failRead&&onAbsences){status=503;body={detail:'Syntetyczny błąd odczytu'}}else body=abs;
}else if(req.method()==='DELETE'){abs=abs.filter(a=>!u.pathname.endsWith(a.id));body={status:'deleted'}}
else if(u.pathname==='/trainer/overview')body={rows:[],clients,totals:{paid:0,free:0,unknown:0},updated_at:new Date().toISOString()};
else if(u.pathname==='/calendar/stats')body={chart_data:[]};
await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':'*'}})});
async function open(){onAbsences=false;await page.goto(origin);await page.getByText('ATYLLA PRO',{exact:true}).first().waitFor();await page.waitForTimeout(500);await page.screenshot({path:path.join(out,`${width}-home.png`)});await page.mouse.click(32,105);await page.getByText('Wyloguj',{exact:true}).waitFor();onAbsences=true;await page.getByText('Absencje',{exact:true}).click();await page.getByText(baseline?'Podgląd absencji':'Zgłoś Absencję',{exact:true}).waitFor()}
async function snap(name){await page.waitForTimeout(350);await page.screenshot({path:path.join(out,`${width}-${name}.png`)});await page.addScriptTag({path:path.join(root,'.tmp/billing-qa/node_modules/axe-core/axe.min.js')});const violations=await page.evaluate(async()=> (await axe.run()).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.html)})));if(violations.length)console.log(JSON.stringify({width,name,violations}));const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!overflow);assert.equal(violations.length,0,JSON.stringify(violations));results.push({width,name,overflow,violations})}


await open();await snap('old-absences-only');
const empty=page.getByText('Brak zgłoszonych absencji w wyświetlanym okresie.',{exact:true});
await empty.waitFor(); assert.equal(await page.getByRole('button',{name:/Usuń absencję/}).count(),0);
const relative=days=>{const d=new Date();d.setDate(d.getDate()+days);return iso(d);};
abs=[-31,-30,0,60].map((offset,i)=>({id:'boundary'+i,client_id:clients[0].id,clients:{name:'Adam QA'},absence_date:relative(offset),absence_hour:9}));
await open();
await page.getByRole('button',{name:'Usuń absencję: Adam QA, '+relative(-30),exact:true}).waitFor();
assert.equal(await page.getByRole('button',{name:/Usuń absencję/}).count(),3);
assert.equal(await page.getByRole('button',{name:'Usuń absencję: Adam QA, '+relative(-31),exact:true}).count(),0);
assert.equal(await empty.count(),0);await snap('date-boundaries');
abs=[];await open();await empty.waitFor();
failRead=true;await open();await page.getByText('Syntetyczny błąd odczytu',{exact:true}).waitFor();assert.equal(await empty.count(),0);
failRead=false;await page.getByRole('button',{name:'Spróbuj ponownie',exact:true}).click();await empty.waitFor();
results.push({width,id:'ABS-01',status:'PASS',checks:['old-only','empty','30-day-boundary','future','error-and-retry'],errors,blocked});
assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);await ctx.close();

}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',synthetic:true,results},null,2));console.log(JSON.stringify({status:'PASS',results}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();server.close()});
