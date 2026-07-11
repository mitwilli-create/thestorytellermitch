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
})();
