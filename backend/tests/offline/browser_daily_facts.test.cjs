// Actual local Expo bundle; all API traffic is synthetic, other origins blocked.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const build = path.resolve(root, process.argv[2]);
const baseline = process.argv.includes('--baseline');
const facts = require(path.join(root, 'frontend/src/data/dailyFacts.json'));
const { chromium } = require(path.join(root, '.tmp/billing-qa/node_modules/playwright'));
const AxeBuilder = require(path.join(root, '.tmp/billing-qa/node_modules/@axe-core/playwright')).default;
const out = path.join(root, process.env.ATYLLA_FACTS_QA_OUT || '.tmp/daily-facts-2.1.23', baseline ? 'baseline' : 'browser');
const baselineReport = !baseline ? JSON.parse(fs.readFileSync(path.join(root,'.tmp/daily-facts-2.1.23/baseline/report.json'),'utf8')) : null;
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  let file = path.resolve(build, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
  if (file !== build && !file.startsWith(build + path.sep)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(build, 'index.html');
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
let browser, page;
const results = [];
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-background-networking', '--no-first-run'] });
  const matrix = baseline ? [[320,568],[390,844],[1440,900]] : [[320,568],[375,667],[390,844],[667,375],[768,1024],[1024,768],[1366,768],[1440,900],[320,400]];
  for (const mode of ['dark', 'light']) for (const [width, height] of matrix) {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: width === 320 ? 'reduce' : 'no-preference' });
    page = await context.newPage(); page.setDefaultTimeout(10000);
    await page.clock.install({ time: new Date('2027-06-22T10:00:00Z') });
    const errors = [], blocked = [], calls = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if(message.type()==='error') errors.push(message.text()); });
    await context.addInitScript(({ mode }) => {
      localStorage.setItem('appThemeMode', mode);
      localStorage.setItem('atylla_session_v2', JSON.stringify({ access_token: 'synthetic-offline', refresh_token: 'synthetic-refresh', idle_token: 'synthetic-lease', idle_expires_at: 4102444800, session_id: 'synthetic-session', email: 'nobody@example.invalid', revision: 0 }));
    }, { mode });
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin === origin) return route.continue();
      if (!['http://127.0.0.1:8000', 'https://atylla-pro-production.up.railway.app'].includes(url.origin)) { blocked.push(url.origin); return route.abort(); }
      calls.push({ path: url.pathname, method: req.method() });
      let body = [];
      if (url.pathname === '/auth/activity') body = { idle_token: 'synthetic-lease', idle_expires_at: 4102444800, session_id: 'synthetic-session' };
      if (url.pathname === '/calendar/stats') body = { chart_data: [] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(origin); await page.waitForTimeout(500);
    await page.mouse.click(29,85);
    await page.getByText('Wyloguj', { exact: true }).waitFor();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(out, `${mode}-${width}x${height}.png`) });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const axe = await new AxeBuilder({ page }).analyze();
    const violations = axe.violations.filter(v => ['serious','critical'].includes(v.impact)).map(v => ({ id:v.id, nodes:v.nodes.map(n=>n.html) }));
    results.push({ mode, width, height, overflow, errors, blocked, violations, calls });
    if (!baseline) {
      assert(!overflow, 'document overflow');
      assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
      // Compare against observed baseline elements; do not suppress whole rules.
      const textOf=html=>html.replace(/<[^>]*>/g,'');
      const known=baselineReport.results.filter(r=>r.mode===mode).flatMap(r=>r.violations.flatMap(v=>v.nodes.map(html=>v.id+'|'+textOf(html))));
      const newViolations = violations.filter(v=>v.nodes.some(html=>!known.includes(v.id+'|'+textOf(html))));
      assert.deepEqual(newViolations, [], JSON.stringify(newViolations));
      await checkMenu({ context, page, width, height, mode, calls, result: results.at(-1) });
      assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
    }
    await context.close();
    console.log(JSON.stringify({ mode, width, height, status:'PASS' }));
  }
  fs.writeFileSync(path.join(out,'report.json'), JSON.stringify({ build, baseline, results },null,2));
})().catch(async error => {
  console.error(error); process.exitCode=1;
  if (page && !page.isClosed()) {
    await page.screenshot({ path:path.join(out,'failure.png') });
    console.log(JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('[data-testid="daily-fact-measure"],[data-testid="daily-fact-text"]')).map(e=>({id:e.dataset.testid,text:e.textContent,rect:e.getBoundingClientRect().toJSON(),parent:e.parentElement.dataset.testid})))));
  }
}).finally(async()=>{ if(browser) await browser.close(); server.close(); });

async function checkMenu({ page, width, height, mode, calls, result }) {
  const fact = page.getByTestId('daily-fact-text');
  await fact.waitFor();
  assert.equal(await fact.innerText(), facts[223].text);
  async function fit() {
    assert.equal(await page.getByTestId('daily-fact-measure').count(),1,'no stale measurement nodes');
    const metrics = await page.evaluate(() => {
      const get=id=>document.querySelector(`[data-testid="${id}"]`);
      const strip=get('daily-fact-strip').getBoundingClientRect(),rot=get('daily-fact-rotated').getBoundingClientRect();
      const scroll=get('daily-fact-scroll'), text=get('daily-fact-text'),measure=get('daily-fact-measure');
      const inside=rot.left>=strip.left-1&&rot.right<=strip.right+1&&rot.top>=strip.top-1&&rot.bottom<=strip.bottom+1;
      return {inside,stripWidth:strip.width,rotatedWidth:rot.width,scrollHeight:scroll.scrollHeight,clientHeight:scroll.clientHeight,textHeight:text.offsetHeight,measuredHeight:measure.offsetHeight,logicalWidth:measure.offsetWidth,textWidth:text.offsetWidth,sameText:text.textContent===measure.textContent,text:text.textContent,tabIndex:scroll.tabIndex,overflowY:getComputedStyle(scroll).overflowY};
    });
    assert(metrics.inside,JSON.stringify(metrics));
    assert(metrics.scrollHeight>=metrics.textHeight-1, 'full text reachable');
    assert(Math.abs(metrics.textHeight-metrics.measuredHeight)<=1,'measurement matches displayed text '+JSON.stringify(metrics));
    if(metrics.scrollHeight>metrics.clientHeight+1) {
      assert.equal(metrics.tabIndex,0);assert.equal(metrics.overflowY,'auto');
      await page.getByTestId('daily-fact-scroll').focus();
      await page.keyboard.press('End');await page.waitForTimeout(250);
      assert(await page.getByTestId('daily-fact-scroll').evaluate(el=>el.scrollTop>0),'keyboard scrolling');
    }
    return metrics;
  }
  result.longest=await fit();
  result.allTextMeasurements=await page.evaluate(facts=>{
    const source=document.querySelector('[data-testid="daily-fact-measure"]');
    const probe=source.cloneNode(true);probe.removeAttribute('data-testid');
    source.parentNode.appendChild(probe);
    const heights=facts.map(f=>{probe.textContent=f.text;return probe.getBoundingClientRect().height;});
    probe.remove();
    return {count:heights.length,min:Math.min(...heights),max:Math.max(...heights),nonEmpty:heights.every(h=>h>0)};
  },facts);
  assert.equal(result.allTextMeasurements.count,313);assert(result.allTextMeasurements.nonEmpty);
  const beforeClick=calls.length;
  await fact.click();await page.getByTestId('main-menu').waitFor();
  assert(calls.slice(beforeClick).every(c=>c.path==='/auth/activity'),'fact must not fetch data');
  await page.keyboard.press('Escape');
  await page.getByTestId('main-menu').waitFor({state:'hidden'});
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.testid),'open-menu','focus restored');
  const openCalls=calls.length;
  await page.keyboard.press('Enter');await fact.waitFor();
  await page.waitForTimeout(150);
  assert(calls.slice(openCalls).every(c=>c.path==='/auth/activity'),'opening fact adds no API call');
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.testid),'close-menu','initial focus');
  result.focusSequence=['open-menu','close-menu','Escape','open-menu','Enter','close-menu'];
  await page.keyboard.press('Tab');
  assert(await page.evaluate(()=>document.activeElement?.closest('[data-testid="main-menu"]')!=null),'keyboard stays in menu content');
  await page.getByRole('button',{name:'Ustawienia',exact:true}).focus();
  await page.keyboard.press('Enter');await page.getByTestId('main-menu').waitFor({state:'hidden'});
  // Existing Settings header back control (the home label itself is not a button).
  await page.mouse.click(29,85);
  await page.getByTestId('open-menu').click();await fact.waitFor();
  await page.getByRole('button',{name:'Wyloguj',exact:true}).scrollIntoViewIfNeeded();
  assert(await page.getByRole('button',{name:'Wyloguj',exact:true}).isVisible());
  await page.getByTestId('menu-items-scroll').evaluate(el=>el.scrollTop=0);
  await page.getByTestId('close-menu').click({position:{x:4,y:4}});
  await page.getByTestId('main-menu').waitFor({state:'hidden'});
  await page.getByTestId('open-menu').click();await fact.waitFor();
  // Text-only zoom exercises real measurement callbacks and the scroll fallback.
  if(width===320&&height===400) {
    const zoom=await page.addStyleTag({content:'[data-testid="daily-fact-text"],[data-testid="daily-fact-measure"]{font-size:30px!important;line-height:40px!important} [data-testid="menu-items-panel"] [dir="auto"]{font-size:30px!important;line-height:40px!important}'});
    await page.waitForTimeout(200);result.textZoom200=await fit();
    assert(result.textZoom200.scrollHeight>result.textZoom200.clientHeight,'fallback exercised');
    const clipped=await page.getByTestId('menu-items-panel').locator('[dir="auto"]').evaluateAll(elements=>elements.filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.textContent));
    assert.deepEqual(clipped,[],'200% menu text must wrap');
    await page.screenshot({path:path.join(out,`${mode}-${width}x${height}-text200.png`)});
    await page.getByRole('button',{name:'Wyloguj',exact:true}).scrollIntoViewIfNeeded();
    await zoom.evaluate(el=>el.remove());await page.waitForTimeout(100);
  }
  // Exercise source dates in the live component, after the all-text measurements above.
  if(width===320&&height===568&&mode==='dark') {
    for(const row of facts) {
      await page.clock.setFixedTime(new Date(row.date+'T12:00:00Z'));
      await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
      await page.waitForFunction(text=>document.querySelector('[data-testid="daily-fact-text"]')?.textContent===text,row.text);
      await fit();
    }
    result.liveDates=313;
  }
  if(width===390&&mode==='dark') {
    await page.setViewportSize({width:844,height:390});await page.waitForTimeout(150);result.afterRotation=await fit();
    await page.setViewportSize({width,height});await page.waitForTimeout(150);await fit();
    const date=async iso=>{await page.clock.setSystemTime(new Date(iso));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));};
    await date('2026-10-04T21:59:59Z');await fact.waitFor();
    await page.waitForFunction(text=>document.querySelector('[data-testid="daily-fact-text"]')?.textContent===text,facts[1].text);
    await page.screenshot({path:path.join(out,'release-day-preview.png')});
    await page.clock.runFor(1100);
    await page.waitForFunction(text=>document.querySelector('[data-testid="daily-fact-text"]')?.textContent===text,facts[0].text);
    await date('2026-10-11T21:59:59Z');await fact.waitFor({state:'hidden'});
    await page.clock.runFor(1100);await fact.waitFor();assert.equal(await fact.innerText(),facts[6].text);
    await date('2026-10-10T21:59:59Z');await fact.waitFor();
    await page.clock.runFor(1100);await fact.waitFor({state:'hidden'});
    await date('2027-10-04T21:59:59Z');await fact.waitFor();assert.equal(await fact.innerText(),facts.at(-1).text);
    await page.clock.runFor(1100);await page.waitForFunction(text=>document.querySelector('[data-testid="daily-fact-text"]')?.textContent===text,facts[0].text);
    await page.clock.setFixedTime(new Date('2027-10-06T12:00:00Z'));
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(text=>document.querySelector('[data-testid="daily-fact-text"]')?.textContent===text,facts[1].text);
    result.lifecycle=['release-day preview expires at midnight','Sunday-to-Monday midnight','Saturday-to-Sunday midnight','cycle rollover at midnight','foreground date refresh'];
  }
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
}
