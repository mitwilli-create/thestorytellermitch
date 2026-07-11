// shared/reveal.js — hero load-in + staggered hero lines + reveal-on-scroll.
// Include as the FIRST script at the end of <body>. Page scripts that need
// the same observer for other elements use window.__revealObserve(el).
// Per-page stagger override: <body data-reveal-stagger="3">.
// window.__motionOK is the sitewide motion gate: false under
// prefers-reduced-motion. Hover-play video, cinemagraphs, and any new
// animation must check it before moving anything.
(() => {
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  window.__motionOK = !rm.matches;
  if (rm.addEventListener) rm.addEventListener('change', () => { window.__motionOK = !rm.matches; });
  requestAnimationFrame(() => { setTimeout(() => document.body.classList.add('revealed'), window.__motionOK ? 80 : 0); });
  document.querySelectorAll('.display .ln > span').forEach((el, i) => { if (window.__motionOK) el.style.transitionDelay = (0.15 + i * 0.11) + 's'; });
  const mod = Number(document.body.dataset.revealStagger || 4);
  const io = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.08, rootMargin: '0px 0px 12% 0px' });
  document.querySelectorAll('.reveal').forEach((el, i) => { if (window.__motionOK) el.style.transitionDelay = ((i % mod) * 0.07) + 's'; io.observe(el); });
  window.__revealObserve = (el) => io.observe(el);

  // Cinemagraphs: [data-cine="assets/cinemagraphs/<plate>"] wraps a poster
  // img. When motion is allowed and the wrapper nears the viewport, layer a
  // muted looping video and fade it in once it actually plays. Any failure
  // (decode, autoplay policy, 404) silently leaves the poster in place.
  const saveData = navigator.connection && navigator.connection.saveData;
  if (window.__motionOK && !saveData) {
    const startCine = (el) => {
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
      const base = el.dataset.cine;
      for (const [ext, type] of [['webm', 'video/webm'], ['mp4', 'video/mp4']]) {
        const s = document.createElement('source'); s.src = base + '.' + ext; s.type = type; v.appendChild(s);
      }
      v.addEventListener('playing', () => el.classList.add('cine-on'), { once: true });
      v.addEventListener('error', () => v.remove(), { once: true });
      el.appendChild(v);
      const p = v.play(); if (p && p.catch) p.catch(() => v.remove());
    };
    const cio = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) { cio.unobserve(e.target); startCine(e.target); } }); }, { rootMargin: '160px' });
    document.querySelectorAll('[data-cine]').forEach((el) => cio.observe(el));
  }

  // Signal pulses: an occasional band crossing each diagram, randomized
  // 8-20s so surfaces feel alive without a metronome. Motion-gated.
  if (window.__motionOK) {
    document.querySelectorAll('.diagram, .sys-diagram, [data-pulse]').forEach((el) => {
      el.classList.add('sig-pulse');
      const loop = () => setTimeout(() => {
        el.classList.remove('pulsing'); void el.offsetWidth; el.classList.add('pulsing'); loop();
      }, 8000 + Math.random() * 12000);
      loop();
    });
  }

  // Counters: numeric stats tick up once on scroll-into-view; the HTML
  // value is the motion-off end state. tabular-nums keeps width stable.
  if (window.__motionOK) {
    const tick = (el) => {
      const m = el.textContent.match(/^([^0-9]*)([\d,.]+)(.*)$/s); if (!m) return;
      const end = parseFloat(m[2].replace(/,/g, '')); if (!isFinite(end)) return;
      const dec = (m[2].split('.')[1] || '').length;
      const grp = m[2].includes(',');
      const t0 = performance.now(), dur = 900;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        let n = (end * e).toFixed(dec);
        if (grp) n = Number(n).toLocaleString('en-US', { minimumFractionDigits: dec });
        el.textContent = m[1] + n + m[3];
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const nio = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) { nio.unobserve(e.target); tick(e.target); } }); }, { threshold: 0.6 });
    document.querySelectorAll('.cs-stat .n, [data-count]').forEach((el) => { if (/\d/.test(el.textContent)) nio.observe(el); });
  }
})();
