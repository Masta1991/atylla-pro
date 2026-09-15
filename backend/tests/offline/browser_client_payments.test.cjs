// Built PWA navigation regression. Synthetic intercepted API; no real account/data.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, '.tmp/billing-qa/node_modules/playwright'));
const build = path.resolve(root, process.argv[2]);
assert(build.startsWith(path.join(root, '.tmp') + path.sep));
const out = path.join(root, '.tmp/client-payments-browser-20260915');
fs.mkdirSync(out, { recursive: true });
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const now = new Date(), monday = new Date(now);
monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
const date = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
const clients = ['Adam QA', 'Beata QA'].map((name, i) => ({
  id: id(i+1), name, billing_type: 'package', package_size: 10, package_current_count: 2,
  active_package_id: id(i+10), package_purchase_date: date, shared_with: i === 0 ? [id(2)] : [],
  training_schedule: [], strength_progression: [], payment_history: [],
}));
const events = clients.map((client, i) => ({id: id(i+20), client_id: client.id, clients: client,
  event_date: date, event_hour: 9+i, status: 'active', is_settled: false}));
const server = http.createServer((req, res) => {
  let file = path.resolve(build, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
  if (!file.startsWith(build + path.sep) && file !== build) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(build, 'index.html');
  res.setHeader('Content-Type', ({'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png'})[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
let browser, debugPage;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--disable-background-networking', '--disable-component-update', '--no-first-run']});
  const results = [];
  for (const width of [390, 1440, 320]) {
    const context = await browser.newContext({viewport: {width, height: 1000}, serviceWorkers: 'block', reducedMotion: 'reduce'});
    const page = await context.newPage(); debugPage = page;
    page.setDefaultTimeout(8000);
    const calls = [], errors = [], blocked = [], mutations = [];
    let availableClients = clients;
    page.on('pageerror', e => errors.push(e.message));
    await context.addInitScript(() => localStorage.setItem('atylla_session_v2', JSON.stringify({
      access_token: 'synthetic-offline', refresh_token: 'synthetic-refresh', idle_token: 'synthetic-lease',
      idle_expires_at: Math.floor(Date.now()/1000)+259200, session_id: 'synthetic-session',
      email: 'nobody@example.invalid', revision: 0,
    })));
    await context.route('**/*', async route => {
      const req = route.request(), u = new URL(req.url());
      if (u.origin === origin) return route.continue();
      if (u.origin !== 'http://127.0.0.1:8000') { blocked.push(u.origin); return route.abort(); }
      calls.push(u.pathname + u.search);
      if (req.method() !== 'GET' && u.pathname !== '/auth/activity') mutations.push(u.pathname);
      let body = [];
      if (u.pathname === '/auth/activity') body = {idle_token: 'synthetic-lease', idle_expires_at: Math.floor(Date.now()/1000)+259200, session_id:'synthetic-session'};
      else if (u.pathname === '/clients/') { await new Promise(r => setTimeout(r, 120)); body = availableClients; }
      else if (u.pathname.startsWith('/calendar/week/')) body = events;
      else if (u.pathname === '/calendar/') body = events.filter(e => e.client_id === u.searchParams.get('client_id'));
      else if (u.pathname.endsWith('/exercises/by-group')) body = {};
      await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: {'Access-Control-Allow-Origin': '*'}});
    });
    const cards = page.locator('[data-testid^="payment-card-"]:visible');
    const slot = hour => page.locator(`[data-slot-date="${date}"][data-slot-hour="${hour}"]:visible`);
    async function backToCalendar() {
      await page.mouse.click(28, 85);
      await slot(9).getByText(/Adam QA/).waitFor();
      await page.waitForTimeout(400); // Native-stack exit animation must release pointer input.
    }
    async function assertCard(client) {
      await page.getByText('Rozliczenia klienta', {exact: true}).waitFor();
      await page.waitForTimeout(200);
      assert.equal(await cards.count(), 1);
      assert.equal(await cards.first().getAttribute('data-testid'), `payment-card-${client.id}`);
      assert(await cards.getByText('Zakończ Pakiet', {exact: true}).isVisible());
      assert(await cards.getByText('Historia', {exact: true}).isVisible());
      assert.equal(await page.getByText('Historia płatności', {exact: true}).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await page.goto(origin);
    await slot(9).getByText(/Adam QA/).waitFor();
    await page.getByText('PAKIET', {exact: true}).click();
    const before = calls.length;
    await slot(9).click();
    await assertCard(clients[0]);
    assert(await cards.getByText('Beata QA', {exact: true}).isVisible(), 'Shared pool name retained inside selected card');
    assert(!calls.slice(before).some(p => p.includes('/packages') || p.startsWith('/calendar/?')), 'No automatic history reads');
    await page.screenshot({path: path.join(out, `${width}-adam.png`)});
    await cards.getByText('Historia', {exact: true}).click();
    await page.getByText('Historia płatności', {exact: true}).waitFor();
    assert(calls.some(p => p.includes(`/clients/${clients[0].id}/packages`)));
    await page.getByText('Historia płatności', {exact: true}).locator('..').locator('[tabindex="0"]').click();
    await page.getByText('Historia płatności', {exact: true}).waitFor({state: 'hidden'});
    await backToCalendar();
    await slot(10).click();
    await assertCard(clients[1]);
    assert.equal(await cards.getByText('Adam QA', {exact: true}).count(), 0);
    await backToCalendar();
    await page.mouse.click(32, 105);
    await page.getByText('Wyloguj', {exact: true}).waitFor();
    await page.getByText('Rozliczenia', {exact: true}).click();
    await page.getByText('Status Płatności Podopiecznych', {exact: true}).waitFor();
    assert.equal(await cards.count(), 2);
    await page.screenshot({path: path.join(out, `${width}-all.png`)});
    await backToCalendar();
    await slot(9).click();
    await assertCard(clients[0]);
    // A removed/inaccessible client must never fall back to all clients.
    availableClients = [clients[1]];
    await backToCalendar();
    await slot(9).click();
    await page.getByText('Nie znaleziono wybranego klienta. Wróć do kalendarza i odśwież dane.', {exact:true}).waitFor();
    assert.equal(await cards.count(), 0);
    assert.deepEqual(errors, []); assert.deepEqual(blocked, []); assert.deepEqual(mutations, []);
    results.push({width, status:'PASS', scenarios: ['single card', 'shared pool', 'explicit history', 'different client', 'menu all clients', 'return to single', 'missing client'], errors, blocked, mutations});
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({build, scope:'Synthetic local browser QA', results}, null, 2));
})().catch(async error => {
  console.error(error); process.exitCode = 1;
  if (debugPage && !debugPage.isClosed()) {
    await debugPage.screenshot({path: path.join(out, 'failure.png')});
    fs.writeFileSync(path.join(out, 'failure.txt'), await debugPage.locator('body').innerText());
  }
}).finally(async () => { if (browser) await browser.close(); server.close(); });
