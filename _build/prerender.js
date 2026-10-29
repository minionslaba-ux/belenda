// Прорисовывает все страницы сайта в Chromium и сохраняет HTML + стили в JSON.
// Вызывается из build.py: node _build/prerender.js <out.json> [фильтр-маршрутов]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2];
const ONLY = process.argv[3] || '';
const SITE = 'https://bielendaprint.com';
const LANGS = ['ru', 'kk', 'en'];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webp': 'image/webp', '.gif': 'image/gif' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

// --- runs inside the page -------------------------------------------------
function snapshotInPage() {
  document.querySelectorAll('input, textarea, select').forEach(n => { n.toggleAttribute('required', n.required); if (n.type === 'radio' || n.type === 'checkbox') n.toggleAttribute('checked', n.checked); });
  const ABS = v => v && !/^(\/|#|[a-z]+:)/i.test(v) ? '/' + v : v;
  const root = document.body.cloneNode(true);
  const styles = [...document.querySelectorAll('style')].map(s => s.textContent);
  root.querySelectorAll('script, x-dc, noscript, style, [data-cookie], .dialog-backdrop, [data-mobile-menu], [role="status"][aria-label]').forEach(n => n.remove());
  // canvases drawn by site.js
  root.querySelectorAll('canvas').forEach(cv => {
    const z = cv.style.zIndex;
    if (z === '90') cv.setAttribute('data-ink', '');
    else { cv.setAttribute('data-ribbon', ''); cv.parentElement.setAttribute('data-ribbon-layer', ''); }
    cv.removeAttribute('width'); cv.removeAttribute('height');
  });
  root.querySelectorAll('video').forEach(v => { v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); if (v.closest('[data-film]')) { v.removeAttribute('src'); v.setAttribute('preload', 'none'); } });
  root.querySelectorAll('[data-map]').forEach(m => m.classList.remove('on'));
  root.querySelectorAll('[data-flown],[data-fly]').forEach(n => { n.removeAttribute('data-flown'); n.removeAttribute('data-fly'); n.classList.remove('is-in'); n.style.removeProperty('--fd'); });
  root.querySelectorAll('[style-hover]').forEach(n => n.removeAttribute('style-hover'));
  root.querySelectorAll('[data-dc-tpl]').forEach(n => n.removeAttribute('data-dc-tpl'));
  // navigation targets -> real links
  root.querySelectorAll('[data-href]').forEach(n => {
    const href = n.getAttribute('data-href');
    n.removeAttribute('data-href');
    if (n.tagName === 'A') { n.setAttribute('href', href); return; }
    if (n.tagName === 'TR') { n.setAttribute('data-go', href); return; }
    const a = document.createElement('a');
    for (const at of n.attributes) if (at.name !== 'type') a.setAttribute(at.name, at.value);
    a.setAttribute('href', href);
    a.setAttribute('data-was', n.tagName.toLowerCase());
    while (n.firstChild) a.appendChild(n.firstChild);
    n.replaceWith(a);
  });
  root.querySelectorAll('[src]').forEach(n => n.setAttribute('src', ABS(n.getAttribute('src'))));
  root.querySelectorAll('[poster]').forEach(n => n.setAttribute('poster', ABS(n.getAttribute('poster'))));
  root.querySelectorAll('img[data-map-src], img').forEach(n => { if (n.getAttribute('src') && n.getAttribute('src').startsWith('blob:')) n.setAttribute('data-blob', ''); });
  return { body: root.innerHTML, styles, title: document.title, desc: (document.querySelector('meta[name="description"]') || {}).content || '' };
}

function fragHTML(sel, opts) {
  document.querySelectorAll('input, textarea, select').forEach(n => { n.toggleAttribute('required', n.required); if (n.type === 'radio' || n.type === 'checkbox') n.toggleAttribute('checked', n.checked); });
  const el = document.querySelector(sel);
  if (!el) return null;
  const c = el.cloneNode(true);
  c.querySelectorAll('[data-href]').forEach(n => { if (n.tagName === 'A') n.setAttribute('href', n.getAttribute('data-href')); n.removeAttribute('data-href'); });
  c.querySelectorAll('[style-hover]').forEach(n => n.removeAttribute('style-hover'));
  c.querySelectorAll('[data-dc-tpl]').forEach(n => n.removeAttribute('data-dc-tpl')); c.removeAttribute('data-dc-tpl');
  if (opts && opts.keepFirst) { const items = c.querySelectorAll(opts.keepFirst); items.forEach((n, i) => { if (i) n.remove(); }); }
  return opts && opts.inner ? c.innerHTML : c.outerHTML;
}

const clk = (page, sel) => page.$eval(sel, el => el.click());
const frag = (page, sel, opts) => page.evaluate(([src, sel, opts]) => (new Function('return ' + src))()(sel, opts), [fragHTML.toString(), sel, opts || null]);

(async () => {
  const srv = await serve();
  const origin = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch();
  const result = { origin, styles: [], pages: [], frags: {}, search: {}, routes: {}, meta: {} };
  const styleSeen = new Set();
  const addStyles = list => list.forEach(s => { if (!styleSeen.has(s)) { styleSeen.add(s); result.styles.push(s); } });

  for (const L of LANGS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(lang => {
      try { sessionStorage.setItem('belenda-intro-seen', '1'); localStorage.setItem('belenda-lang', lang); localStorage.removeItem('belenda-nav'); } catch (e) {}
      if (location.protocol.startsWith('http')) document.cookie = 'belenda_consent=necessary;path=/';
    }, L);
    await ctx.route('https://form.bielendaprint.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"success":"true"}' }));
    await ctx.route(/^https:\/\/(www\.google|mc\.yandex|www\.googletagmanager)/, r => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', e => console.error('[pageerror]', L, e.message));
    await page.goto(origin + '/__prerender.html#/', { waitUntil: 'load' });
    await page.waitForSelector('main section[data-screen-label]', { timeout: 60000 });
    await page.waitForTimeout(500);

    const BL = await page.evaluate(() => {
      const { P, CATS, SLUG, tr, catLabel } = window.__BL;
      const L = document.documentElement.lang || 'ru';
      return {
        P: P.map(p => ({ id: p.id, cat: p.cat, sku: p.sku, img: p.img || '', stock: p.stock, name: p.name, nameT: tr(p.name, L), summaryT: tr(p.summary, L), catT: tr(catLabel(p.cat), L), specs: (p.specs || []).map(([k, v]) => [tr(k, L), tr(v, L)]) })),
        CATS: CATS.map(c => ({ id: c.id, label: tr(c.label, L), desc: tr(c.desc, L) })),
        SLUG,
        home: tr('Главная', L), catalog: tr('Каталог', L), allProducts: tr('Вся продукция', L),
      };
    });

    const pre = L === 'ru' ? '/' : '/' + L + '/';
    const routes = [
      { hash: '#/', page: 'home', path: '' },
      { hash: '#/about', page: 'about', path: 'about/' },
      { hash: '#/catalog', page: 'catalog', path: 'catalog/', cat: 'all' },
      ...BL.CATS.map(c => ({ hash: '#/catalog/' + c.id, page: 'catalog', path: 'catalog/' + c.id + '/', cat: c.id })),
      ...BL.P.map(p => ({ hash: '#/product/' + p.id, page: 'product', path: 'products/' + BL.SLUG[p.id] + '/', pid: p.id })),
      { hash: '#/contacts', page: 'contacts', path: 'contacts/' },
      { hash: '#/privacy', page: 'privacy', path: 'privacy/' },
    ].filter(r => !ONLY || r.hash.includes(ONLY) || r.page === 'home');
    if (L === 'ru') for (const r of routes) result.routes[r.hash] = '/' + r.path;

    // ---- fragments (taken on the home page) ----
    const F = {};
    await clk(page, '[data-on-click="toggleMenu"]'); await page.waitForSelector('[data-mobile-menu]');
    F.menu = await frag(page, '[data-mobile-menu]');
    await clk(page, '[data-on-click="toggleMenu"]');
    await clk(page, '[data-nav="desk"] [data-on-click="openRequest"]'); await page.waitForSelector('.dialog-backdrop');
    F.dialog = await frag(page, '.dialog-backdrop');
    await page.fill('.dialog-backdrop input[name="Имя и компания"]', 'x'); await page.fill('.dialog-backdrop input[name="Контакт"]', 'x');
    await clk(page, '.dialog-backdrop [type=submit]'); await page.waitForTimeout(400);
    F.dialogSent = await frag(page, '.dialog-backdrop');
    await clk(page, '.dialog-backdrop [data-on-click="closeRequest"].btn');
    await clk(page, '[data-on-click="openCookie"]'); await page.waitForSelector('[data-cookie]');
    F.cookie = await frag(page, '[data-cookie]');
    await clk(page, '[data-on-click="acceptNec"]');
    await page.fill('[data-nav="desk"] input[type=search]', 'ny'); await page.waitForTimeout(300);
    F.sugg = await frag(page, '[data-nav="desk"] form > div', { keepFirst: '[data-on-mouse-down="sg.open"]' });
    await page.fill('[data-nav="desk"] input[type=search]', 'zzqqxx'); await page.waitForTimeout(200);
    F.suggNone = await frag(page, '[data-nav="desk"] form > div');
    await page.fill('[data-nav="desk"] input[type=search]', ''); await page.mouse.click(5, 600);
    result.frags[L] = F;

    // ---- pages ----
    await page.waitForTimeout(1800); // app re-syncs title/route at +300ms and +1500ms
    // helmet re-renders the static <title> on any state change, so leave home and come back
    await page.evaluate(() => { location.hash = '#/privacy'; }); await page.waitForTimeout(400);
    let prevTitle = await page.title();
    for (const r of routes) {
      {
        await page.evaluate(h => { location.hash = h; }, r.hash);
        await page.waitForFunction(pt => document.title !== pt, prevTitle, { timeout: 5000 }).catch(() => console.error('title unchanged', L, r.hash));
      }
      await page.waitForTimeout(150);
      await page.evaluate(() => window.scrollTo(0, 0));
      const snap = await page.evaluate(snapshotInPage);
      prevTitle = snap.title;
      addStyles(snap.styles);
      const frags = ['menu', 'dialog', 'dialogSent', 'cookie', 'sugg', 'suggNone'];
      if (r.page === 'catalog') {
        await page.fill('section input[type=search][data-on-change="onSearch"]', 'zzqqxx'); await page.waitForTimeout(150);
        if (!F.noResults) F.noResults = await frag(page, 'section .blueprint:has([data-on-click="resetFilters"])');
        await page.fill('section input[type=search][data-on-change="onSearch"]', ''); await page.waitForTimeout(150);
        if (!F.table) {
          await clk(page, 'input[data-on-change="setTable"]'); await page.waitForTimeout(200);
          F.table = await frag(page, 'div:has(> table.table)', { keepFirst: 'tbody tr' });
          await clk(page, 'input[data-on-change="setGrid"]'); await page.waitForTimeout(200);
        }
        frags.push('noResults', 'table');
      }
      if (r.page === 'contacts') {
        if (!F.contactSent) {
          await page.fill('form[data-on-submit="submitContact"] input[name="Имя"]', 'x');
          await page.fill('form[data-on-submit="submitContact"] input[name="Контакт"]', 'x');
          const box = await page.evaluateHandle(() => document.querySelector('form[data-on-submit="submitContact"]').closest('.blueprint'));
          await clk(page, 'form[data-on-submit="submitContact"] [type=submit]'); await page.waitForTimeout(400);
          F.contactSent = await box.evaluate(b => b.innerHTML);
          await clk(page, '[data-on-click="resetContact"]');
        }
        frags.push('contactSent');
      }
      const pg = { lang: L, page: r.page, path: r.path, title: snap.title, desc: snap.desc, body: snap.body, frags };
      const crumbs = [[BL.home, pre]];
      if (r.page === 'catalog' || r.page === 'product') crumbs.push([BL.catalog, pre + 'catalog/']);
      if (r.page === 'catalog' && r.cat !== 'all') crumbs.push([BL.CATS.find(c => c.id === r.cat).label, pre + r.path]);
      if (r.page === 'product') {
        const p = BL.P.find(x => x.id === r.pid);
        const c = BL.CATS.find(x => x.id === p.cat);
        crumbs.push([c.label, pre + 'catalog/' + c.id + '/'], [p.nameT, pre + r.path]);
        const imgFile = p.img && ['assets/products/', 'products/'].map(d => d + p.img + '.jpg').find(f => fs.existsSync(path.join(ROOT, f)));
        if (imgFile) pg.image = SITE + '/' + imgFile;
        const maker = p.specs.find(([k]) => /производитель|manufacturer|өндіруші/i.test(k));
        pg.product = { '@type': 'Product', name: p.nameT, description: p.summaryT, sku: p.sku, category: c.label, url: SITE + pre + r.path,
          ...(pg.image ? { image: pg.image } : {}), ...(maker ? { brand: { '@type': 'Brand', name: maker[1].split(/[,(]/)[0].trim() } } : {}) };
      }
      if (r.page !== 'home') pg.breadcrumbs = crumbs;
      result.pages.push(pg);
      process.stdout.write('.');
    }
    result.search[L] = BL.P.map(p => ({ n: p.nameT, s: p.sku, c: p.catT, u: pre + 'products/' + BL.SLUG[p.id] + '/', q: (p.name + ' ' + p.nameT + ' ' + p.sku + ' ' + p.catT).toLowerCase() }));
    if (L === 'ru') {
      result.meta = await page.evaluate(() => {
        const icon = s => (document.querySelector('link[rel~="icon"][sizes="' + s + '"], link[rel="apple-touch-icon"][sizes="' + s + '"]') || {}).href || '';
        const ld = JSON.parse((document.querySelector('script[type="application/ld+json"]') || {}).textContent || '{}');
        return { icons: { 32: icon('32x32'), 512: icon('512x512'), 180: icon('180x180') }, org: (ld['@graph'] || [])[0] || {} };
      });
      for (const k in result.meta.icons) result.meta.icons[k] = result.meta.icons[k].replace(origin, '');
    }
    console.log(' ' + L + ' done');
    await ctx.close();
  }
  await browser.close(); srv.close();
  fs.writeFileSync(OUT, JSON.stringify(result));
})().catch(e => { console.error(e); process.exit(1); });
