#!/usr/bin/env python3
"""Сборка статического сайта bielendaprint.com.

Источник — _build/source.html (выгрузка конструктора: шаблон + данные + React).
Скрипт дорабатывает шаблон (настоящие ссылки, data-атрибуты для site.js),
прорисовывает каждую страницу на ru/kk/en в Chromium (prerender.js)
и сохраняет готовый HTML: /, /about/, /catalog/, /catalog/<раздел>/,
/products/<slug>/, /contacts/, /privacy/ и то же под /kk/ и /en/.

Запуск из корня репозитория:  python3 _build/build.py
"""
import base64, gzip, hashlib, html, json, os, re, shutil, subprocess, sys, zlib
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, '_build')
WORK = os.path.join(BUILD, '.work')
SITE = 'https://bielendaprint.com'
LANGS = ['ru', 'kk', 'en']
OG_LOCALE = {'ru': 'ru_RU', 'kk': 'kk_KZ', 'en': 'en_US'}
PREFIX = {'ru': '/', 'kk': '/kk/', 'en': '/en/'}

EXT = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg', 'image/gif': 'gif',
       'image/webp': 'webp', 'font/woff2': 'woff2', 'font/woff': 'woff'}


def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'expected {count}x, found {n}: {old[:90]!r}'
    return s.replace(old, new)


def section(src, tag):
    m = re.search(r'(<script type="__bundler/' + tag + r'">\n)(.*?)(\n  </script>)', src, re.S)
    assert m, tag
    return m


def decode(entry):
    d = base64.b64decode(entry['data'])
    if entry.get('compressed'):
        try:
            d = gzip.decompress(d)
        except OSError:
            d = zlib.decompress(d, -15)
    return d


# ---------------------------------------------------------------- template
NAV_HREF = {
    'goHome': 'hrefHome', 'goAbout': 'hrefAbout', 'goCatalog': 'hrefCatalog',
    'goContacts': 'hrefContacts', 'goPrivacy': 'hrefPrivacy', 'resetFilters': 'hrefCatalog',
    'mi.go': 'mi.href', 'c.open': 'c.href', 'f.pick': 'f.href', 'p.open': 'p.href',
    'prod.openCat': 'prod.catHref', 'r.open': 'r.href', 'lg.pick': 'lg.href',
}

SLUG_JS = r"""
const TRANSLIT = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
const SLUG = (() => {
  const m = {}, used = {};
  const slugify = s => String(s || '').toLowerCase().replace(/[а-яё]/g, ch => TRANSLIT[ch] || '').normalize('NFKD').replace(/[̀-ͯ®™°³]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
  P.forEach(p => {
    let s = /^BL-/i.test(p.sku) ? slugify(p.name) : slugify(p.sku);
    if (!s) s = 'item';
    if (used[s]) s = s + '-' + p.id;
    used[s] = 1; m[p.id] = s;
  });
  return m;
})();
"""

HREF_METHODS = r"""  pageHref(L, st) {
    const pre = L === 'ru' ? '/' : '/' + L + '/';
    const pg = st.page || 'home';
    if (pg === 'home') return pre;
    if (pg === 'catalog') return pre + 'catalog/' + (st.cat && st.cat !== 'all' ? st.cat + '/' : '');
    if (pg === 'product') return pre + 'products/' + SLUG[st.pid] + '/';
    return pre + pg + '/';
  }
  hrefVals(L) {
    const h = page => this.pageHref(L, { page });
    return { hrefHome: h('home'), hrefAbout: h('about'), hrefCatalog: h('catalog'), hrefContacts: h('contacts'), hrefPrivacy: h('privacy') };
  }
  renderVals() {"""


def patch_template(t):
    # every event binding becomes a data-on-* attribute site.js can see
    t = re.sub(r'sc-camel-on-([a-z-]+)="\{\{ ([\w.]+) \}\}"',
               lambda m: m.group(0) + f' data-on-{m.group(1)}="{m.group(2)}"', t)
    # navigation becomes a real link target
    def add_href(m):
        name = m.group(1)
        return m.group(0) + (f' data-href="{{{{ {NAV_HREF[name]} }}}}"' if name in NAV_HREF else '')
    t = re.sub(r'sc-camel-on-click="\{\{ ([\w.]+) \}\}"', add_href, t)
    t = rep(t, '<div ref="{{ progRef }}"', '<div data-prog="" ref="{{ progRef }}"')
    t = t.replace(' required=""', ' required="required"')  # the runtime read an empty value as false
    # catalog card / row data for client-side search and table view
    t = rep(t, '<article data-tilt="" class="blueprint"',
            '<article data-tilt="" data-card="" data-q="{{ p.q }}" data-sku="{{ p.sku }}" data-name="{{ p.name }}" data-cl="{{ p.catLabel }}" data-st="{{ p.status }}" data-stc="{{ p.statusCls }}" class="blueprint"')
    t = rep(t, '{{ t.k56 }} {{ resultCount }}</span>',
            '{{ t.k56 }} <b data-count="" style="font-weight:inherit;">{{ resultCount }}</b></span>')
    # script: slugs, hrefs, initial state, data export
    imgs = sorted({f[:-4] for d in ('assets/products', 'products') for f in os.listdir(os.path.join(ROOT, d)) if f.endswith('.jpg')})
    img_fix = 'const IMG_OK = new Set(' + json.dumps(imgs) + ');\nP.forEach(p => { if (p.img && !IMG_OK.has(p.img)) p.img = \'\'; });\n'
    t = rep(t, 'const RU_KEYS = ', SLUG_JS + img_fix + 'const RU_KEYS = ')
    t = rep(t, '  renderVals() {', HREF_METHODS)
    t = rep(t, "if (fromHash) Object.assign(this.state, { cat: 'all', ...fromHash });",
            "if (fromHash) Object.assign(this.state, { cat: 'all', ...fromHash });\n    if (window.__BL_INIT) Object.assign(this.state, window.__BL_INIT);")
    t = rep(t, "      ...p, name: tt(p.name), summary: tt(p.summary), catLabel: tt(catLabel(p.cat)),",
            "      ...p, name: tt(p.name), summary: tt(p.summary), catLabel: tt(catLabel(p.cat)),\n"
            "      href: this.pageHref(L, { page: 'product', pid: p.id }), catHref: this.pageHref(L, { page: 'catalog', cat: p.cat }),\n"
            "      q: (p.name + ' ' + tt(p.name) + ' ' + p.sku).toLowerCase(),")
    t = rep(t, "count: n + ' ' +", "href: this.pageHref(L, { page: 'catalog', cat: c.id }), count: n + ' ' +")
    t = rep(t, "label: tt(c.label), cls: 'btn ' + (s.cat === c.id ? 'btn-primary' : 'btn-secondary'),",
            "label: tt(c.label), cls: 'btn ' + (s.cat === c.id ? 'btn-primary' : 'btn-secondary'), href: this.pageHref(L, { page: 'catalog', cat: c.id }),")
    t = rep(t, "({ label, on: L === code ? 'true' : 'false', pick:",
            "({ label, code, href: this.pageHref(code, s), on: L === code ? 'true' : 'false', pick:")
    t = rep(t, "({ label: tt(label), go: this.nav({ page: pg }),",
            "({ label: tt(label), href: this.pageHref(L, { page: pg }), go: this.nav({ page: pg }),")
    t = rep(t, "      isHome: s.page === 'home',", "      ...this.hrefVals(L),\n      isHome: s.page === 'home',")
    t = rep(t, "class Component extends DCLogic {",
            "window.__BL = { P, CATS, SLUG, PRIVACY, tr, catLabel };\nclass Component extends DCLogic {")
    return t


# ---------------------------------------------------------------- stage 1
def prepare():
    src = open(os.path.join(BUILD, 'source.html'), encoding='utf-8').read()
    man_m = section(src, 'manifest')
    manifest = json.loads(man_m.group(2))
    os.makedirs(os.path.join(ROOT, 'assets', 'b'), exist_ok=True)
    paths = {}
    for uuid, entry in manifest.items():
        ext = EXT.get(entry['mime'])
        if not ext:
            continue
        data = decode(entry)
        name = hashlib.sha1(data).hexdigest()[:12] + '.' + ext
        out = os.path.join(ROOT, 'assets', 'b', name)
        if not os.path.exists(out):
            open(out, 'wb').write(data)
        paths[uuid] = '/assets/b/' + name

    tm = section(src, 'template')
    t = patch_template(json.loads(tm.group(2)))
    enc = json.dumps(t, ensure_ascii=False).replace('</', '<\\u002F')
    src = src[:tm.start(2)] + enc + src[tm.end(2):]
    src = rep(src, 'template = template.split(uuid).join(blobUrls[uuid]);',
              'template = template.split(uuid).join(__ASSET_PATHS[uuid] || blobUrls[uuid]);')
    src = rep(src, "document.addEventListener('DOMContentLoaded', async function() {",
              'const __ASSET_PATHS = ' + json.dumps(paths) + ";\ndocument.addEventListener('DOMContentLoaded', async function() {")
    open(os.path.join(ROOT, '__prerender.html'), 'w', encoding='utf-8').write(src)
    return paths


# ---------------------------------------------------------------- stage 3
def esc(s):
    return html.escape(s or '', quote=True)


def page_url(lang, path):
    return SITE + PREFIX[lang] + path


def build_head(lang, pg, data):
    title, desc = pg['title'], pg['desc']
    path = pg['path']
    url = page_url(lang, path)
    img = pg.get('image') or SITE + '/og-image.png'
    alts = ''.join(f'  <link rel="alternate" hreflang="{l}" href="{page_url(l, path)}">\n' for l in LANGS)
    alts += f'  <link rel="alternate" hreflang="x-default" href="{page_url("ru", path)}">\n'
    ld = [data['org']]
    if pg.get('breadcrumbs'):
        ld.append({'@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': SITE + u}
            for i, (n, u) in enumerate(pg['breadcrumbs'])]})
    if pg.get('product'):
        ld.append(pg['product'])
    ld_json = json.dumps({'@context': 'https://schema.org', '@graph': ld}, ensure_ascii=False).replace('</', '<\\/')
    return f'''<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(desc)}">
  <link rel="canonical" href="{url}">
{alts}  <meta name="theme-color" content="#f2f2f3">
  <meta property="og:type" content="{'product' if pg.get('product') else 'website'}">
  <meta property="og:site_name" content="Bielenda">
  <meta property="og:locale" content="{OG_LOCALE[lang]}">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(desc)}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{img}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{esc(title)}">
  <meta name="twitter:description" content="{esc(desc)}">
  <meta name="twitter:image" content="{img}">
  <link rel="icon" type="image/png" sizes="32x32" href="{data['icons']['32']}">
  <link rel="icon" type="image/png" sizes="512x512" href="{data['icons']['512']}">
  <link rel="apple-touch-icon" sizes="180x180" href="{data['icons']['180']}">
{data['preload']}  <link rel="stylesheet" href="/assets/site.css?v={data['ver']}">
  <script>try{{if(matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('rm')}}catch(e){{}}</script>
  <script defer src="/assets/site.js?v={data['ver']}"></script>
  <script type="application/ld+json">{ld_json}</script>
</head>'''


def finish(res, paths):
    pages, frags, styles, meta = res['pages'], res['frags'], res['styles'], res['meta']
    css = '\n'.join(styles)
    css = css.replace(res['origin'], '')
    # buttons that became links keep their button look
    css = css.replace('[data-lang] button', '[data-lang] :is(button,a)')
    css += ('\n/* static build */\na[data-was] { cursor:pointer; text-decoration:none; }\na[data-was]:not(.btn) { color:inherit; }\n'
            'a[data-was="button"]:not([style*="display"]) { display:inline-flex; align-items:center; justify-content:center; }\n'
            'tr[data-go] { cursor:pointer; }\n[hidden] { display:none !important; }\n')
    open(os.path.join(ROOT, 'assets', 'site.css'), 'w', encoding='utf-8').write(css)
    shutil.copy(os.path.join(BUILD, 'site.js'), os.path.join(ROOT, 'assets', 'site.js'))
    ver = hashlib.sha1((css + open(os.path.join(BUILD, 'site.js'), encoding='utf-8').read()).encode()).hexdigest()[:8]

    icons = meta['icons']
    org = meta['org']
    fonts = sorted(set(re.findall(r'/assets/b/[0-9a-f]+\.woff2', css)))
    data = {'ver': ver, 'icons': icons, 'org': org, 'preload': ''}

    written = []
    def fix_img(m):
        f = m.group(1)
        if os.path.exists(os.path.join(ROOT, 'assets', 'products', f)): return m.group(0)
        if os.path.exists(os.path.join(ROOT, 'products', f)): return '/products/' + f
        return m.group(0)
    for pg in pages:
        lang = pg['lang']
        body = re.sub(r'/assets/products/([\w.-]+\.jpg)', fix_img, pg['body'].replace(res['origin'], ''))
        tpl = ''.join(f'<template data-tpl="{k}">{v.replace(res["origin"], "")}</template>' for k, v in frags[lang].items()
                      if k in pg['frags'])
        doc = (f'<!DOCTYPE html>\n<html lang="{lang}">\n' + build_head(lang, pg, data) +
               f'\n<body data-site-lang="{lang}" data-page="{pg["page"]}">\n{body}\n{tpl}\n</body>\n</html>\n')
        out = os.path.join(ROOT, (PREFIX[lang] + pg['path']).lstrip('/'), 'index.html')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, 'w', encoding='utf-8').write(doc)
        written.append(out)

    # 404: the Russian home page, not indexed
    home = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    home = home.replace('<meta name="viewport"', '<meta name="robots" content="noindex">\n  <meta name="viewport"', 1)
    open(os.path.join(ROOT, '404.html'), 'w', encoding='utf-8').write(home)

    for lang in LANGS:
        open(os.path.join(ROOT, 'assets', f'search-{lang}.json'), 'w', encoding='utf-8').write(
            json.dumps(res['search'][lang], ensure_ascii=False, separators=(',', ':')))
    open(os.path.join(ROOT, 'assets', 'routes.json'), 'w', encoding='utf-8').write(
        json.dumps(res['routes'], ensure_ascii=False, separators=(',', ':')))

    # sitemap with hreflang alternates
    today = date.today().isoformat()
    rows = []
    for pg in pages:
        if pg['lang'] != 'ru':
            continue
        alts = ''.join(f'\n    <xhtml:link rel="alternate" hreflang="{l}" href="{page_url(l, pg["path"])}"/>' for l in LANGS)
        img = f'\n    <image:image><image:loc>{pg["image"]}</image:loc></image:image>' if pg.get('image') else ''
        for l in LANGS:
            pri = '1.0' if pg['path'] == '' else '0.8' if pg['page'] in ('catalog', 'product') else '0.6'
            rows.append(f'  <url>\n    <loc>{page_url(l, pg["path"])}</loc>\n    <lastmod>{today}</lastmod>\n    <priority>{pri}</priority>{alts}{img}\n  </url>')
    open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8').write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
        + '\n'.join(rows) + '\n</urlset>\n')
    open(os.path.join(ROOT, 'robots.txt'), 'w').write(f'User-agent: *\nAllow: /\nDisallow: /_build/\n\nSitemap: {SITE}/sitemap.xml\n')
    return written


def main():
    if '--finish' in sys.argv:  # re-run only the HTML assembly from the last prerender
        res = json.load(open(os.path.join(WORK, 'prerender.json'), encoding='utf-8'))
        print(f'{len(finish(res, None))} pages written')
        return
    paths = prepare()
    os.makedirs(WORK, exist_ok=True)
    out = os.path.join(WORK, 'prerender.json')
    only = sys.argv[1] if len(sys.argv) > 1 else ''
    env = dict(os.environ)
    env.setdefault('NODE_PATH', subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip())
    subprocess.run(['node', os.path.join(BUILD, 'prerender.js'), out, only], check=True, cwd=ROOT, env=env)
    res = json.load(open(out, encoding='utf-8'))
    written = finish(res, paths)
    os.remove(os.path.join(ROOT, '__prerender.html'))
    print(f'{len(written)} pages written')


if __name__ == '__main__':
    main()
