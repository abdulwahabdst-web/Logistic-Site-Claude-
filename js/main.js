/* =========================================================
   NOVAFREIGHT — interactions & scroll choreography
   Libraries: GSAP + ScrollTrigger (scrub/pin progress), Lenis (smooth scroll)
   ========================================================= */
(function () {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (u, a, b) => clamp((u - a) / (b - a));
  const RAD = Math.PI / 180;
  const E = {
    io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    in2: (t) => t * t,
    sio: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  };

  const root = document.documentElement;
  root.classList.add('js');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mqMobile = matchMedia('(max-width: 991px)');
  let isMobile = mqMobile.matches;

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------------------------------------------------------
     viewport metrics
     --------------------------------------------------------- */
  let vw = innerWidth, vh = innerHeight, S = 1, SM = 1;
  function measure() {
    vw = document.documentElement.clientWidth || innerWidth;
    vh = innerHeight;
    S = Math.min(vw / 1440, vh / 900);
    SM = Math.min(vw / 390, vh / 844);
    root.style.setProperty('--s', S.toFixed(5));
    root.style.setProperty('--sm', SM.toFixed(5));
  }
  measure();

  /* ---------------------------------------------------------
     smooth scroll
     --------------------------------------------------------- */
  const lenis = new Lenis({ lerp: 0.085, smoothWheel: !reduceMotion, syncTouch: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();

  /* ---------------------------------------------------------
     data
     --------------------------------------------------------- */
  const PLACES = [
    { name: 'UK', lat: 52.6, lon: -1.6 }, { name: 'Germany', lat: 51.1, lon: 10.4 }, { name: 'Spain', lat: 40.2, lon: -3.6 },
    { name: 'Italy', lat: 42.6, lon: 12.6 }, { name: 'Turkey', lat: 39.0, lon: 35.2 }, { name: 'Israel', lat: 31.4, lon: 35.0 },
    { name: 'Egypt', lat: 26.7, lon: 30.6 }, { name: 'Saudi Arabia', lat: 24.0, lon: 45.0 }, { name: 'Qatar', lat: 25.3, lon: 51.2 },
    { name: 'India', lat: 21.5, lon: 78.5 }, { name: 'Kenya', lat: 0.2, lon: 37.9 }, { name: 'South Africa', lat: -29.0, lon: 24.5 },
    { name: 'USA', lat: 39.5, lon: -98.0 }, { name: 'Canada', lat: 56.5, lon: -106.0 }, { name: 'Mexico', lat: 23.6, lon: -102.5 },
    { name: 'Colombia', lat: 4.6, lon: -74.1 }, { name: 'Brazil', lat: -11.5, lon: -51.0 }, { name: 'Argentina', lat: -35.5, lon: -64.5 },
    { name: 'Chile', lat: -31.5, lon: -71.2 }, { name: 'China', lat: 33.0, lon: 104.0 }, { name: 'Japan', lat: 36.4, lon: 138.4 },
    { name: 'Hong Kong', lat: 22.3, lon: 114.2 }, { name: 'Vietnam', lat: 14.6, lon: 108.2 }, { name: 'Thailand', lat: 15.6, lon: 100.9 },
    { name: 'Singapore', lat: 1.35, lon: 103.8 }, { name: 'Australia', lat: -25.6, lon: 134.2 }, { name: 'New Zealand', lat: -41.6, lon: 173.0 },
  ];
  const ROUTES = [
    [[-37.8, 144.9], [1.35, 103.8]], [[-33.9, 151.2], [34.0, -118.2]], [[22.3, 114.2], [51.5, -0.1]],
    [[-37.8, 144.9], [31.2, 121.5]], [[1.35, 103.8], [25.2, 55.3]], [[-27.5, 153.0], [35.7, 139.7]],
    [[51.9, 4.5], [40.7, -74.0]], [[-23.9, -46.3], [-33.9, 18.4]], [[31.2, 121.5], [34.0, -118.2]],
    [[-36.8, 174.8], [-33.9, 151.2]], [[25.2, 55.3], [51.9, 4.5]], [[19.4, -99.1], [4.7, -74.1]],
    [[25.8, -80.2], [-34.6, -58.4]], [[49.3, -123.1], [35.7, 139.7]], [[-34.6, -58.4], [38.7, -9.1]],
    [[19.0, 72.8], [1.35, 103.8]], [[6.5, 3.4], [51.9, 4.5]], [[9.0, -79.5], [34.0, -118.2]],
  ];
  const AIRLINES = [[20, 'Air China'], [23, 'Vietnam Airlines'], [33, 'British Airways'], [32, 'Fiji Airways'], [31, 'Malaysia Airlines'], [30, 'China Southern Airlines'], [29, 'Qatar Airways'], [28, 'China Eastern Airlines'], [27, 'Qantas'], [26, 'Air New Zealand'], [25, 'Etihad Airways'], [24, 'Cathay Pacific'], [22, 'Singapore Airlines'], [21, 'United Airlines'], [19, 'Emirates'], [18, 'Air India'], [16, 'Thai Airways']];
  const SHIPPING = [[17, 'OOCL'], [15, 'Hamburg Süd'], [14, 'ZIM'], [13, 'CMA CGM'], [12, 'Wallenius Wilhelmsen'], [11, 'Sinotrans'], [10, 'NYK Line'], [9, 'K Line'], [8, 'COSCO Shipping'], [7, 'Evergreen Line'], [6, 'Yang Ming'], [5, 'PIL'], [4, 'MSC'], [3, 'HMM'], [2, 'Maersk'], [1, 'APL']];
  const HEADLINES = [
    'Novafreight opens a new cross-dock hub in Singapore',
    'Q4 ocean capacity outlook: what shippers need to know',
    'Our new customer portal is now live for every account',
    'Trusted trader accreditation renewed for 2026',
  ];

  /* ---------------------------------------------------------
     helpers
     --------------------------------------------------------- */
  const tf = (el, t) => { if (el) el.style.transform = t; };
  const op = (el, o) => { if (el) el.style.opacity = o; };
  const vis = (el, on) => { if (el) el.style.visibility = on ? 'visible' : 'hidden'; };

  /* =========================================================
     HERO GLOBE
     ========================================================= */
  const globe = new Globe({
    canvas: $('.globe-canvas'),
    arcCanvas: $('.globe-arcs'),
    labelLayer: $('.globe-labels'),
    landSrc: window.NF_LAND || 'images/globe/land.png',
    places: PLACES,
    routes: ROUTES,
    rows: 168,
    tilt: 0.22,
    speed: 0.055,
    layout: (w, h) => (isMobile
      ? { x: w * 0.78, y: h * 0.4, r: Math.min(w * 0.84, h * 0.42) }
      : { x: w * 0.826, y: h * 0.49, r: Math.min(h * 0.455, w * 0.36) }),
  });
  globe.centerOn(-35);
  if (!globe.gl) {
    // no WebGL: keep the starfield hero but drop the globe overlays
    $('.globe-labels').style.display = 'none';
    $('.globe-arcs').style.display = 'none';
  }

  /* =========================================================
     PRELOADER
     ========================================================= */
  const pre = $('.preloader');
  function preload(srcs) {
    return Promise.all(srcs.map((src) => new Promise((res) => {
      const img = new Image();
      img.onload = img.onerror = res;
      img.src = src;
      if (img.decode) img.decode().then(res, res);
    })));
  }

  function runPreloader() {
    const num = $('.preloader__num');
    const la = $$('.preloader__list--a li'), lb = $$('.preloader__list--b li');
    const pings = $$('.preloader__ping');
    const state = { v: 0 };
    gsap.from('.preloader__map', { opacity: 0, scale: 0.97, duration: 1.4, ease: 'power2.out' });
    gsap.from([...la, ...lb], { opacity: 0, y: 8, duration: 0.6, stagger: 0.03, ease: 'power2.out' });
    gsap.from('.preloader__logo, .preloader__count', { opacity: 0, y: 10, duration: 0.8, ease: 'power2.out' });
    pings.forEach((p, i) => gsap.to(p, { opacity: 1, duration: 0.3, delay: 0.5 + i * 0.22, yoyo: true, repeat: -1, repeatDelay: 0.6, ease: 'steps(2)' }));

    const assets = preload(['images/globe/land.png', 'images/hero/stars.avif', 'images/hero/atmosphere.webp', 'images/crane/stacker.webp', 'images/truck/truck.avif']);
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    const minTime = new Promise((r) => setTimeout(r, 2300));
    const ready = Promise.race([Promise.all([assets, fonts, minTime]), new Promise((r) => setTimeout(r, 7000))]);

    let done = false;
    const tick = gsap.to(state, {
      v: 92, duration: 2.3, ease: 'power1.inOut',
      onUpdate: () => {
        num.textContent = Math.round(state.v);
        const i = Math.floor(state.v / 11);
        la.forEach((li, k) => li.classList.toggle('is-on', k === i % la.length));
        lb.forEach((li, k) => li.classList.toggle('is-on', k === (i + 3) % lb.length));
      },
    });
    ready.then(() => {
      if (done) return;
      done = true;
      tick.kill();
      gsap.to(state, {
        v: 100, duration: 0.45, ease: 'power2.out', onUpdate: () => { num.textContent = Math.round(state.v); },
        onComplete: exitPreloader,
      });
    });
  }

  function exitPreloader() {
    globe.measureLabels();
    setLogoWidths();
    const tl = gsap.timeline({
      onComplete: () => {
        pre.remove();
        document.body.classList.remove('is-loading');
        lenis.start();
        ScrollTrigger.refresh();
      },
    });
    tl.to('.preloader > *', { opacity: 0, y: -16, duration: 0.5, stagger: 0.04, ease: 'power2.in' })
      .to(pre, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.15')
      .add(heroIntro, '-=0.75');
  }

  function heroIntro() {
    globe.start();
    globe.boost = 2.2;
    gsap.to(globe, { fade: 1, glow: 1, duration: 2.4, ease: 'power2.out' });
    gsap.to(globe, { boost: 0, duration: 3.4, ease: 'power3.out' });
    gsap.to(globe, { labelAlpha: 1, duration: 1.2, delay: 1.8 });
    gsap.fromTo('.hero__stars', { scale: 1.12, opacity: 0 }, { scale: 1, opacity: 0.85, duration: 2.6, ease: 'power2.out' });
    gsap.fromTo('.hero__eyebrow .line > span, .hero__title .line > span', { yPercent: 108 }, { yPercent: 0, duration: 1.4, stagger: 0.09, ease: 'expo.out', delay: 0.25 });
    gsap.fromTo('.hero__text, .hero__btns', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.12, delay: 0.7, ease: 'power3.out' });
    gsap.fromTo('.topbar, .header__row', { opacity: 0, y: -18 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.08, delay: 0.35, ease: 'power3.out', clearProps: 'transform,opacity' });
  }

  /* =========================================================
     HEADER / MENU / LOGO / TICKER
     ========================================================= */
  const header = $('.header');
  const logoParts = $$('.logo__c');
  function setLogoWidths() {
    logoParts.forEach((el) => {
      el.dataset.w = el.firstElementChild.getBoundingClientRect().width;
      if (!header.classList.contains('is-compact') && !isMobile) gsap.set(el, { width: +el.dataset.w });
    });
  }
  function logoCollapse(collapse) {
    if (isMobile) return;
    logoParts.forEach((el) => gsap.to(el, { width: collapse ? 0 : +el.dataset.w || 'auto', opacity: collapse ? 0 : 1, duration: 0.9, ease: 'expo.inOut', overwrite: true }));
  }

  let compact = null, hidden = false, menuOpen = false, headerTheme = 'dark';
  function updateHeader(y, dir) {
    const c = y > 60 || isMobile;
    if (c !== compact) {
      compact = c;
      header.classList.toggle('is-compact', c);
      logoCollapse(c);
    }
    let h = hidden;
    if (y < 140 || menuOpen) h = false;
    else if (dir > 0) h = true;
    else if (dir < 0) h = false;
    if (h !== hidden) { hidden = h; header.classList.toggle('is-hidden', h); }
    header.classList.toggle('is-scrolled', y > 140);
  }

  const themed = () => $$('main [data-theme], footer[data-theme], .mcrane[data-theme], .mservices[data-theme]');
  let themeEls = [];
  let mTheme = 'light', oceanP = 0;
  function updateTheme() {
    const y = 46;
    let theme = headerTheme;
    for (const el of themeEls) {
      const r = el.getBoundingClientRect();
      if (r.height === 0) continue;
      if (r.top <= y && r.bottom > y) {
        theme = el.dataset.theme;
        if (el.classList.contains('hero')) {
          const a = $('.hero__atmos').getBoundingClientRect();
          if (a.top + a.height * 0.58 < y) theme = 'light';
        } else if (el.classList.contains('insights')) {
          const hz = $('.insights__horizon').getBoundingClientRect();
          if (hz.top + hz.height * 0.55 > y) theme = 'light';
        } else if (el.classList.contains('ocean')) {
          if (oceanP > 0.97) theme = 'light';
        } else if (el.classList.contains('mcrane')) {
          theme = mTheme;
        }
        break;
      }
    }
    if (theme !== headerTheme) { headerTheme = theme; header.dataset.theme = theme; }
  }

  const menu = $('.menu'), menuBtn = $('.menu-btn');
  function openMenu() {
    menuOpen = true;
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    menuBtn.setAttribute('aria-expanded', 'true');
    lenis.stop();
  }
  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
    lenis.start();
  }
  menuBtn.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  $('.menu__close').addEventListener('click', closeMenu);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  // in-page anchors (mobile has its own services scene)
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    let t = $(id);
    if (t && t.offsetParent === null && id === '#services') t = $('.mjourney');
    if (!t) return;
    e.preventDefault();
    closeMenu();
    lenis.scrollTo(t, { duration: 1.8, offset: id === '#top' ? 0 : 0 });
  }));

  // news ticker with a scramble swap
  (function ticker() {
    const el = $('[data-ticker]');
    if (!el) return;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/-:';
    let i = 0;
    const swap = () => {
      i = (i + 1) % HEADLINES.length;
      const target = HEADLINES[i].toUpperCase();
      const from = el.textContent.toUpperCase();
      const len = Math.max(from.length, target.length);
      const o = { p: 0 };
      gsap.to(o, {
        p: 1, duration: 1.1, ease: 'none',
        onUpdate: () => {
          let out = '';
          for (let k = 0; k < len; k++) {
            const t = k / len;
            if (t < o.p - 0.15) out += target[k] || '';
            else if (t < o.p) out += chars[(Math.random() * chars.length) | 0];
            else out += from[k] || '';
          }
          el.textContent = out;
        },
        onComplete: () => { el.textContent = target; },
      });
    };
    el.textContent = HEADLINES[0].toUpperCase();
    setInterval(swap, 5200);
  })();

  /* =========================================================
     CUSTOM CURSOR
     ========================================================= */
  if (finePointer) {
    root.classList.add('has-cursor');
    const cur = $('.cursor'), ring = $('.cursor__ring'), dot = $('.cursor__dot'), prog = $('.cursor__progress');
    const C = 2 * Math.PI * 26;
    prog.style.strokeDasharray = C.toFixed(2);
    let mx = -100, my = -100, rx = -100, ry = -100, seen = false;
    addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      if (!seen) { seen = true; rx = mx; ry = my; cur.style.opacity = ''; }
    }, { passive: true });
    document.addEventListener('mouseleave', () => { seen = false; cur.style.opacity = '0'; });
    document.addEventListener('mouseover', (e) => {
      cur.classList.toggle('is-hover', !!e.target.closest('a, button, summary, [data-hover], .pcell'));
    });
    addEventListener('mousedown', () => cur.classList.add('is-down'));
    addEventListener('mouseup', () => cur.classList.remove('is-down'));
    gsap.ticker.add(() => {
      rx += (mx - rx) * 0.2;
      ry += (my - ry) * 0.2;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      prog.style.strokeDashoffset = (C * (1 - (lenis.progress || 0))).toFixed(2);
    });
  }

  /* =========================================================
     GENERIC REVEALS / COUNTERS
     ========================================================= */
  function setupReveals() {
    $$('.reveal-lines').forEach((el) => {
      const spans = $$('.line > span', el);
      gsap.set(spans, { yPercent: 106, y: 0 });
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: () => gsap.to(spans, { yPercent: 0, y: 0, duration: 1.25, stagger: 0.085, ease: 'expo.out' }),
      });
    });
    $$('.reveal-up').forEach((el) => {
      gsap.set(el, { opacity: 0, y: 40 });
      ScrollTrigger.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 1.15, ease: 'power3.out' }),
      });
    });
    $$('[data-count]').forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const dec = +(el.dataset.decimals || 0);
      const comma = el.dataset.format === 'comma';
      const fmt = (v) => (comma ? Math.round(v).toLocaleString('en-US') : v.toFixed(dec));
      el.textContent = fmt(0);
      const o = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: () => gsap.to(o, { v: target, duration: 2.4, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(o.v); } }),
      });
    });
    gsap.set('.hero__eyebrow .line > span, .hero__title .line > span', { yPercent: 108, y: 0 });
    gsap.set('.hero__text, .hero__btns', { opacity: 0 });
  }

  /* =========================================================
     HERO SCROLL
     ========================================================= */
  function setupHero() {
    gsap.to('.hero__content', {
      y: -110, opacity: 0, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: () => '+=' + vh * 0.42, scrub: true },
    });
    gsap.to('.hero__space', {
      yPercent: -6, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
    gsap.to(['.globe-canvas', '.globe-arcs', '.globe-labels'], {
      y: () => vh * 0.1, scale: 1.05, transformOrigin: '80% 50%', ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
    ScrollTrigger.create({
      trigger: '.hero', start: 'top bottom', end: () => 'bottom ' + vh * 0.35,
      onToggle: (st) => { if (st.isActive) { if (!pre.isConnected) globe.start(); } else globe.stop(); },
    });
  }

  /* =========================================================
     INTRO THUMBNAIL (mini ocean)
     ========================================================= */
  const thumbCanvas = $('.intro__ocean');
  const thumbOcean = new Ocean({ canvas: thumbCanvas, quality: Math.min(window.devicePixelRatio || 1, 2) });
  thumbOcean.zoom = 1.7;
  thumbOcean.flow = 26;
  function placeThumbShip() {
    const w = thumbCanvas.clientWidth, h = thumbCanvas.clientHeight;
    const shipW = w * 0.09, shipL = shipW * (3579 / 731);
    thumbOcean.setShip(w / 2, h / 2, shipW * 0.45, shipL * 0.49);
    thumbOcean.render();
  }
  ScrollTrigger.create({
    trigger: '.intro__thumb', start: 'top bottom', end: 'bottom top',
    onToggle: (st) => (st.isActive ? thumbOcean.start() : thumbOcean.stop()),
  });

  /* =========================================================
     DESKTOP JOURNEY  (crane -> truck -> services -> road)
     scene is authored on a 1440 x 900 stage, scaled with --s
     ========================================================= */
  const PH = { A1: 1.4, B1: 1.8, C1: 2.5, D1: 3.6, E1: 4.1, F1: 4.5, G1: 5.3, H1: 8.6, I1: 9.3, J1: 10.5 };
  const J_LEN = PH.J1;
  const J = {
    el: $('.journey'),
    stacker: $('.j-stacker'), front: $('.j-stackerfront'), spreader: $('.j-spreader'),
    box: $('.j-box'), boxSpreader: $('.j-box__spreader'), boxTop: $('.j-box__top'), truckTop: $('.truck3d__top'),
    blue: $('.j-crate--blue'), orange: $('.j-crate--orange'),
    truck: $('.j-truck'), truck3d: $('.truck3d'), tbox: $('.t-box'), wheels: $$('.t-wheel'),
    ground: $('.j-ground'), lanes: $$('.j-lanes'), big: $('.j-bigtext'),
    track: $('.j-track'), cards: $$('.svc'), allBtn: $('.j-allbtn'),
    world: $('.j-world'), road: $('.j-road'),
  };
  let bigW = 2600;

  // road geometry (world space == stage space at zoom 1)
  const ROAD = { yh: 190, R: 220, cx: 720, x0: -3000, endY: 540 };
  ROAD.L1 = ROAD.cx - ROAD.R - 0;                 // straight: x 0 -> 500
  ROAD.L2 = ROAD.R * Math.PI / 2;                 // arc
  ROAD.L3 = ROAD.endY - (ROAD.yh + ROAD.R);       // vertical to the truck's resting point
  ROAD.L = ROAD.L1 + ROAD.L2 + ROAD.L3;
  function roadPoint(s) {
    const { yh, R, cx } = ROAD;
    if (s <= ROAD.L1) return { x: s, y: yh, a: 0 };
    if (s <= ROAD.L1 + ROAD.L2) {
      const phi = -Math.PI / 2 + (s - ROAD.L1) / R;
      return { x: cx - R + R * Math.cos(phi), y: yh + R + R * Math.sin(phi), a: (phi + Math.PI / 2) / RAD };
    }
    return { x: cx, y: yh + R + (s - ROAD.L1 - ROAD.L2), a: 90 };
  }
  function buildRoad() {
    const { yh, R, cx, x0 } = ROAD;
    const yC = yh + R;
    const path = (d) => `M ${x0} ${yh + d} H ${cx - R} A ${R - d} ${R - d} 0 0 1 ${cx - d} ${yC} V 3600`;
    const ns = 'http://www.w3.org/2000/svg';
    const add = (tag, attrs) => { const n = document.createElementNS(ns, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); J.road.appendChild(n); return n; };
    J.road.setAttribute('width', '1440');
    J.road.setAttribute('height', '900');
    J.road.setAttribute('viewBox', '0 0 1440 900');
    // right-hand branch of the junction
    add('path', { d: `M ${cx} ${yC} H 4600`, stroke: '#101010', 'stroke-width': 200, fill: 'none' });
    add('path', { d: path(0), stroke: '#101010', 'stroke-width': 200, fill: 'none' });
    [-84, 84].forEach((d) => add('path', { d: path(d), stroke: '#1d1d1d', 'stroke-width': 2, fill: 'none', 'vector-effect': 'non-scaling-stroke' }));
    [-84, 84].forEach((d) => add('path', { d: `M ${cx + 100} ${yC + d} H 4600`, stroke: '#1d1d1d', 'stroke-width': 2, fill: 'none', 'vector-effect': 'non-scaling-stroke' }));
    // gore hatching where the branch meets the bend
    const g = add('g', { stroke: '#262626', 'stroke-width': 1.2, fill: 'none', 'vector-effect': 'non-scaling-stroke' });
    for (let i = 0; i < 6; i++) {
      const l = document.createElementNS(ns, 'path');
      l.setAttribute('d', `M ${cx + 6 + i * 13} ${yC + 92} l 18 -26 l 18 26`);
      l.setAttribute('vector-effect', 'non-scaling-stroke');
      g.appendChild(l);
    }
    J.lanePaths = [-33.33, 33.33].map((d) => add('path', { d: path(d), stroke: '#2a2a2a', 'stroke-width': 3.7, fill: 'none', 'stroke-dasharray': '29.63 64.81' }));
    [-33.33, 33.33].forEach((d) => add('path', { d: `M ${cx + 100} ${yC + d} H 4600`, stroke: '#2a2a2a', 'stroke-width': 3.7, fill: 'none', 'stroke-dasharray': '29.63 64.81' }));
  }
  buildRoad();

  function sizeJourney() {
    J.el.style.height = Math.round((J_LEN + 1) * vh) + 'px';
    bigW = J.big.offsetWidth || bigW;
  }

  let journeyU = 0;
  function renderJourney(p) {
    const u = p * J_LEN;
    journeyU = u;
    const kA = E.io(seg(u, 0, PH.A1));
    const kB = E.io(seg(u, PH.A1, PH.B1));
    const kC = E.io(seg(u, PH.B1, PH.C1));
    const dSpan = PH.D1 - PH.C1;
    const kD = E.io(seg(u, PH.C1, PH.D1));
    const kE = E.io(seg(u, PH.D1, PH.E1));
    const kF = seg(u, PH.E1, PH.F1);
    const kG = E.io(seg(u, PH.F1, PH.G1));
    const kI = E.io(seg(u, PH.H1, PH.I1));

    /* reach stacker */
    const sx = lerp(lerp(150, 521.5, kA), 380, kC);
    tf(J.stacker, `translate3d(${sx}px, 367.8px, 0)`);
    op(J.stacker, 1 - seg(u, PH.C1, PH.C1 + dSpan * 0.5));

    /* remaining containers slide away */
    const kOut = E.in2(seg(u, PH.B1 + 0.1, PH.C1 + 0.25));
    [J.blue, J.orange].forEach((el, i) => {
      tf(el, `translate3d(${(i ? 1049 : 905) + 760 * kOut}px, 654.2px, 0)`);
      el.style.filter = kOut > 0.01 ? `blur(${(kOut * 14).toFixed(1)}px)` : '';
      op(el, 1 - seg(kOut, 0.55, 1));
    });

    /* container (3D box) */
    let bx = 905, by = 491.4;
    if (u >= PH.A1) { bx = sx + 383.5; by = 491.4 - 38 * kB; }
    let cx = lerp(bx + 70, 704, kD);
    let cy = lerp(by + 81.4, 596, kD);
    cy = lerp(cy, 666.2, kE);
    const zoff = lerp(-396, -70, kD);
    tf(J.box, `translate3d(${cx - 70}px, ${cy - 81.4}px, ${zoff}px) rotateY(${-90 * kD}deg)`);
    vis(J.box, u < PH.E1);
    op(J.boxSpreader, seg(u, PH.C1 + dSpan * 0.3, PH.C1 + dSpan * 0.65));
    op(J.boxTop, Math.sin(Math.PI * kD).toFixed(3));

    /* spreader lifting away after release */
    const kS = E.in2(seg(u, PH.E1, PH.F1 + 0.3));
    tf(J.spreader, `translate3d(${308 - 460 * kS}px, ${498.4 - 360 * kS}px, 0)`);
    op(J.spreader, u >= PH.E1 ? 1 - seg(kS, 0.4, 1) : 0);

    /* stacker, seen from the front */
    op(J.front, seg(u, PH.C1 + dSpan * 0.45, PH.D1) * (1 - seg(u, PH.E1, PH.F1)));
    tf(J.front, `translate3d(634.2px, ${603.3 + 70 * E.in2(kF)}px, 0)`);

    /* ground */
    let gTop = lerp(817, 360, kG);
    let gH = 2400;
    gTop = lerp(gTop, 180, kI);
    gH = lerp(2400, 540, kI);
    tf(J.ground, `translate3d(0, ${gTop}px, 0)`);
    J.ground.style.height = gH.toFixed(1) + 'px';
    J.ground.classList.toggle('is-road', kI > 0.55);
    const laneDrive = -760 * seg(u, PH.H1, PH.I1);
    J.lanes.forEach((l, i) => {
      l.style.top = (gH * (i ? 2 / 3 : 1 / 3) - 5).toFixed(1) + 'px';
      l.style.opacity = kI;
      l.style.backgroundPosition = `${laneDrive.toFixed(1)}px 0`;
    });

    /* giant "OUR SERVICES" */
    const kBig = seg(u, PH.F1 + 0.3, PH.H1 - 0.15);
    tf(J.big, `translate3d(${lerp(1480, -bigW - 160, kBig)}px, 0, 0)`);

    /* services track */
    const kTr = seg(u, PH.G1 - 0.35, PH.H1);
    const trX = lerp(1460, -2890, kTr);
    const trFade = seg(u, PH.H1, PH.H1 + 0.45);
    tf(J.track, `translate3d(${trX}px, ${gTop - 360 + 90 * trFade}px, 0)`);
    op(J.track, 1 - trFade);
    J.cards.forEach((c, i) => c.classList.toggle('is-in', trX + 1790 + 350 * i < 1150));
    const btnOn = u > PH.G1 - 0.15 && u < PH.H1 - 0.05;
    if (btnOn !== J.btnOn) {
      J.btnOn = btnOn;
      gsap.to(J.allBtn, { autoAlpha: btnOn ? 1 : 0, y: btnOn ? 0 : 20, duration: 0.5, ease: 'power2.out', overwrite: true });
    }

    /* truck */
    const kT = E.out(seg(u, PH.C1 + dSpan * 0.3, PH.D1 + 0.15));
    let tx = lerp(1600, 305, kT);
    let sc = lerp(1.014, 0.6, kG);
    let bottom = lerp(817, 360, kG);
    tx = lerp(tx, 190, kG) + 150 * E.sio(seg(u, PH.G1, PH.H1));
    let tcx = tx + 500 * sc, tcy = bottom - 115.25 * sc;
    let rz = 0;
    const rx = -90 * kI;
    tcx = lerp(tcx, 600, kI);
    tcy = lerp(tcy, 450, kI);
    sc = lerp(sc, 0.621, kI);

    /* junction: camera zooms out while the truck follows the bend */
    if (u > PH.I1) {
      const kJ = seg(u, PH.I1, PH.J1);
      const e = E.io(kJ);
      const z = lerp(2.7, 1, e);
      const P = roadPoint(lerp(0, ROAD.L, E.sio(kJ)));
      const Sx = lerp(600, 720, e), Sy = lerp(450, 540, e);
      tf(J.world, `translate3d(${Sx - z * P.x}px, ${Sy - z * P.y}px, 0) scale(${z})`);
      tcx = Sx; tcy = Sy; sc = 0.23 * z; rz = P.a;
      op(J.world, 1);
      op(J.ground, 0);
      // align world lane dashes with the ground's dashes at hand-over
      const D = ((((-4500 - laneDrive) / 2.7) % 94.444) + 94.444) % 94.444;
      if (J.dashD !== D) { J.dashD = D; J.lanePaths.forEach((pth) => pth.setAttribute('stroke-dashoffset', D.toFixed(2))); }
    } else {
      op(J.world, 0);
      op(J.ground, 1);
    }
    tf(J.truck, `translate3d(${tcx}px, ${tcy}px, 0) rotate(${rz}deg) scale(${sc}) translate(-500px, -115.25px)`);
    const a = -rx * RAD;
    tf(J.truck3d, `translateZ(${-(96.5 * Math.cos(a) + 115.25 * Math.sin(a))}px) rotateX(${rx}deg)`);
    op(J.tbox, u >= PH.E1 ? 1 : 0);
    op(J.truckTop, kI.toFixed(3));

    /* wheels */
    const drive = -(1600 - lerp(1600, 305, kT)) + (1460 - trX) * 0.55;
    const ang = (drive / 28.9) / RAD;
    J.wheels.forEach((w) => { w.style.transform = `rotate(${ang.toFixed(1)}deg)`; });
  }

  /* =========================================================
     MOBILE JOURNEY
     ========================================================= */
  const MP = { A1: 1.0, B1: 1.3, C1: 1.8, D1: 2.4, E1: 3.5, F1: 4.2 };
  const M = {
    el: $('.mjourney'), crane: $('.mcrane'), stage: $('.mstage'), side: $('.m-side'),
    stacker: $('.m-stacker:not(.m-stacker--loaded)'), white: $('.m-crate--white'), blue: $('.m-crate--blue'), orange: $('.m-crate--orange'),
    big: $('.m-bigtext'), top: $('.m-top'), topTruck: $('.m-toptruck'), topTruckBox: $('.m-toptruck__box'),
    topCrane: $('.m-topcrane'), topCraneBox: $('.m-topcrane__box'), roadTruck: $('.m-roadtruck'),
    services: $('.mservices'), tail: $('.mservices__tail'),
  };
  function renderMCrane(p) {
    const u = p * MP.F1;
    const kA = E.io(seg(u, 0, MP.A1));
    const kB = E.io(seg(u, MP.A1, MP.B1));
    const kC = E.io(seg(u, MP.B1, MP.C1));
    const kD = E.io(seg(u, MP.C1, MP.D1));
    const sx = lerp(lerp(270, 86, kA), 150, kC);
    tf(M.stacker, `translate3d(${sx}px, 109.7px, 0)`);
    if (u < MP.A1) tf(M.white, 'translate3d(86px, 167.4px, 0)');
    else tf(M.white, `translate3d(${sx}px, ${167.4 - 15.6 * kB}px, 0)`);
    tf(M.big, `translate3d(${-300 * p}px, 0, 0)`);
    const kO = E.in2(seg(u, MP.B1, MP.C1 + 0.2));
    tf(M.blue, `translate3d(${86 - 260 * kO}px, 248.7px, 0)`);
    tf(M.orange, `translate3d(${14 - 260 * kO}px, 248.7px, 0)`);
    tf(M.side, `translate3d(0, ${(-900 * kD).toFixed(1)}px, 0)`);
    op(M.side, 1);
    op(M.top, seg(kD, 0.25, 1).toFixed(3));
    tf(M.top, `translate3d(0, ${(520 * (1 - kD)).toFixed(1)}px, 0)`);
    mTheme = kD > 0.5 ? 'dark' : 'light';
    // top-down placement
    const kIn = E.out(seg(u, MP.D1 - 0.25, MP.D1 + 0.45));
    const kLow = E.io(seg(u, MP.D1 + 0.45, MP.D1 + 0.75));
    const kAway = E.in2(seg(u, MP.D1 + 0.85, MP.E1));
    const cxm = 30.4 + 180 * (1 - kIn) + 340 * kAway;
    tf(M.topCrane, `translate3d(${1000 + cxm}px, ${1313}px, 0) scale(${lerp(1.12, 1, kLow)})`);
    const placed = u > MP.D1 + 0.75;
    op(M.topCraneBox, placed ? 0 : 1);
    op(M.topTruckBox, placed ? 1 : 0);
  }
  function placeRoadTruck(q) {
    // q: 0 = parked at the left edge, 1 = centred & smaller (ocean hand-over)
    const x0 = (vw - 390 * SM) / 2 + 24 * SM;
    const y0 = (vh - 844 * SM) / 2 + 314 * SM;
    const k = E.io(q);
    const scl = SM * lerp(1, 0.62, k);
    const x = lerp(x0, vw / 2 - 26 * scl, k);
    const y = lerp(y0, vh / 2 - 108.5 * scl, k);
    tf(M.roadTruck, `translate3d(${x}px, ${y}px, 0) scale(${scl})`);
  }

  /* =========================================================
     OCEAN
     ========================================================= */
  const O = {
    el: $('.ocean'), pin: $('.ocean__pin'), wrap: $('.ocean__shipwrap'), haze: $('.ocean__haze'),
    clouds: $$('.cloud'), wipe: $('.ocean__wipe'), title: $('.ocean__title'), canvas: $('.ocean__canvas'),
  };
  const ocean = new Ocean({ canvas: O.canvas, quality: isMobile ? 0.55 : 0.72 });
  ocean.flow = 70;
  const CLOUDS = [
    { el: 0, w: 0.75, from: [-0.18, 0.06], to: [-0.95, 0.12], flip: false },
    { el: 1, w: 0.75, from: [0.18, -0.06], to: [0.98, -0.2], flip: false },
    { el: 2, w: 0.9, from: [0.02, 0.2], to: [0.08, 1.0], flip: false },
    { el: 3, w: 0.55, from: [-0.12, -0.2], to: [-0.7, -0.95], flip: false },
    { el: 4, w: 0.6, from: [0.14, -0.16], to: [0.8, -0.85], flip: true },
  ];
  function renderOcean(p) {
    oceanP = p;
    const mob = isMobile;
    const W0 = mob ? 776 : 731, L0 = mob ? 3794 : 3579;
    const base = mob ? (vw * 0.66) / W0 : (Math.min(vw, vh * 1.6) * 0.3) / W0;
    const k1 = E.io(seg(p, 0, 0.42));
    const k2 = E.io(seg(p, 0.4, 0.82));
    const sc = base * lerp(1, mob ? 0.42 : 0.36, k1) * lerp(1, 0.28, k2);
    const cy = lerp(vh * (mob ? 0.42 : 0.37), vh * 0.5, k1);
    tf(O.wrap, `translate3d(0, ${(cy - vh / 2).toFixed(1)}px, 0) scale(${sc.toFixed(5)})`);
    ocean.zoom = base / sc;
    ocean.setShip(vw / 2, cy, (W0 / 2) * sc * 0.88, (L0 / 2) * sc * 0.985);
    ocean.wake = 1;

    // clouds / altitude
    const kc = seg(p, 0.62, 0.97);
    op(O.haze, (E.io(seg(p, 0.58, 0.93)) * 0.9).toFixed(3));
    CLOUDS.forEach((c) => {
      const el = O.clouds[c.el];
      if (!el) return;
      const t = E.in2(kc);
      const w = c.w * vw * (mob ? 1.6 : 1);
      const x = lerp(c.from[0], c.to[0], t) * vw;
      const y = lerp(c.from[1], c.to[1], t) * vh;
      const s = lerp(0.45, 2.3, t);
      el.style.width = w + 'px';
      tf(el, `translate3d(${(x - w / 2).toFixed(1)}px, ${(y - w * 0.22).toFixed(1)}px, 0) scale(${s.toFixed(3)}) scaleX(${c.flip ? -1 : 1})`);
      op(el, (seg(kc, 0, 0.25) * (1 - 0.35 * seg(kc, 0.8, 1))).toFixed(3));
    });

    // the plane crosses the last part of the scene, dragging white sky behind it
    planeIn = seg(p, 0.8, 1);
    renderPlane();
  }

  // plane flight (fixed layer): crosses the ocean exit, then leaves over the testimonials
  const plane = $('.plane'), planeImg = $('.plane__img'), planeShadow = $('.plane__shadow');
  let planeIn = 0, planeOut = 0;
  function renderPlane() {
    const q = planeIn, r = planeOut;
    const on = q > 0 && r < 1;
    plane.classList.toggle('is-on', on);
    let cover = 0; // fraction of the frame already wiped to white
    if (isMobile) {
      const s = (lerp(0.22, 0.62, E.in2(q)) + 0.12 * r) * (vw / 390);
      const w = 2221 * s;
      const y = (q < 1 ? lerp(1.35, -0.12, q) : lerp(-0.12, -0.95, r)) * vh;
      cover = clamp(1 - y / vh);
      planeImg.style.width = w + 'px';
      planeShadow.style.width = w + 'px';
      tf(planeImg, `translate3d(${vw / 2 - w / 2}px, ${y - w / 2}px, 0) rotate(-90deg)`);
      tf(planeShadow, `translate3d(${vw / 2 - w / 2 + w * 0.06}px, ${y - w / 2 + w * 0.05}px, 0) rotate(-90deg)`);
      O.wipe.style.clipPath = `inset(${((1 - cover) * 100).toFixed(2)}% 0 0 0)`;
    } else {
      const s = (lerp(0.32, 1.1, E.in2(q)) + 0.25 * r) * (vw / 1440);
      const w = 2221 * s;
      const x = (q < 1 ? lerp(-0.55, 1.15, q) : lerp(1.15, 1.95, r)) * vw;
      const y = vh * 0.5 + lerp(24, -20, q);
      cover = clamp(x / vw);
      planeImg.style.width = w + 'px';
      planeShadow.style.width = w + 'px';
      tf(planeImg, `translate3d(${x - w / 2}px, ${y - w / 2}px, 0)`);
      tf(planeShadow, `translate3d(${x - w / 2 + w * 0.05}px, ${y - w / 2 + w * 0.08}px, 0)`);
      planeShadow.style.opacity = (0.15 + 0.35 * seg(q, 0.3, 0.8)).toFixed(3);
      O.wipe.style.clipPath = `inset(0 ${((1 - cover) * 100).toFixed(2)}% 0 0)`;
    }
  }

  /* =========================================================
     PARTNERS GRID
     ========================================================= */
  function buildPartners() {
    const make = (list, grid) => {
      const total = Math.ceil(list.length / 5) * 5;
      for (let i = 0; i < total; i++) {
        const cell = document.createElement('div');
        cell.className = 'pcell';
        const item = list[i];
        if (item) {
          const n = String(item[0]).padStart(2, '0');
          cell.innerHTML = `<img src="images/partners/logo-${n}.png" alt="${item[1]}" loading="lazy"><img src="images/partners/logo-${n}-hover.png" alt="" aria-hidden="true" loading="lazy">`;
        } else {
          cell.classList.add('is-empty');
        }
        grid.appendChild(cell);
      }
    };
    make(AIRLINES, $('[data-partners="airlines"]'));
    make(SHIPPING, $('[data-partners="shipping"]'));
    $$('.pgrid').forEach((g) => {
      const cells = $$('.pcell', g);
      gsap.set(cells, { opacity: 0 });
      ScrollTrigger.create({
        trigger: g, start: 'top 85%', once: true,
        onEnter: () => gsap.to(cells, { opacity: 1, duration: 0.7, stagger: { each: 0.03, from: 'start' }, ease: 'power2.out' }),
      });
    });
  }

  /* =========================================================
     INSIGHTS
     ========================================================= */
  function setupInsights() {
    const posts = $$('.post');
    const arts = $$('.insights__preview .art');
    posts.forEach((post, i) => {
      post.addEventListener('mouseenter', () => {
        posts.forEach((p) => p.classList.toggle('is-active', p === post));
        arts.forEach((a, k) => a.classList.toggle('is-on', k === i));
      });
    });
    gsap.fromTo('.insights__horizon img', { scale: 1.25, yPercent: 8 }, {
      scale: 1, yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: '.insights__horizon', start: 'top bottom', end: 'bottom 30%', scrub: true },
    });
    gsap.set(posts, { opacity: 0, y: 24 });
    ScrollTrigger.create({
      trigger: '.posts', start: 'top 88%', once: true,
      onEnter: () => gsap.to(posts, { opacity: 1, y: 0, duration: 0.9, stagger: 0.07, ease: 'power3.out' }),
    });
  }

  /* =========================================================
     FAQ (animated <details>)
     ========================================================= */
  function setupFaq() {
    $$('.qa').forEach((d) => {
      const sum = $('summary', d), body = $('.qa__a', d);
      sum.addEventListener('click', (e) => {
        e.preventDefault();
        if (d.open) {
          gsap.fromTo(body, { height: body.offsetHeight }, {
            height: 0, duration: 0.55, ease: 'power3.inOut',
            onComplete: () => { d.open = false; body.style.height = ''; ScrollTrigger.refresh(); },
          });
        } else {
          d.open = true;
          const h = body.scrollHeight;
          gsap.fromTo(body, { height: 0 }, {
            height: h, duration: 0.65, ease: 'power3.out',
            onComplete: () => { body.style.height = ''; ScrollTrigger.refresh(); },
          });
        }
      });
    });
  }

  /* =========================================================
     CTA RINGS
     ========================================================= */
  function setupCta() {
    const rings = $$('.cta__rings i');
    rings.forEach((r, i) => r.style.setProperty('--d', 230 + i * 150 + 'px'));
    if (!reduceMotion) {
      rings.forEach((r, i) => gsap.to(r, { scale: 1.07, opacity: 0.45, duration: 2.6, delay: i * 0.18, repeat: -1, yoyo: true, ease: 'sine.inOut' }));
    }
    gsap.fromTo('.cta__rings', { scale: 0.75 }, {
      scale: 1.12, ease: 'none',
      scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true },
    });
    if (finePointer) {
      const cta = $('.cta');
      cta.addEventListener('mousemove', (e) => {
        const r = cta.getBoundingClientRect();
        gsap.to('.cta__rings', { x: (e.clientX - r.left - r.width / 2) * 0.04, y: (e.clientY - r.top - r.height / 2) * 0.04, duration: 1.2, ease: 'power3.out' });
      });
    }
  }

  /* =========================================================
     FOOTER: tabs + dust field
     ========================================================= */
  function setupFooter() {
    $$('.tabs__btn').forEach((b) => b.addEventListener('click', () => {
      $$('.tabs__btn').forEach((x) => x.classList.toggle('is-active', x === b));
      $$('[data-marquee]').forEach((m) => { m.hidden = m.dataset.marquee !== b.dataset.tab; });
    }));
    // duplicate marquee content for a seamless loop
    $$('.marquee__track').forEach((t) => { t.innerHTML += t.innerHTML; });

    const cv = $('.footer__dust');
    const ctx = cv.getContext('2d');
    let pts = [], W = 0, H = 0, running = false, mouse = { x: -999, y: -999 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const init = () => {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      const n = Math.round((W * H) / (isMobile ? 70 : 45));
      pts = [];
      for (let i = 0; i < n; i++) {
        const y = Math.pow(Math.random(), 1.6) * H;
        const band = Math.exp(-Math.pow((Math.random() * W - W / 2) / (W * 0.45), 2));
        pts.push({ x: Math.random() * W, y, ox: 0, oy: 0, r: Math.random() < 0.15 ? 1.3 : 0.9, a: 0.25 + 0.55 * Math.random() * band, s: Math.random() * 6.28 });
      }
    };
    cv.addEventListener('mousemove', (e) => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    cv.addEventListener('mouseleave', () => { mouse.x = mouse.y = -999; });
    let t = 0;
    const loop = () => {
      if (!running) return;
      t += 0.012;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 6400) { const f = (1 - d2 / 6400) * 2.2; p.ox += (dx / Math.sqrt(d2 + 1)) * f; p.oy += (dy / Math.sqrt(d2 + 1)) * f; }
        p.ox *= 0.94; p.oy *= 0.94;
        const x = p.x + p.ox + Math.sin(t + p.s) * 1.5, y = p.y + p.oy + Math.cos(t * 0.8 + p.s) * 1.2;
        ctx.fillStyle = `rgba(70,70,70,${p.a})`;
        ctx.fillRect(x, y, p.r, p.r);
      }
      requestAnimationFrame(loop);
    };
    init();
    ScrollTrigger.create({
      trigger: cv, start: 'top bottom', end: 'bottom top',
      onToggle: (st) => { running = st.isActive && !reduceMotion; if (running) loop(); },
    });
    addEventListener('resize', () => { clearTimeout(cv._t); cv._t = setTimeout(init, 200); });
  }

  /* =========================================================
     SCROLL-SCENE TRIGGERS
     ========================================================= */
  const speedEl = $('.j-speed');
  const speedNum = $('.j-speed span');
  let speedVal = 0;
  const whyTruck = $('.why__truck');

  function setupScenes() {
    // desktop journey
    ScrollTrigger.create({
      trigger: J.el, start: 'top top', end: 'bottom bottom',
      onUpdate: (st) => renderJourney(st.progress),
      onRefresh: (st) => renderJourney(st.progress),
    });
    // hand the truck over to the fixed "why" truck once the journey pin releases
    ScrollTrigger.create({
      trigger: '.why', start: 'top bottom', end: 'bottom top',
      onToggle: (st) => { whyTruck.classList.toggle('is-on', st.isActive); vis(J.truck, !st.isActive); },
    });
    // mobile journey
    ScrollTrigger.create({
      trigger: M.crane, start: 'top top', end: 'bottom bottom',
      onUpdate: (st) => renderMCrane(st.progress),
      onRefresh: (st) => renderMCrane(st.progress),
    });
    ScrollTrigger.create({
      trigger: M.services, start: 'top bottom', end: 'bottom top',
      onToggle: (st) => { M.roadTruck.classList.toggle('is-on', st.isActive); vis(M.topTruck, !st.isActive); },
    });
    ScrollTrigger.create({
      trigger: M.tail, start: 'top bottom', end: 'bottom bottom',
      onUpdate: (st) => placeRoadTruck(st.progress),
      onRefresh: (st) => placeRoadTruck(st.progress),
    });

    // ocean
    ScrollTrigger.create({
      trigger: O.el, start: 'top top', end: 'bottom bottom',
      onUpdate: (st) => renderOcean(st.progress),
      onRefresh: (st) => renderOcean(st.progress),
    });
    ScrollTrigger.create({
      trigger: O.el, start: 'top bottom', end: 'bottom top',
      onToggle: (st) => (st.isActive ? ocean.start() : ocean.stop()),
    });
    // plane exit: after the ocean scene releases it keeps flying over the testimonials
    ScrollTrigger.create({
      trigger: O.el, start: 'bottom bottom', end: () => '+=' + Math.round(vh * 0.75),
      onUpdate: (st) => { planeOut = st.progress; renderPlane(); },
      onLeave: () => { planeOut = 1; renderPlane(); },
      onLeaveBack: () => { planeOut = 0; renderPlane(); },
    });

    // speed read-out while the truck is on screen
    ScrollTrigger.create({
      trigger: isMobile ? M.el : J.el,
      start: () => (isMobile ? 'top top' : 'top+=' + Math.round(vh * PH.E1) + ' top'),
      endTrigger: isMobile ? M.services : '.why',
      end: 'bottom 40%',
      onToggle: (st) => speedEl.classList.toggle('is-on', st.isActive),
    });
  }

  gsap.ticker.add(() => {
    const v = Math.abs(lenis.velocity || 0);
    speedVal += (Math.min(99, v * 1.6) - speedVal) * 0.08;
    const s = String(Math.round(speedVal)).padStart(2, '0');
    if (speedNum.textContent !== s) speedNum.textContent = s;
  });

  /* =========================================================
     RESIZE
     ========================================================= */
  function layout() {
    measure();
    sizeJourney();
    globe.resize();
    ocean.resize();
    thumbOcean.resize();
    placeThumbShip();
  }

  let rT, lastW = innerWidth, lastH = innerHeight;
  const coarse = matchMedia('(pointer: coarse)').matches;
  addEventListener('resize', () => {
    // mobile browsers resize the viewport while the URL bar collapses: ignore those
    if (coarse && innerWidth === lastW && Math.abs(innerHeight - lastH) < 180) return;
    lastW = innerWidth; lastH = innerHeight;
    clearTimeout(rT);
    rT = setTimeout(() => {
      const wasMobile = isMobile;
      isMobile = mqMobile.matches;
      layout();
      if (wasMobile !== isMobile) { compact = null; setLogoWidths(); }
      updateHeader(lenis.scroll, 0);
      ScrollTrigger.refresh();
    }, 160);
  });

  lenis.on('scroll', ({ scroll, direction }) => {
    updateHeader(scroll, direction);
    updateTheme();
  });

  /* =========================================================
     BOOT
     ========================================================= */
  layout();
  themeEls = themed();
  setupReveals();
  buildPartners();
  setupHero();
  setupScenes();
  setupInsights();
  setupFaq();
  setupCta();
  setupFooter();
  renderJourney(0);
  renderMCrane(0);
  placeRoadTruck(0);
  renderOcean(0);
  updateHeader(0, 0);
  updateTheme();
  runPreloader();

  // expose for debugging
  window.__nf = { lenis, globe, ocean, renderJourney, renderOcean };
})();
