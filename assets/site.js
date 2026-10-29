/* Bielenda — интерактив статического сайта (без фреймворков).
   Исходник: _build/site.js, копируется в /assets/site.js при сборке. */
(() => {
  'use strict';

  // Аналитика: впишите ID счётчиков — загрузятся только после согласия на cookie.
  const GA_ID = '';
  const YM_ID = '';
  const LEAD_EMAIL = 'info@bielendaprint.com';
  const LEAD_URL = 'https://form.bielendaprint.com/send.php';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const body = document.body;
  const LANG = body.dataset.siteLang || 'ru';
  const PRE = LANG === 'ru' ? '/' : '/' + LANG + '/';
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HOVER = matchMedia('(hover: hover)').matches;
  const STR = {
    ru: { play: 'Смотреть', pause: 'Пауза', replay: 'Смотреть снова', tagline: 'Оборудование и материалы для допечатной подготовки', item: 'Позиция:', fail: 'Не удалось отправить сообщение. Напишите нам на ' },
    kk: { play: 'Ойнату', pause: 'Кідірту', replay: 'Қайта көру', tagline: 'Баспаға дейінгі дайындыққа арналған жабдықтар мен материалдар', item: 'Позиция:', fail: 'Хабарлама жіберілмеді. Бізге жазыңыз: ' },
    en: { play: 'Play', pause: 'Pause', replay: 'Replay', tagline: 'Printing equipment & materials', item: 'Item:', fail: 'Could not send the message. Please write to ' },
  }[LANG];
  const tpl = name => { const t = $('template[data-tpl="' + name + '"]'); return t ? t.content.firstElementChild.cloneNode(true) : null; };
  const appRoot = () => ($('nav.nav') || {}).parentElement || body;

  // ---------------------------------------------------------------- old #/ links
  if (/^#\/./.test(location.hash) || location.hash === '#/') {
    fetch('/assets/routes.json').then(r => r.json()).then(map => {
      const h = location.hash.replace(/\/$/, '') || '#/';
      const to = map[h] || map[h.replace(/^(#\/[^/]+\/[^/]+).*/, '$1')];
      if (to) location.replace(PRE + to.replace(/^\//, ''));
    }).catch(() => {});
  }

  // ---------------------------------------------------------------- scroll progress
  const prog = $('[data-prog]');
  if (prog) {
    let raf = 0;
    const upd = () => { raf = 0; const max = Math.max(1, document.documentElement.scrollHeight - innerHeight); prog.style.clipPath = 'inset(0 ' + (100 - Math.min(1, Math.max(0, scrollY / max)) * 100).toFixed(2) + '% 0 0)'; };
    const on = () => { if (!raf) raf = requestAnimationFrame(upd); };
    addEventListener('scroll', on, { passive: true }); addEventListener('resize', on); upd();
  }

  // ---------------------------------------------------------------- ribbon background
  const ribbon = $('canvas[data-ribbon]');
  if (ribbon) {
    const cv = ribbon, ctx = cv.getContext('2d'), layer = $('[data-ribbon-layer]');
    const css = getComputedStyle(document.documentElement), col = k => css.getPropertyValue(k).trim();
    const R = [
      { c: col('--c') || '#00aeef', base: 0.78, amp: 0.07, f: 1.6, sp: 0.18, ph: 0.0, th: 0.16, sl: -0.55, a: 0.85 },
      { c: col('--m') || '#ec008c', base: 0.86, amp: 0.06, f: 1.9, sp: 0.22, ph: 1.7, th: 0.13, sl: -0.6, a: 0.8 },
      { c: col('--y') || '#ffe600', base: 0.95, amp: 0.05, f: 1.4, sp: 0.16, ph: 3.1, th: 0.12, sl: -0.62, a: 0.9 },
      { c: col('--k') || '#1d1f20', base: 1.06, amp: 0.05, f: 1.2, sp: 0.14, ph: 4.4, th: 0.1, sl: -0.5, a: 0.55 },
      { c: col('--c') || '#00aeef', base: 0.42, amp: 0.05, f: 2.2, sp: 0.12, ph: 2.2, th: 0.05, sl: -0.45, a: 0.45 },
    ];
    let W = 0, H = 0, sp = 0, target = 0, sy = 0, sOff = 0, t = 0;
    const size = () => { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    const readScroll = () => { const max = Math.max(1, document.documentElement.scrollHeight - innerHeight); target = Math.max(0, Math.min(1, scrollY / max)); sy = scrollY; };
    addEventListener('scroll', readScroll, { passive: true }); readScroll();
    const applyScroll = () => { sp += (target - sp) * 0.12; sOff += (sy * 0.004 - sOff) * 0.1; if (layer) layer.style.transform = `translateY(${-sp * 6}%) scale(${1.08 + sp * 0.12}) rotate(${-sp * 6}deg)`; };
    const draw = t0 => {
      const tt = t0 * 0.6 + sOff * 3;
      ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'multiply';
      const S = Math.min(H, W * 0.75), N = 70;
      R.forEach(r => {
        const top = [], bot = [];
        for (let i = 0; i <= N; i++) {
          const u = i / N, x = -0.1 * W + u * 1.2 * W;
          const y = H * r.base + r.sl * (x - W * 0.2) * (H / W) * 0.9 + S * r.amp * Math.sin(u * r.f * Math.PI * 2 + tt * r.sp + r.ph) + S * r.amp * 0.4 * Math.sin(u * 5.1 - tt * r.sp * 1.7 + r.ph);
          const th = S * r.th * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 1.4) * (0.85 + 0.15 * Math.sin(tt * 0.5 + r.ph + u * 3));
          top.push([x, y - th / 2]); bot.push([x, y + th / 2 + th * 0.25 * Math.sin(u * 3 + tt * 0.3)]);
        }
        const g = ctx.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.18, r.c); g.addColorStop(0.85, r.c); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = r.a; ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]);
        top.forEach(p => ctx.lineTo(p[0], p[1]));
        for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
        ctx.closePath(); ctx.fill();
      });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    };
    size(); new ResizeObserver(() => { size(); draw(t); }).observe(cv);
    if (REDUCE) draw(2);
    else {
      const t0 = performance.now(); let last = 0;
      const loop = now => { requestAnimationFrame(loop); if (document.hidden || now - last < 33) return; last = now; t = (now - t0) / 1000; applyScroll(); draw(t); };
      requestAnimationFrame(loop);
    }
  }

  // ---------------------------------------------------------------- ink trail cursor
  const ink = $('canvas[data-ink]');
  if (ink && HOVER && !REDUCE) {
    const cv = ink, ctx = cv.getContext('2d');
    const F = [['#00aeef', .32, 7], ['#ec008c', .24, 6.5], ['#ffe600', .18, 6], ['#1d1f20', .13, 2.5]].map(([c, k, w]) => ({ c, k, w, x: 0, y: 0, pts: [] }));
    let mx = 0, my = 0, on = false, last = 0, blank = true;
    const size = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size(); addEventListener('resize', size);
    addEventListener('pointermove', e => { if (e.pointerType && e.pointerType !== 'mouse') return; mx = e.clientX; my = e.clientY; last = performance.now(); if (!on) { F.forEach(f => { f.x = mx; f.y = my; f.pts = []; }); on = true; } }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { on = false; });
    const loop = now => {
      requestAnimationFrame(loop);
      if (now - last > 1200 && F.every(f => f.pts.length === 0)) { if (!blank) { ctx.clearRect(0, 0, innerWidth, innerHeight); blank = true; } return; }
      blank = false;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalCompositeOperation = 'multiply';
      const idle = now - last > 90;
      F.forEach(f => {
        f.x += (mx - f.x) * f.k; f.y += (my - f.y) * f.k;
        if (on) f.pts.unshift([f.x, f.y]);
        while (f.pts.length > 22) f.pts.pop();
        if (idle || !on) f.pts.splice(-2, 2);
        const n = f.pts.length;
        for (let j = 0; j < n - 1; j++) {
          const a = f.pts[j], b = f.pts[j + 1];
          if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < 0.4) continue;
          ctx.globalAlpha = 0.9 * (1 - j / n); ctx.lineWidth = f.w * (1 - j / n) + 0.5; ctx.strokeStyle = f.c;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
    };
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- reveal on scroll (only below the fold)
  if (!REDUCE && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target; el.classList.add('is-in'); io.unobserve(el);
      setTimeout(() => { el.removeAttribute('data-fly'); el.classList.remove('is-in'); }, 1900);
    }), { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    const W = innerWidth, fold = innerHeight;
    const dirOf = (el, alt) => { const r = el.getBoundingClientRect(); const c = r.left + r.width / 2; return c < W * 0.44 ? 'l' : c > W * 0.56 ? 'r' : (alt ? 'r' : 'l'); };
    const mark = (el, dir, d) => { if (el.hasAttribute('data-flown') || el.getBoundingClientRect().top < fold) return; el.setAttribute('data-flown', ''); el.setAttribute('data-fly', dir); el.style.setProperty('--fd', d + 's'); io.observe(el); };
    const tiles = '[data-tilt], [data-plate] tr';
    $$('main section').forEach((sec, si) => {
      [...sec.children].forEach((ch, i) => { if (ch.matches('[aria-hidden]') || ch.querySelector(tiles) || ch.matches(tiles)) return; mark(ch, dirOf(ch, si % 2), Math.min(i, 3) * 0.06); });
      $$(tiles, sec).forEach(t => { const idx = [...t.parentElement.children].indexOf(t); mark(t, t.matches('tr') ? (idx % 2 ? 'r' : 'l') : dirOf(t, idx % 2), (idx % 4) * 0.08); });
      $$('div[style*="border-bottom:1px solid var(--color-divider)"]', sec).forEach((row, i) => mark(row, 'r', (i % 6) * 0.06));
    });
  }

  // ---------------------------------------------------------------- 3D tilt on cards
  if (!REDUCE && HOVER) {
    let cur = null;
    const reset = el => { el.classList.remove('is-tilting'); el.style.transform = ''; };
    document.addEventListener('pointermove', ev => {
      const el = ev.target.closest && ev.target.closest('[data-tilt]');
      if (cur && cur !== el) reset(cur);
      cur = el; if (!el) return;
      const r = el.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      el.classList.add('is-tilting');
      el.style.setProperty('--gx', x * 100 + '%'); el.style.setProperty('--gy', y * 100 + '%');
      el.style.setProperty('--sx', ((0.5 - x) * 2).toFixed(3)); el.style.setProperty('--sy', ((0.5 - y) * 2).toFixed(3));
      el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 10}deg) rotateY(${(x - 0.5) * 12}deg) translateY(-6px)`;
    });
    document.addEventListener('pointerleave', () => { if (cur) reset(cur); cur = null; });
  }

  // ---------------------------------------------------------------- map
  $$('[data-map]').forEach(el => {
    if (!('IntersectionObserver' in window)) return el.classList.add('on');
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { el.classList.add('on'); io.disconnect(); } }), { threshold: 0.25 });
    io.observe(el);
  });

  // ---------------------------------------------------------------- film
  const film = $('[data-film]');
  if (film) {
    const v = $$('video', film).slice(0, 2), COUNT = 7, base = '/videos/';
    v.forEach(el => { el.muted = true; el.playsInline = true; });
    const btn = $('button', film), icon = btn && $('path', btn), svg = btn && $('svg', btn);
    const bars = $$('.seg i', film), flash = film.children[2];
    const st = { i: 0, front: 0, playing: false, ended: false, loaded: false, logo: false, switching: false, userPaused: false };
    const c = navigator.connection || {};
    const lite = !!c.saveData || /2g$/.test(c.effectiveType || '') || matchMedia('(max-width: 768px)').matches;
    const src = i => base + (i + 1) + '.mp4';
    const paint = () => {
      v.forEach((el, k) => { el.style.opacity = st.front === k ? 1 : 0; el.style.zIndex = st.front === k ? 2 : 1; });
      if (icon) icon.setAttribute('d', st.ended ? 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4' : st.playing ? 'M8 5v14M16 5v14' : 'M7 4.5v15l12-7.5z');
      if (svg) svg.setAttribute('fill', st.playing || st.ended ? 'none' : 'currentColor');
      if (btn) btn.setAttribute('aria-label', st.ended ? STR.replay : st.playing ? STR.pause : STR.play);
    };
    const prog = p => bars.forEach((b, k) => { b.style.width = (k < st.i ? 100 : k === st.i ? p * 100 : 0) + '%'; });
    const ensure = () => { if (st.loaded) return; st.loaded = true; v[0].src = src(0); v[1].src = src(1); v[0].load(); v[1].load(); };
    const play = () => { ensure(); const p = v[st.front].play(); if (p && p.catch) p.catch(() => {}); st.playing = true; paint(); };
    const pause = auto => { v[st.front].pause(); if (!auto) st.userPaused = true; st.playing = false; paint(); };
    const doFlash = () => { if (!flash) return; flash.style.animation = 'none'; void flash.offsetWidth; flash.style.animation = 'bl-flash .8s cubic-bezier(.4,0,.2,1)'; };
    const showLogo = () => {
      if (st.logo) return; st.logo = true;
      const logoSrc = ($('[data-logo-src]') || {}).src || '';
      const d = document.createElement('div'); d.setAttribute('data-film-logo', '');
      d.style.cssText = 'position:absolute;inset:0;z-index:4;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;pointer-events:none;background:radial-gradient(60% 50% at 50% 50%, rgba(242,242,243,.85), rgba(242,242,243,0) 75%);animation:bl-logo-in 1.2s cubic-bezier(.2,.8,.2,1) both';
      d.innerHTML = '<img alt="Bielenda" style="width:min(56%, 560px);height:auto"><span style="font-size:clamp(13px,1.5vw,20px);font-weight:500;letter-spacing:0.02em;color:#1d1f20;text-align:center;padding:0 16px"></span>';
      d.firstChild.src = logoSrc; d.lastChild.textContent = STR.tagline;
      film.insertBefore(d, film.children[3] || null);
    };
    const next = () => {
      const n = st.i + 1; if (n >= COUNT) return;
      st.switching = true;
      const back = 1 - st.front, nv = v[back];
      nv.currentTime = 0; const p = nv.play(); if (p && p.catch) p.catch(() => {});
      st.front = back; st.i = n; prog(0); doFlash(); paint();
      setTimeout(() => { const old = v[1 - back]; old.pause(); if (n + 1 < COUNT) { old.src = src(n + 1); old.load(); } st.switching = false; }, 800);
    };
    const restart = () => {
      st.userPaused = false; st.switching = false; st.i = 0; st.front = 0; st.ended = false; st.logo = false;
      const lg = $('[data-film-logo]', film); if (lg) lg.remove();
      v[0].src = src(0); v[1].src = src(1); v[0].load(); v[1].load(); prog(0); doFlash(); play();
    };
    const toggle = () => { if (st.ended) return restart(); if (st.playing) pause(); else { st.userPaused = false; play(); } };
    v.forEach((el, k) => el.addEventListener('ended', () => { if (k !== st.front) return; if (st.i >= COUNT - 1) { st.ended = true; st.playing = false; prog(1); paint(); } }));
    film.addEventListener('click', toggle);
    if (btn) btn.addEventListener('click', e => { e.stopPropagation(); toggle(); });
    new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting && !st.ended && !st.userPaused && (st.loaded || !lite)) play(); else if (!en.isIntersecting && st.playing) pause(true); }), { threshold: 0.45 }).observe(film);
    const tick = () => {
      requestAnimationFrame(tick);
      const cur = v[st.front]; if (!cur || !cur.duration) return;
      prog(cur.currentTime / cur.duration);
      if (st.i === COUNT - 1 && cur.currentTime > Math.max(0, cur.duration - 4.5)) showLogo();
      if (cur.duration - cur.currentTime < 0.45 && !st.switching && st.i < COUNT - 1) next();
    };
    requestAnimationFrame(tick); paint();
  }

  // ---------------------------------------------------------------- lead forms
  function sendLead(form, subject, extra, done) {
    const btn = $('[type=submit]', form);
    const data = { ...Object.fromEntries(new FormData(form)), ...extra, 'Страница': location.href, _subject: subject };
    if (btn) btn.disabled = true;
    fetch(LEAD_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) })
      .then(r => r.json().catch(() => ({ message: 'HTTP ' + r.status }))).then(j => { if (String(j.success) !== 'true') throw new Error(j.message || 'send failed'); if (btn) btn.disabled = false; done(); })
      .catch(err => {
        console.error('[lead]', err); if (btn) btn.disabled = false;
        if (confirm(STR.fail + LEAD_EMAIL + '\n\n(' + String((err && err.message) || err).slice(0, 200) + ')'))
          location.href = 'mailto:' + LEAD_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(Object.entries(data).filter(([k]) => k[0] !== '_').map(([k, v]) => k + ': ' + v).join('\n'));
      });
  }
  const prodName = () => { const h = $('main h1'); return body.dataset.page === 'product' && h ? h.textContent.trim() : ''; };
  const prodSku = () => { const t = $('main section[data-screen-label] span'); return t ? t.textContent.split('·').pop().trim() : ''; };

  // ---------------------------------------------------------------- request dialog
  let dlg = null;
  const closeDialog = () => { if (dlg) { dlg.remove(); dlg = null; } };
  const openDialog = () => {
    closeMenu(); closeDialog();
    dlg = tpl('dialog'); if (!dlg) return;
    const form = $('form', dlg), name = prodName();
    if (name && form) {
      const line = document.createElement('div'); line.style.fontSize = '14px';
      line.append(STR.item + ' '); const b = document.createElement('strong'); b.textContent = name; line.append(b, ' (' + prodSku() + ')');
      form.insertBefore(line, form.firstChild.nextSibling);
    }
    wireDialog(dlg);
    appRoot().appendChild(dlg);
    const first = $('input:not([type=hidden]):not([name=_honey])', dlg); if (first) first.focus();
  };
  const wireDialog = d => {
    d.addEventListener('click', e => { const a = e.target.closest('[data-on-click]'); if (e.target === d || (a && a !== d && a.dataset.onClick === 'closeRequest')) closeDialog(); });
    const form = $('form', d);
    if (form) form.addEventListener('submit', e => {
      e.preventDefault();
      const name = prodName();
      sendLead(form, 'Запрос КП' + (name ? ': ' + name : '') + ' — bielendaprint.com', name ? { 'Позиция': name + ' (' + prodSku() + ')' } : {}, () => {
        const sent = tpl('dialogSent'); if (!sent) return closeDialog();
        dlg.replaceWith(sent); dlg = sent; wireDialog(sent);
      });
    });
  };
  addEventListener('keydown', e => { if (e.key === 'Escape') { closeDialog(); closeMenu(); } });

  // ---------------------------------------------------------------- mobile menu
  let menu = null;
  const burger = $('[data-on-click="toggleMenu"]');
  function closeMenu() { if (!menu) return; menu.remove(); menu = null; body.style.overflow = ''; if (burger) burger.setAttribute('aria-expanded', 'false'); }
  const openMenu = () => {
    menu = tpl('menu'); if (!menu) return;
    const cur = body.dataset.page === 'product' ? 'catalog' : body.dataset.page;
    $$('[data-mi]', menu).forEach(a => { const href = a.getAttribute('href') || ''; const pg = href === PRE ? 'home' : href.replace(PRE, '').replace(/\/$/, ''); if (pg === cur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('nav.nav').after(menu); body.style.overflow = 'hidden'; burger.setAttribute('aria-expanded', 'true');
    $$('[data-nav-search]', menu).forEach(wireSearch);
  };
  if (burger) burger.addEventListener('click', () => (menu ? closeMenu() : openMenu()));

  // ---------------------------------------------------------------- cookie consent
  const readCookie = n => (document.cookie.match('(?:^|; )' + n + '=([^;]*)') || [])[1];
  let cookieBox = null, analyticsOn = false;
  const loadAnalytics = () => {
    if (analyticsOn) return; analyticsOn = true;
    if (GA_ID) {
      const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID); document.head.appendChild(s);
      window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
      gtag('js', new Date()); gtag('config', GA_ID, { anonymize_ip: true });
    }
    if (YM_ID) {
      (function (m, e, t, r, i, k, a) { m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); }; m[i].l = 1 * new Date(); k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a); })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
      ym(Number(YM_ID), 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true });
    }
  };
  const setConsent = v => { document.cookie = 'belenda_consent=' + v + ';path=/;max-age=' + 60 * 60 * 24 * 365 + ';SameSite=Lax'; if (cookieBox) { cookieBox.remove(); cookieBox = null; } if (v === 'all') loadAnalytics(); };
  const showCookie = () => {
    if (cookieBox) return;
    cookieBox = tpl('cookie'); if (!cookieBox) return;
    cookieBox.addEventListener('click', e => { const b = e.target.closest('[data-on-click]'); if (!b) return; const a = b.dataset.onClick; if (a === 'acceptAll') setConsent('all'); if (a === 'acceptNec') setConsent('necessary'); });
    appRoot().appendChild(cookieBox);
  };
  const consent = readCookie('belenda_consent');
  if (consent === 'all') loadAnalytics(); else if (!consent) setTimeout(showCookie, 600);

  // ---------------------------------------------------------------- global clicks
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-on-click]'); if (!el) return;
    const a = el.dataset.onClick;
    if (a === 'openRequest') { e.preventDefault(); openDialog(); }
    else if (a === 'openCookie') { e.preventDefault(); showCookie(); }
  });
  $$('tr[data-go]').forEach(tr => tr.addEventListener('click', () => { location.href = tr.dataset.go; }));

  // ---------------------------------------------------------------- contact form
  const contact = $('form[data-on-submit="submitContact"]');
  if (contact) {
    const box = contact.closest('.blueprint'), original = box.innerHTML;
    const wire = () => {
      const f = $('form', box);
      f.addEventListener('submit', e => { e.preventDefault(); sendLead(f, 'Сообщение с сайта — bielendaprint.com', {}, () => {
        const sent = $('template[data-tpl="contactSent"]'); if (!sent) return;
        box.innerHTML = sent.innerHTML;
        const r = $('[data-on-click="resetContact"]', box); if (r) r.addEventListener('click', () => { box.innerHTML = original; wire(); });
      }); });
    };
    wire();
  }

  // ---------------------------------------------------------------- header search with suggestions
  let index = null;
  const loadIndex = () => index || (index = fetch('/assets/search-' + LANG + '.json').then(r => r.json()).catch(() => []));
  function wireSearch(form) {
    const input = $('input[type=search]', form);
    if (!input || form.dataset.wired) return; form.dataset.wired = '1';
    let box = null;
    const close = () => { if (box) { box.remove(); box = null; } };
    const go = q => { location.href = PRE + 'catalog/' + (q ? '?q=' + encodeURIComponent(q) : ''); };
    const render = async () => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) return close();
      const list = (await loadIndex()).filter(p => p.q.includes(q)).slice(0, 5);
      if (input.value.trim().toLowerCase() !== q) return;
      const nb = tpl(list.length ? 'sugg' : 'suggNone'); if (!nb) return;
      if (list.length) {
        const item = $('[data-on-mouse-down="sg.open"]', nb), parent = item.parentElement;
        list.forEach(p => {
          const it = item.cloneNode(true), sp = $$('span', it);
          sp[0].textContent = p.n; sp[1].textContent = p.s + ' · ' + p.c;
          it.addEventListener('mousedown', e => { e.preventDefault(); location.href = p.u; });
          parent.insertBefore(it, item);
        });
        item.remove();
      }
      const all = $('[type=submit]', nb); if (all) all.addEventListener('mousedown', e => { e.preventDefault(); go(input.value.trim()); });
      close(); box = nb; form.appendChild(box);
    };
    input.addEventListener('focus', () => { loadIndex(); render(); });
    input.addEventListener('input', render);
    input.addEventListener('blur', () => setTimeout(close, 150));
    form.addEventListener('submit', e => { e.preventDefault(); const q = input.value.trim(); if (!q) return input.focus(); go(q); });
  }
  $$('[data-nav-search]').forEach(wireSearch);

  // ---------------------------------------------------------------- catalog: search, empty state, grid/table
  const cards = $$('[data-card]');
  const qInput = $('input[data-on-change="onSearch"]');
  if (qInput && cards.length) {
    const grid = cards[0].parentElement, section = grid.parentElement, count = $('[data-count]');
    let empty = null, table = null;
    const isTable = () => { try { return sessionStorage.getItem('bl-view') === 'table'; } catch (e) { return false; } };
    const visible = () => cards.filter(c => !c.hidden);
    const buildTable = () => {
      const t = tpl('table'); if (!t) return null;
      const tbody = $('tbody', t), row = $('tr', tbody);
      visible().forEach(c => {
        const r = row.cloneNode(true), td = $$('td', r);
        td[0].textContent = c.dataset.sku; td[1].textContent = c.dataset.name; td[2].textContent = c.dataset.cl;
        const tag = $('span', td[3]); if (tag) { tag.className = c.dataset.stc; tag.textContent = c.dataset.st; }
        r.addEventListener('click', () => { location.href = c.getAttribute('href'); });
        tbody.appendChild(r);
      });
      row.remove();
      return t;
    };
    const apply = () => {
      const q = qInput.value.trim().toLowerCase();
      cards.forEach(c => { c.hidden = !!q && !c.dataset.q.includes(q); });
      const n = visible().length;
      if (count) count.textContent = n;
      if (empty) { empty.remove(); empty = null; }
      if (table) { table.remove(); table = null; }
      if (!n) {
        empty = tpl('noResults');
        if (empty) { const a = $('a', empty); if (a) a.addEventListener('click', e => { e.preventDefault(); qInput.value = ''; apply(); }); section.insertBefore(empty, grid); }
      }
      grid.hidden = !n || isTable();
      if (n && isTable()) { table = buildTable(); if (table) section.insertBefore(table, grid); }
      const url = new URL(location.href); if (q) url.searchParams.set('q', qInput.value.trim()); else url.searchParams.delete('q');
      history.replaceState(null, '', url);
    };
    const pre = new URLSearchParams(location.search).get('q'); if (pre) qInput.value = pre;
    qInput.addEventListener('input', apply);
    const rg = $('input[data-on-change="setGrid"]'), rt = $('input[data-on-change="setTable"]');
    const setView = v => { try { sessionStorage.setItem('bl-view', v); } catch (e) {} if (rg) rg.checked = v === 'grid'; if (rt) rt.checked = v === 'table'; apply(); };
    if (rg) rg.addEventListener('change', () => setView('grid'));
    if (rt) rt.addEventListener('change', () => setView('table'));
    if (isTable() && rt) { rt.checked = true; if (rg) rg.checked = false; }
    if (pre || isTable()) apply();
  }
})();
