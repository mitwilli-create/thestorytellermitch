// shared/audio.js: the site's opt-in sound engine. Muted by default,
// zero autoplay ever: nothing here makes a sound until the visitor flips
// the persistent toggle (score, diegetic) or presses play on a narration
// console (voice, an explicit per-element gesture).
//
// The mixing hierarchy is enforced in code, not convention:
//   voice > diegetic > score
// Voice playback ducks the score and suppresses diegetic one-shots for
// its duration. The score bed never exceeds SCORE_VOL. Only one voice
// element plays at a time.
//
// Page code talks to window.__sound:
//   __sound.on                     -> current toggle state (boolean)
//   __sound.sub(fn)                -> fn(on) on every toggle change
//   __sound.sfx(name)              -> one-shot from assets/sfx/<name>.mp3
//   __sound.hum(true|false)        -> start/stop the pipeline hum loop
//   __sound.score(src|null)        -> start/stop a music bed (~15% vol)
//   __sound.voice(el)              -> register a voice element, <audio> or
//                                     <video>, for one-at-a-time + ducking
(() => {
  const KEY = 'mw-sound';
  const SCORE_VOL = 0.15;      // the bed's ceiling
  const DUCK_VOL = 0.04;       // bed while a voice is speaking
  const SFX_VOL = 0.5;
  const HUM_VOL = 0.22;
  // storage access can throw (Safari Private Browsing, blocked storage);
  // a throw here would abort the IIFE and take the whole engine with it
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const state = {
    on: store.get(KEY) === 'on',
    subs: [], voiceBusy: false, voices: [],
    scoreEl: null, humEl: null, sfxCache: {},
  };

  const fade = (el, to, ms) => {
    if (!el) return;
    const from = el.volume, t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      el.volume = from + (to - from) * k;
      if (k < 1 && !el.paused) requestAnimationFrame(step);
      else if (to === 0 && k >= 1) el.pause();
    };
    requestAnimationFrame(step);
  };

  const api = {
    get on() { return state.on; },
    sub(fn) { state.subs.push(fn); },
    sfx(name) {
      if (!state.on || state.voiceBusy) return;
      let a = state.sfxCache[name];
      if (!a) { a = new Audio('assets/sfx/' + name + '.mp3'); state.sfxCache[name] = a; }
      a.volume = SFX_VOL; a.currentTime = 0;
      a.play().catch(() => {});
    },
    hum(run) {
      if (run) {
        if (!state.on || state.voiceBusy) return;
        if (!state.humEl) { state.humEl = new Audio('assets/sfx/pipeline-hum.mp3'); state.humEl.loop = true; }
        state.humEl.volume = 0;
        state.humEl.play().then(() => fade(state.humEl, HUM_VOL, 400)).catch(() => {});
      } else if (state.humEl && !state.humEl.paused) {
        fade(state.humEl, 0, 500);
      }
    },
    score(src) {
      if (!src) { if (state.scoreEl) fade(state.scoreEl, 0, 900); return; }
      if (!state.on) return;
      if (!state.scoreEl || !state.scoreEl.src.endsWith(src)) {
        if (state.scoreEl) state.scoreEl.pause();
        state.scoreEl = new Audio(src); state.scoreEl.loop = true;
      }
      state.scoreEl.volume = 0;
      state.scoreEl.play().then(() => fade(state.scoreEl, state.voiceBusy ? DUCK_VOL : SCORE_VOL, 1200)).catch(() => {});
    },
    duck(on) {
      // for contexts where playback can't be observed (iframe players):
      // hold the bed at duck level while a clip is presumably speaking
      if (state.scoreEl && !state.scoreEl.paused) fade(state.scoreEl, on ? DUCK_VOL : SCORE_VOL, on ? 300 : 900);
    },
    voice(el) {
      // the registry is what makes "one voice at a time" real: narration
      // players, variety-chip takes, and theater cuts are detached Audio()
      // elements or <video>, so no DOM query can round them all up
      if (state.voices.includes(el)) return;
      state.voices.push(el);
      el.addEventListener('play', () => {
        // one voice at a time; duck the bed; hold one-shots and hum
        state.voices.forEach((o) => { if (o !== el && !o.paused) o.pause(); });
        state.voiceBusy = true;
        if (state.scoreEl && !state.scoreEl.paused) fade(state.scoreEl, DUCK_VOL, 300);
        if (state.humEl && !state.humEl.paused) fade(state.humEl, 0, 300);
      });
      const done = () => {
        // a swap fires the loser's pause event after the winner is already
        // playing; only the last voice standing may lift the duck
        if (state.voices.some((v) => !v.paused)) return;
        state.voiceBusy = false;
        if (state.on && state.scoreEl && !state.scoreEl.paused) fade(state.scoreEl, SCORE_VOL, 900);
      };
      el.addEventListener('pause', done);
      el.addEventListener('ended', done);
      el.setAttribute('data-voice', '');
    },
  };
  window.__sound = api;

  const setOn = (on) => {
    state.on = on;
    store.set(KEY, on ? 'on' : 'off');
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('is-on', on);
    if (!on) { api.score(null); api.hum(false); }
    state.subs.forEach((fn) => { try { fn(on); } catch (e) {} });
  };

  // persistent toggle: 44px hit area, fixed bottom-right, every page
  const btn = document.createElement('button');
  btn.className = 'sound-toggle';
  btn.type = 'button';
  btn.setAttribute('aria-pressed', String(state.on));
  btn.setAttribute('aria-label', 'Sound: narration, effects, and score. Off by default.');
  btn.innerHTML = '<span class="st-i" aria-hidden="true"></span><span class="st-t">sound</span>';
  if (state.on) btn.classList.add('is-on');
  btn.addEventListener('click', () => setOn(!state.on));
  document.body.appendChild(btn);

  // diegetic hooks published by page code
  window.addEventListener('mw:receipt-print', () => api.sfx('receipt-print'));
  window.addEventListener('mw:run-start', () => api.hum(true));
  window.addEventListener('mw:run-end', () => api.hum(false));
  // soft click on primary buttons only (never on plain links)
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn, .run-replay, .r-replay, .chip')) api.sfx('ui-click');
  }, true);
})();
