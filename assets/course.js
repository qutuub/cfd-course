/* CFD course — shared runtime. No network: KaTeX and fonts load from assets/.
   Motion rules (from the anatomy skill, trimmed): dt from rAF clamped to 1/30 s; inputs set a
   target that the figure eases toward; an idle tour plays after 1.4 s untouched, pauses on
   hover/focus/press and resumes 3.6 s after the last input; off-screen figures stop; device
   pixel ratio capped at 1.5; reduced motion draws one still frame and still answers input. */
(function () {
  'use strict';
  const C = (window.Course = {});
  const root = document.documentElement;
  C.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  C.css = (n) => getComputedStyle(root).getPropertyValue(n).trim();
  C.clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  C.lerp = (a, b, t) => a + (b - a) * t;
  /* exponential ease toward a target: x += (target - x)(1 - e^(-dt/tau)) */
  C.ease = (x, target, dt, tau = 0.2) => {
    const y = x + (target - x) * (1 - Math.exp(-dt / tau));
    return Math.abs(target - y) < 1e-6 * (1 + Math.abs(target)) ? target : y;
  };
  /* "9.13 × 10⁻⁷" */
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  C.sci = (x, d = 3) => {
    if (x === 0) return '0';
    const e = Math.floor(Math.log10(Math.abs(x)));
    if (e >= -2 && e <= 3) return (+x.toPrecision(d)).toString();
    const m = x / Math.pow(10, e);
    return m.toFixed(d - 1) + ' × 10' + String(e).replace(/./g, (ch) => SUP[ch]);
  };
  /* seeded random numbers in [0,1) (mulberry32): figures look the same on every load */
  C.rng = (seed) => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  C.say = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };

  /* SVG helper: C.svg('line', {x1:..}, parent) — attrs object is required, parent optional */
  const NS = 'http://www.w3.org/2000/svg';
  C.svg = (tag, attrs, parent) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs || {}) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };

  /* ---------- theme toggle: auto → light → dark ---------- */
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  const saved = store('cfd-theme');
  if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  C.onTheme = [];
  function initTheme() {
    const b = document.querySelector('.themebtn'); if (!b) return;
    const label = () => { b.textContent = 'Theme: ' + (root.getAttribute('data-theme') || 'auto'); };
    label();
    b.addEventListener('click', () => {
      const cur = root.getAttribute('data-theme');
      const nx = cur === null ? 'light' : cur === 'light' ? 'dark' : null;
      if (nx) root.setAttribute('data-theme', nx); else root.removeAttribute('data-theme');
      store('cfd-theme', nx || 'auto'); label();
      C.onTheme.forEach((f) => f());
    });
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => C.onTheme.forEach((f) => f()));

  /* ---------- sticky tabs ---------- */
  function initTabs() {
    const tabs = Array.from(document.querySelectorAll('#tabs a'));
    if (!tabs.length) return;
    const secs = tabs.map((a) => document.querySelector(a.getAttribute('href')));
    tabs.forEach((a, i) => a.addEventListener('click', (e) => {
      e.preventDefault();
      secs[i].scrollIntoView({ behavior: C.reduce ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', a.getAttribute('href'));
    }));
    function mark() {
      const nb = document.querySelector('nav.tabs'), off = (nb ? nb.offsetHeight : 48) + 40;
      let cur = 0;
      secs.forEach((el, i) => { if (el && el.getBoundingClientRect().top <= off) cur = i; });
      tabs.forEach((a, i) => {
        if (i === cur) {
          a.setAttribute('aria-current', 'true');
          const box = a.parentElement;
          if (a.offsetLeft < box.scrollLeft || a.offsetLeft + a.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = a.offsetLeft - 16;
        } else a.removeAttribute('aria-current');
      });
    }
    addEventListener('scroll', mark, { passive: true });
    addEventListener('resize', mark);
    mark();
  }

  /* ---------- KaTeX: \( \) inline, \[ \] display; \htmlClass allowed for term colours ---------- */
  function initMath() {
    if (!window.renderMathInElement) return;
    renderMathInElement(document.body, {
      delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
      trust: (ctx) => ctx.command === '\\htmlClass',
      strict: false, throwOnError: false,
    });
  }

  /* ---------- term spotlight: chips with data-term toggle .on in a linked .eq ---------- */
  function initSpot() {
    document.querySelectorAll('.chips[data-eq]').forEach((box) => {
      const eqs = box.getAttribute('data-eq').split(' ').map((id) => document.getElementById(id)).filter(Boolean);
      const chips = Array.from(box.querySelectorAll('.chip'));
      function apply(term) {
        chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.term === term)));
        eqs.forEach((eq) => {
          eq.classList.toggle('spot', !!term);
          eq.querySelectorAll('[class*="tm-"]').forEach((el) => el.classList.toggle('on', !!term && el.classList.contains('tm-' + term)));
        });
        box.dispatchEvent(new CustomEvent('term', { detail: term }));
      }
      chips.forEach((c) => c.addEventListener('click', () => apply(c.getAttribute('aria-pressed') === 'true' ? null : c.dataset.term)));
      box._apply = apply;
    });
  }

  /* ---------- animated canvas figure ----------
     C.anim(canvas, {height, draw(g, w, h, t, dt), settled?() }) → {kick(), redraw()}
     - DPR capped at 1.5; the authored height is fixed (no doubling on resize)
     - runs only while on screen; reduced motion → one frame per kick */
  C.anim = function (cv, opt) {
    const g = cv.getContext('2d');
    const H = opt.height || 260;
    let w = 0, running = false, visible = false, last = 0, t = opt.t0 || 0, raf = 0;
    function fit() {
      w = cv.clientWidth || cv.parentElement.clientWidth || 600;
      const d = Math.min(1.5, window.devicePixelRatio || 1);
      cv.width = Math.round(w * d); cv.height = Math.round(H * d); cv.style.height = H + 'px';
      g.setTransform(d, 0, 0, d, 0, 0);
    }
    function frame(now) {
      raf = 0;
      const dt = last ? Math.min(1 / 30, Math.max(0, (now - last) / 1000)) : 0;
      last = now; t += dt;
      opt.draw(g, w, H, t, dt);
      if (visible && !C.reduce && !(opt.settled && opt.settled())) raf = requestAnimationFrame(frame);
      else { running = false; last = 0; }
    }
    function kick() {
      if (C.reduce || !visible) { opt.draw(g, w, H, t, 1 / 30); return; }
      if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
    }
    const io = new IntersectionObserver((es) => {
      visible = es[es.length - 1].isIntersecting;
      if (visible) kick();
    }, { rootMargin: '120px 0px' });
    io.observe(cv);
    fit(); opt.draw(g, w, H, t, 0);
    addEventListener('resize', () => { fit(); opt.draw(g, w, H, t, 0); });
    C.onTheme.push(() => opt.draw(g, w, H, t, 0));
    return { kick, redraw: () => opt.draw(g, w, H, t, 0), get t() { return t; } };
  };

  /* ---------- idle tour ----------
     const tour = C.tour(rootEl); in the draw loop: if (tour.active()) {...drive targets...}
     Starts 1.4 s after load if untouched; pauses on hover, focus, press or input;
     resumes 3.6 s after the last interaction. Off under reduced motion. */
  C.tour = function (el, onStop) {
    let lastInput = performance.now(), touched = false, hover = false, focus = false;
    const bump = () => { const was = active(); lastInput = performance.now(); touched = true; if (was && onStop) onStop(); };
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hover = true; bump(); } });
    el.addEventListener('pointerleave', () => { hover = false; lastInput = performance.now(); });
    el.addEventListener('pointerdown', bump);
    el.addEventListener('focusin', () => { focus = true; bump(); });
    el.addEventListener('focusout', () => { focus = false; lastInput = performance.now(); });
    el.addEventListener('input', bump);
    el.addEventListener('keydown', bump);
    function active() {
      if (C.reduce || hover || focus) return false;
      return performance.now() - lastInput > (touched ? 3600 : 1400);
    }
    return { active };
  };

  /* ---------- tour sweep: sine between lo and hi that starts from the current value ----------
     const sw = C.sweep(lo, hi, rad/s); in draw: const v = sw.step(tour.active(), current, dt);
     v is null when the tour is not active. */
  C.sweep = function (lo, hi, speed) {
    const mid = (lo + hi) / 2, amp = (hi - lo) / 2;
    let ph = null;
    return {
      step(active, cur, dt) {
        if (!active) { ph = null; return null; }
        if (ph === null) ph = Math.asin(C.clamp((cur - mid) / amp, -1, 1));
        ph += dt * speed;
        return mid + amp * Math.sin(ph);
      },
    };
  };

  /* ---------- range slider with live <output> ----------
     onInput fires on user input only; call .fire() to run it once by hand.
     .set(v) moves the thumb without firing (for idle tours). */
  C.range = function (id, fmt, onInput) {
    const inp = document.getElementById(id), out = document.querySelector('output[for="' + id + '"]');
    const show = () => { if (out) out.textContent = fmt(+inp.value); };
    const fire = () => { show(); if (onInput) onInput(+inp.value); };
    inp.addEventListener('input', fire); show();
    return {
      get value() { return +inp.value; },
      set(v) { inp.value = v; show(); },
      fire,
      el: inp,
    };
  };

  /* seg buttons: C.seg(container, onChange) — buttons carry data-v */
  C.seg = function (box, onChange) {
    const bs = Array.from(box.querySelectorAll('button'));
    bs.forEach((b) => b.addEventListener('click', () => {
      bs.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onChange(b.dataset.v);
    }));
    const cur = bs.find((b) => b.getAttribute('aria-pressed') === 'true');
    return cur ? cur.dataset.v : null;
  };

  document.addEventListener('DOMContentLoaded', () => { initTheme(); initTabs(); initMath(); initSpot(); });
})();
