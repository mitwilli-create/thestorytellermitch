// shared/clipplay.js · sitewide clip playback, extracted from work.html's reel
// so every page plays clips the same way. Any element matching
// .film[data-clip] or [data-clip-play] becomes a playable tile: click opens
// the shared theater overlay in-page (youtube > stream > local, same priority
// as the reel); a child video.preview (lazy data-src) hover-autoplays a muted
// loop on fine pointers when motion allows. Touch and keyboard get the same
// content through the click itself, so no affordance is hover-only.
// Tile data-* contract: data-title / data-tag / data-sub / data-poster /
// data-case, media via data-youtube-id, data-stream-id (customer code from
// body[data-stream-code], defaulting to the site's), data-local.
// body[data-theater-bed] opts the page into the theater music bed (the reel).
// Deep link: #play-<slug> opens the matching tile's theater on load.
(() => {
  const SEL = '.film[data-clip],[data-clip-play]';
  const STREAM_CODE_DEFAULT = 'bkgfhhvaijyxffgn';
  let theater = null, stage = null, lastTile = null;

  function ensureTheater() {
    if (theater) return;
    theater = document.createElement('div');
    theater.className = 'theater'; theater.id = 'theater'; theater.hidden = true;
    theater.setAttribute('role', 'dialog'); theater.setAttribute('aria-modal', 'true');
    theater.setAttribute('aria-labelledby', 'th-title');
    theater.innerHTML =
      '<div class="theater-scrim" data-close></div>' +
      '<div class="theater-panel">' +
        '<button class="theater-close" data-close aria-label="Close player">ESC ×</button>' +
        '<div class="theater-stage" id="th-stage"></div>' +
        '<div class="theater-meta">' +
          '<span class="m-tag" id="th-tag"></span>' +
          '<h3 id="th-title"></h3>' +
          '<p id="th-sub"></p>' +
          '<a class="case-link" id="th-case" hidden href="">Read the case study →</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(theater);
    stage = theater.querySelector('#th-stage');
  }

  function mountPlayer(d) {
    stage.replaceChildren();
    const mode = document.body.dataset.playback || 'stream';
    const code = document.body.dataset.streamCode || STREAM_CODE_DEFAULT;
    if (d.youtubeId) {
      const f = document.createElement('iframe');
      f.title = (d.title || 'Clip') + ' video player';
      f.src = 'https://www.youtube-nocookie.com/embed/' + d.youtubeId + '?autoplay=1';
      f.allow = 'autoplay; fullscreen; picture-in-picture'; f.allowFullscreen = true;
      stage.appendChild(f);
      if (window.__sound) __sound.duck(true); // clip audio owns the room
      return;
    }
    const devLocal = d.local && (location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname));
    if (mode === 'stream' && d.streamId && !devLocal) {
      const f = document.createElement('iframe');
      f.title = (d.title || 'Clip') + ' video player';
      f.src = 'https://customer-' + code + '.cloudflarestream.com/' + d.streamId + '/iframe?autoplay=true' + (d.poster ? '&poster=' + encodeURIComponent(new URL(d.poster, location.href).href) : '');
      f.allow = 'autoplay; fullscreen; picture-in-picture'; f.allowFullscreen = true;
      stage.appendChild(f);
      if (window.__sound) __sound.duck(true); // clip audio owns the room
      return;
    }
    const v = document.createElement('video');
    v.controls = true; v.autoplay = true; v.playsInline = true; v.preload = 'auto';
    if (d.poster) v.poster = d.poster;
    v.src = d.local;
    if (d.vtt) { const tr = document.createElement('track'); tr.kind = 'captions'; tr.src = d.vtt; tr.srclang = 'en'; tr.label = 'English'; tr.default = true; v.appendChild(tr); }
    if (window.__sound) __sound.voice(v); // clip audio ducks the bed like narration
    stage.appendChild(v);
  }

  function openTheater(tile) {
    ensureTheater();
    lastTile = tile; const d = tile.dataset;
    theater.querySelector('#th-tag').textContent = d.tag || '';
    theater.querySelector('#th-title').textContent = d.title || '';
    theater.querySelector('#th-sub').textContent = d.sub || '';
    const cl = theater.querySelector('#th-case');
    // theme.css sets .case-link{display:inline-block}, which beats the UA
    // [hidden] rule; toggle display explicitly so no phantom link renders
    if (d.case) { cl.hidden = false; cl.style.display = ''; cl.href = d.case; } else { cl.hidden = true; cl.style.display = 'none'; }
    if (window.__sound && document.body.dataset.theaterBed !== undefined) __sound.score('assets/music/bed-composed.mp3'); // theater bed, ~15%, opt-in only
    mountPlayer(d);
    theater.hidden = false;
    document.documentElement.classList.add('theater-open');
    theater.querySelector('.theater-close').focus();
  }

  function closeTheater() {
    if (!theater || theater.hidden) return;
    const v = stage.querySelector('video'); if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    stage.replaceChildren();
    theater.hidden = true;
    document.documentElement.classList.remove('theater-open');
    if (window.__sound) { __sound.duck(false); __sound.score(null); }
    if (lastTile) lastTile.focus();
  }

  document.addEventListener('click', (e) => {
    const tile = e.target.closest(SEL);
    if (tile) { e.preventDefault(); openTheater(tile); return; }
    if (e.target.closest('[data-close]')) closeTheater();
  });

  // iframe players swallow Tab inside their own document, so a keydown trap
  // alone lets focus exit the overlay; recapture whenever focus lands outside
  document.addEventListener('focusin', (e) => {
    if (!theater || theater.hidden) return;
    if (!theater.contains(e.target)) theater.querySelector('.theater-close').focus();
  });

  document.addEventListener('keydown', (e) => {
    if (!theater || theater.hidden) return;
    if (e.key === 'Escape') closeTheater();
    if (e.key === 'Tab') {
      const cl = theater.querySelector('#th-case');
      const f = [theater.querySelector('.theater-close'), ...stage.querySelectorAll('video,iframe'), cl && !cl.hidden ? cl : null].filter(Boolean);
      if (f.length < 2) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* hover previews (lazy src), fine pointers + motion allowed only.
     Gated at bind time: on touch, an emulated mouseenter from a tap must
     never start a preview download. */
  if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
    document.querySelectorAll(SEL).forEach((tile) => {
      const v = tile.querySelector('video.preview'); if (!v) return;
      tile.addEventListener('mouseenter', () => { if (!window.__motionOK) return; if (!v.src && v.dataset.src) v.src = v.dataset.src; v.play().catch(() => {}); });
      tile.addEventListener('mouseleave', () => { v.pause(); });
    });
  }
  /* off-screen hover players pause: any preview left playing must stop the
     moment its tile scrolls out of view */
  if ('IntersectionObserver' in window) {
    const pauseIO = new IntersectionObserver((es) => {
      es.forEach(({ target, isIntersecting }) => {
        if (isIntersecting) return;
        const v = target.querySelector('video');
        if (v && !v.paused) v.pause();
      });
    }, { threshold: 0 });
    document.querySelectorAll(SEL).forEach((t) => pauseIO.observe(t));
  }

  /* deep link: #play-<clip> opens the theater directly */
  (function () {
    const m = location.hash.match(/^#play-(.+)$/); if (!m) return;
    let slug;
    try { slug = CSS.escape(decodeURIComponent(m[1])); } catch { return; }
    const t = document.querySelector('.film[data-clip="' + slug + '"],[data-clip-play][data-clip="' + slug + '"]');
    if (t) { t.scrollIntoView({ block: 'center' }); openTheater(t); }
  })();

  window.__clipplay = { open: openTheater, close: closeTheater };
})();
