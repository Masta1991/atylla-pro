// Local Expo bundle with synthetic API only; never contacts Supabase/production.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const build = path.resolve(root, process.argv[2]);
const baseline = process.argv.includes('--baseline');
const { chromium } = require(path.join(root, '.tmp/billing-qa/node_modules/playwright'));
const AxeBuilder = require(path.join(root, '.tmp/billing-qa/node_modules/@axe-core/playwright')).default;
const out = process.env.ATYLLA_QA_OUTPUT || path.join(root, '.tmp/day-navigation-20261017', baseline ? 'baseline-browser' : 'browser');
const apiOrigin = process.env.ATYLLA_QA_API_ORIGIN || 'http://127.0.0.1:8000';
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  let file = path.resolve(build, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
  if (file !== build && !file.startsWith(build + path.sep)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(build, 'index.html');
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
const results = [];
let browser, page;
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ build, baseline, results }, null, 2));
const iso = date => date.toISOString().slice(0, 10);
const dayCount = date => Number(date.slice(-2)) % 3;
const eventRows = monday => Array.from({ length: 6 }, (_, i) => {
  const d = new Date(monday + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + i);
  const date = iso(d);
  return Array.from({ length: dayCount(date) }, (_, j) => ({
    id: `${date}-${j}`, client_id: 'synthetic-client', event_date: date, event_hour: 9 + j,
    status: j ? 'cancelled' : 'active', is_settled: !!j, clients: { name: 'QA ' + date },
  }));
}).flat();
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = process.env.ATYLLA_QA_BASE_URL || 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-background-networking', '--no-first-run'] });
  const variants = baseline ? [[390, 'dark'], [390, 'light']] : [320, 390, 667, 768, 1024, 1366, 1440, 720].flatMap(w => ['dark', 'light'].map(m => [w, m]));
  for (const [width, mode] of variants) {
    const context = await browser.newContext({ viewport: { width, height: width === 720 ? 500 : width === 667 ? 375 : 900 }, deviceScaleFactor: width === 720 ? 2 : 1, timezoneId: 'Europe/Warsaw', serviceWorkers: 'block', reducedMotion: width === 320 ? 'reduce' : 'no-preference' });
    page = await context.newPage(); page.setDefaultTimeout(10000);
    await page.clock.setFixedTime(new Date('2026-10-17T12:00:00Z'));
    const calls = [], errors = [], blocked = [];
    const result = { width, mode, reflow200: width === 720, calls, errors, blocked, dates: [] };
    results.push(result);
    let failWeek = false;
    page.on('pageerror', e => errors.push(e.message));
    await context.addInitScript(mode => {
      localStorage.setItem('appThemeMode', mode);
      localStorage.setItem('atylla_session_v2', JSON.stringify({ access_token: 'synthetic-offline', refresh_token: 'synthetic-refresh', idle_token: 'synthetic-lease', idle_expires_at: 4102444800, session_id: 'synthetic-session', email: 'nobody@example.invalid', revision: 0 }));
    }, mode);
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      const staticPath = url.pathname === '/' || /^\/(?:assets|_expo)\//.test(url.pathname) || /^\/(?:favicon\.ico|manifest\.json|icon-\d+\.png|apple-touch-icon\.png)$/.test(url.pathname);
      if (url.origin === origin && (url.origin !== apiOrigin || (req.method() === 'GET' && staticPath))) return route.continue();
      if (url.origin !== apiOrigin) { blocked.push(url.origin); return route.abort(); }
      calls.push({ path: url.pathname, query: url.search, method: req.method() });
      let body = [], status = 200;
      if (url.pathname === '/auth/activity') body = { idle_token: 'synthetic-lease', idle_expires_at: 4102444800, session_id: 'synthetic-session' };
      if (url.pathname.startsWith('/calendar/week/')) {
        await new Promise(r => setTimeout(r, 80));
        if (failWeek) { status = 503; body = { detail: 'Syntetyczny błąd odczytu' }; }
        else body = eventRows(url.pathname.split('/').at(-1));
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    const button = name => page.getByRole('button', { name, exact: true });
    const ready = () => page.getByText('Odświeżanie…', { exact: true }).waitFor({ state: 'hidden' });
    const slots = () => page.locator('[data-slot-date]');
    async function checkDate(date) {
      await ready();
      await page.waitForFunction(date => {
        const slots = [...document.querySelectorAll('[data-slot-date]')];
        return slots.length === 16 && slots.every(el => el.dataset.slotDate === date);
      }, date);
      assert.equal(await slots().count(), 16);
      const label = await page.getByTestId('calendar-date').innerText();
      assert(label.includes(new Date(date + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: width < 380 ? 'short' : 'long' })), label);
      assert(label.includes('Treningi: ' + dayCount(date)), label);
      const slot = page.locator(`[data-slot-date="${date}"][data-slot-hour="9"]`);
      const box = await slot.boundingBox();
      assert(box.x >= 45 && box.x + box.width <= width + 1, 'day column is fully visible');
      if (dayCount(date)) assert((await slot.innerText()).includes('QA ' + date));
      result.dates.push(date);
    }
    async function boot(date) {
      await page.clock.setFixedTime(new Date(date + 'T12:00:00Z'));
      await page.goto(origin); await slots().first().waitFor(); await ready();
      await page.waitForTimeout(180);
    }
    await boot('2026-10-17');
    if (baseline) {
      // The old toggle/arrows have no accessible names. Use the rendered header container.
      await page.mouse.click(width - 36, 105); await ready();
      await page.waitForFunction(() => document.querySelectorAll('[data-slot-date]').length === 16);
      assert.equal(await slots().count(), 16);
      const oldDate = await slots().first().getAttribute('data-slot-date');
      result.initialDate = oldDate;
      await page.screenshot({ path: path.join(out, `${mode}-${width}.png`) });
      result.axe = (await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => ({ id: v.id, nodes: v.nodes.map(n => n.html) }));
      await page.mouse.click(width - 90, 105); await ready();
      await page.waitForFunction(() => document.querySelectorAll('[data-slot-date]').length === 0);
      assert.equal(await slots().count(), 0, 'baseline reproduces blank day after forward arrow');
      result.reproducedBlankDay = true;
    } else {
      await button('Widok dnia').press('Enter'); await checkDate('2026-10-17');
      const next = button('Następny dzień'), prev = button('Poprzedni dzień');
      await next.press('Space'); await checkDate('2026-10-19');
      assert.equal(await next.evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Shift+Tab'); assert.equal(await page.getByTestId('calendar-date').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Shift+Tab'); assert.equal(await prev.evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Enter'); await checkDate('2026-10-17');
      await prev.click(); await checkDate('2026-10-16');
      await button('Wróć do dzisiaj').click(); await checkDate('2026-10-17');
      await next.click(); await checkDate('2026-10-19');
      await button('Widok tygodnia').click(); await ready(); assert.equal(await slots().count(), 96);
      assert.equal(await slots().first().getAttribute('data-slot-date'), '2026-10-19');
      await button('Następny tydzień').click(); await ready();
      assert.equal(await slots().first().getAttribute('data-slot-date'), '2026-10-26');
      await page.screenshot({ path: path.join(out, `${mode}-${width}-week.png`) });
      await button('Widok dnia').click(); await checkDate('2026-10-17');
      await page.screenshot({ path: path.join(out, `${mode}-${width}.png`) });
      assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'document overflow');
      const topbar = page.getByTestId('open-menu').locator('..');
      result.topbar = await topbar.locator('[role="button"]').evaluateAll(elements => elements.map(el => ({ name: el.getAttribute('aria-label'), rect: el.getBoundingClientRect().toJSON() })));
      assert(result.topbar.every(({ rect }) => rect.x >= 0 && rect.right <= width && rect.width >= 24 && rect.height >= 24), 'all top bar actions fit');
      result.focus = ['Widok dnia/Enter', 'Następny dzień/Space', 'Shift+Tab/date', 'Shift+Tab/Poprzedni dzień', 'Enter'];
      await topbar.evaluate(el => el.dataset.testid = 'calendar-topbar-qa');
      result.axe = (await new AxeBuilder({ page }).include('[data-testid="calendar-topbar-qa"]').analyze()).violations;
      assert.deepEqual(result.axe, []);
      result.fonts = await page.evaluate(() => [...document.fonts].map(f => ({ family: f.family, status: f.status })));
      for (const family of ['ionicons', 'material-community']) assert(result.fonts.some(f => f.family.includes(family) && f.status === 'loaded'), family);
      if (width === 320) {
        const zoomStyle = await page.addStyleTag({ content: '[data-testid="calendar-date"] [dir="auto"] { font-size: 32px !important; }' });
        await page.screenshot({ path: path.join(out, `${mode}-${width}-text200.png`) });
        result.text200Fits = await page.getByTestId('calendar-date').evaluate(el => [...el.querySelectorAll('[dir="auto"]')].every(t => t.scrollWidth <= t.clientWidth + 1));
        assert(result.text200Fits); await zoomStyle.evaluate(el => el.remove());
      }
      if (width === 390 && mode === 'dark') {
        for (const [start, forward] of [['2026-10-31', '2026-11-02'], ['2026-12-31', '2027-01-01'], ['2028-02-28', '2028-02-29'], ['2026-03-28', '2026-03-30'], ['2026-10-24', '2026-10-26']]) {
          await boot(start); await button('Widok dnia').click(); await checkDate(start);
          await next.click(); await checkDate(forward); await prev.click(); await checkDate(start);
        }
        await boot('2026-10-18'); await button('Widok dnia').click(); await checkDate('2026-10-17');
        await next.click(); await checkDate('2026-10-19');
        failWeek = true;
        await prev.click(); await page.getByRole('dialog').waitFor();
        await button('OK').click(); failWeek = false;
        await next.click(); await checkDate('2026-10-19');
        result.errorRecovery = true;
      }
      assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
      assert(calls.every(c => c.method === 'GET' || c.path === '/auth/activity'), 'navigation must not write data');
    }
    save(); await context.close(); console.log(JSON.stringify({ width, mode, status: 'PASS', baseline }));
  }
})().catch(async error => {
  console.error(error); process.exitCode = 1; save();
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(out, 'failure.png') });
}).finally(async () => { if (browser) await browser.close(); server.close(); });
