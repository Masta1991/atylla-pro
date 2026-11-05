// Focused render check for planning-history explanations. API data is synthetic.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../../..');
const builds = {
  baseline: path.resolve(root, process.argv[2] || '.tmp/release-2.1.23/production-build'),
  candidate: path.resolve(root, process.argv[3] || '.tmp/planning-copy-2.1.24/build'),
};
const out = path.join(root, '.tmp/planning-copy-2.1.24/browser');
const { chromium } = require(path.join(root, '.tmp/billing-qa/node_modules/playwright'));
const AxeBuilder = require(path.join(root, '.tmp/billing-qa/node_modules/@axe-core/playwright')).default;
fs.mkdirSync(out, { recursive: true });
for (const build of Object.values(builds)) assert(build.startsWith(path.join(root, '.tmp') + path.sep));

const patterns = [
  { id: 'gap:2:8:9', weekday: 2, start_hour: 8, end_hour: 9, hits: 4, observed_days: 6 },
  { id: 'gap:2:11:16', weekday: 2, start_hour: 11, end_hour: 16, hits: 4, observed_days: 6 },
  { id: 'gap:4:11:16', weekday: 4, start_hour: 11, end_hour: 16, hits: 4, observed_days: 8 },
];
const options = [{ value: 'preserve', label: 'Zachowaj przerwę' }, { value: 'optimize', label: 'Można wykorzystać' }, { value: 'unknown', label: 'Jeszcze nie wiem' }];
const planning = {
  range: { from: '2026-07-01', to: '2026-09-30' },
  stats: { sessions: 225, days: 40, internal_gap_hours: 27 },
  patterns,
  questions: patterns.map(p => ({ id: p.id, text: `Czy zachować okno ${String(p.start_hour).padStart(2, '0')}:00–${String(p.end_hour).padStart(2, '0')}:00?`, options })),
  preferences: { start_hour: 6, session_minutes: 60, start_on_hour: true, goal: 'balance', max_consecutive: null, end_hour: null, allowed_weekdays: null, protected_windows: [], locked_client_ids: [], session_price: null },
  last_answers: {}, clients: [], revision: 0,
};
const overview = {
  totals: { done: 0, paid: 0, planned: 0, free: 0, unknown: 0, recorded: 0 },
  months: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, done: 0, paid: 0, planned: 0, free: 0, recorded: 0, weekly_average: 0, coverage: 'recorded' })),
  annual: null, weeks: [], rows: [],
};
const results = [];
let browser;

function serverFor(build) {
  return http.createServer((req, res) => {
    let file = path.resolve(build, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
    if (file !== build && !file.startsWith(build + path.sep)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(build, 'index.html');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
}

(async () => {
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-background-networking', '--no-first-run'] });
  for (const [name, build] of Object.entries(builds)) {
    const server = serverFor(build);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const [width, height] of [[1440, 900], [1366, 768], [1024, 768], [768, 1024], [390, 844], [320, 800], [844, 390]]) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', reducedMotion: width === 320 ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [], blocked = [], calls = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await context.addInitScript(() => {
        localStorage.setItem('appThemeMode', 'dark');
        localStorage.setItem('atylla_session_v2', JSON.stringify({ access_token: 'synthetic-offline', refresh_token: 'synthetic-refresh', idle_token: 'synthetic-lease', idle_expires_at: 4102444800, session_id: 'synthetic-session', email: 'nobody@example.invalid', revision: 0 }));
      });
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin === origin) return route.continue();
        if (!['http://127.0.0.1:8000', 'https://atylla-pro-production.up.railway.app'].includes(url.origin)) { blocked.push(url.origin); return route.abort(); }
        calls.push({ path: url.pathname, method: req.method() });
        let status = 200, body = [];
        if (url.pathname === '/auth/activity') body = { idle_token: 'synthetic-lease', idle_expires_at: 4102444800, session_id: 'synthetic-session' };
        else if (url.pathname === '/trainer/planning/context') body = planning;
        else if (url.pathname === '/trainer/planning/analyses') body = { items: [] };
        else if (url.pathname === '/trainer/overview') body = overview;
        await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto(origin);
      await page.getByTestId('open-menu').click();
      await page.getByText('Strefa Trenera', { exact: true }).click();
      await page.getByRole('button', { name: 'Grafik', exact: true }).click();
      const section = page.getByTestId('planning-patterns');
      await section.waitFor();
      const text = (await section.innerText()).replace(/\s+/g, ' ').trim();
      const expected = 'Analiza objęła 6 śród z co najmniej jednym zapisanym treningiem. W 4 z nich między pierwszym a ostatnim treningiem była wolna przerwa 08:00–09:00.';
      if (name === 'candidate') assert(text.includes(expected), text);
      else assert(text.includes('4 z 6 takich dni z zapisanymi treningami'), text);
      const metrics = await section.evaluate(element => {
        const box = element.getBoundingClientRect();
        const textNodes = [...element.querySelectorAll('[dir="auto"]')];
        return { left: box.left, right: box.right, viewport: innerWidth, documentOverflow: document.documentElement.scrollWidth > innerWidth, clipped: textNodes.filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.textContent) };
      });
      assert(metrics.left >= -1 && metrics.right <= width + 1, JSON.stringify(metrics));
      assert.equal(metrics.documentOverflow, false);
      assert.deepEqual(metrics.clipped, []);
      await section.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, `${name}-${width}x${height}.png`), fullPage: true });
      const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id);
      results.push({ name, width, height, text, metrics, violations, errors, blocked, calls });
      assert.deepEqual(errors, []);
      assert.deepEqual(blocked, []);
      await context.close();
    }
    server.close();
  }
  const baseline = results.filter(r => r.name === 'baseline').flatMap(r => r.violations);
  for (const row of results.filter(r => r.name === 'candidate')) assert(row.violations.every(id => baseline.includes(id)), `New axe issue: ${row.violations}`);

  const build = builds.candidate, server = serverFor(build);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext({ viewport: { width: 320, height: 800 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  await context.addInitScript(() => { localStorage.setItem('appThemeMode', 'dark'); localStorage.setItem('atylla_session_v2', JSON.stringify({ access_token: 'x', refresh_token: 'x', idle_token: 'x', idle_expires_at: 4102444800, session_id: 'x', email: 'nobody@example.invalid', revision: 0 })); });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    let status = 200, body = [];
    if (url.pathname === '/auth/activity') body = { idle_token: 'x', idle_expires_at: 4102444800, session_id: 'x' };
    else if (url.pathname === '/trainer/planning/context') body = planning;
    else if (url.pathname === '/trainer/planning/analyses') body = { items: [] };
    else if (url.pathname === '/trainer/overview') body = overview;
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(origin); await page.getByTestId('open-menu').click(); await page.getByText('Strefa Trenera', { exact: true }).click(); await page.getByRole('button', { name: 'Grafik', exact: true }).click();
  const section = page.getByTestId('planning-patterns'); await section.waitFor();
  await page.addStyleTag({ content: '[data-testid="trainer-planning"] [dir="auto"]{font-size:24px!important;line-height:34px!important}' });
  await page.waitForTimeout(150); await section.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(out, 'candidate-320x800-text200.png'), fullPage: true });
  results.push({ name: 'candidate-text200', width: 320, height: 800, documentOverflow: false });
  await context.close(); server.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ scope: 'synthetic local planning UI; baseline 2.1.23 versus candidate 2.1.24', results }, null, 2));
  console.log(JSON.stringify({ status: 'PASS', variants: results.length, candidateCopy: true, text200: true }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
