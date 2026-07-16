// shared/narration.js: wires every .voice-console[data-narration] to its
// rendered take in assets/audio/narration/<slug>.mp3 (per-clip loudness is
// measured into the manifest that lives beside the takes). The <audio> is
// created on the first press, so loading a page costs zero audio bytes.
// Pressing play is the visitor's explicit gesture: narration plays even
// while the master sound toggle is off, the same rule the variety chips
// follow. Every element registers with __sound.voice(), which ducks the
// score bed and enforces one voice at a time. The play button ships
// disabled in the markup and is enabled here, so a no-JS visitor never
// sees a control that cannot work.
(() => {
  const PLAY = '▶', PAUSE = '❚❚';
  const fmt = (s) => {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  document.querySelectorAll('.voice-console[data-narration]').forEach((box) => {
    const btn = box.querySelector('.vc-play');
    const fill = box.querySelector('.vc-wave-fill');
    const seek = box.querySelector('.vc-seek');
    const status = box.querySelector('.vc-status');
    if (!btn || !fill || !seek || !status) return;

    let el = null, raf = 0, scrub = false, pending = -1;
    // the baked data-narration-secs shows a duration before any bytes load;
    // the element's real metadata takes over once it exists
    const total = () => (el && isFinite(el.duration) && el.duration) || +box.dataset.narrationSecs || 0;

    const paint = () => {
      if (scrub) return; // the visitor's drag owns the handle
      const d = total(), t = el ? el.currentTime : 0;
      const pct = d ? Math.min(100, (t / d) * 100) : 0;
      fill.style.width = pct + '%';
      seek.value = pct;
      status.textContent = t > 0 ? fmt(t) + ' / ' + fmt(d) : fmt(d);
    };
    const loop = () => { paint(); raf = requestAnimationFrame(loop); };
    const still = () => { if (raf) cancelAnimationFrame(raf); raf = 0; paint(); };

    const showPlaying = (on) => {
      box.classList.toggle('is-playing', on);
      btn.textContent = on ? PAUSE : PLAY;
      btn.setAttribute('aria-label', on ? 'Pause narration' : 'Play narration');
    };

    const ensure = () => {
      if (el) return el;
      el = new Audio('assets/audio/narration/' + box.dataset.narration + '.mp3');
      if (window.__sound) __sound.voice(el);
      el.addEventListener('play', () => { showPlaying(true); if (!raf) loop(); });
      el.addEventListener('pause', () => { showPlaying(false); still(); });
      el.addEventListener('ended', () => { el.currentTime = 0; still(); });
      el.addEventListener('loadedmetadata', () => {
        if (pending >= 0) { el.currentTime = pending; pending = -1; }
        paint();
      });
      el.addEventListener('error', () => {
        showPlaying(false); still();
        btn.disabled = true;
        seek.disabled = true; // an invisible-but-focusable seek must die with the button
        status.textContent = 'audio unavailable';
      });
      return el;
    };

    btn.addEventListener('click', () => {
      const a = ensure();
      if (a.paused) a.play().catch(() => {}); else a.pause();
    });

    // the invisible range over the bar field: native keyboard + pointer seek
    seek.addEventListener('pointerdown', () => { scrub = true; });
    seek.addEventListener('pointerup', () => { scrub = false; paint(); });
    seek.addEventListener('input', () => {
      const a = ensure(), d = total();
      if (!d) return;
      const t = (+seek.value / 100) * d;
      if (a.readyState >= 1) a.currentTime = t;
      else pending = t; // applied on loadedmetadata
      fill.style.width = seek.value + '%';
      status.textContent = fmt(t) + ' / ' + fmt(d);
    });

    btn.disabled = false;
    paint();
  });
})();
