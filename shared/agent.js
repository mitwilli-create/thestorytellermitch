// Site assistant widget (Phase D). Hand-written vanilla JS, no framework, no
// build step, one <script> tag per page; styles are injected here so pages
// carry a single line. Talks to the Worker's /api/chat SSE endpoint.
//
// Product lines that must hold (owner ruling 2026-07-15 + Phase D research):
// - Additive launcher on pages that already show the work. NEVER a
//   destination page, NEVER auto-open, no badge, no bounce, no sound.
// - Assistive framing: this is a site assistant that answers questions about
//   Mitchell's work, not a chat-first "talk to my AI" surface.
// - Link cards route INTO the work; nothing is gated behind the chat.
// - Accessibility: the streaming container carries NO aria-live. A separate
//   visually-hidden announcer speaks each completed message once (streaming
//   into a live region produces duplicate/missing announcements; aria-busy
//   is unreliable across screen readers). Non-modal dialog: focus moves in
//   on open, Escape closes and returns focus, no focus trap.
// - Mobile keyboards: iOS Safari does not implement interactive-widget, so
//   sizing rides window.visualViewport on all platforms instead of a
//   per-page viewport meta change.
(() => {
  'use strict';
  if (window.__smAgent || !window.fetch || !window.ReadableStream) return;
  window.__smAgent = 1;

  const PILLS = [
    'What has he shipped?',
    'What did the 53s film cost?',
    'Is he available?',
    'Where do I start for my role?',
  ];
  const SCOPE_LINE = "Answers questions about Mitchell's work, grounded in this site, and can take you to the page that shows the thing.";
  const HISTORY_SENT = 12;   // messages sent to the server per turn
  const STALL_MS = 30000;    // no-chunk watchdog per request

  const css = `
  .sma-root{position:fixed;z-index:10000;font-family:'Inter',-apple-system,sans-serif}
  .sma-launch{position:fixed;right:18px;bottom:72px;z-index:10000;cursor:pointer;
    font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;
    color:var(--bone,#ece8e1);background:var(--surface,#141416);border:1px solid var(--line-2,rgba(236,232,225,0.18));
    padding:12px 16px;transition:border-color 160ms ease,color 160ms ease}
  .sma-launch:hover,.sma-launch:focus-visible{border-color:var(--bone,#ece8e1)}
  .sma-panel{position:fixed;right:18px;bottom:72px;z-index:10001;display:none;flex-direction:column;
    width:min(400px,calc(100vw - 36px));height:min(600px,calc(100vh - 110px));
    background:var(--bg-2,#0e0e10);border:1px solid var(--line-2,rgba(236,232,225,0.18));
    color:var(--bone,#ece8e1);box-shadow:0 18px 60px rgba(0,0,0,0.5)}
  .sma-root.open .sma-panel{display:flex}
  .sma-root.open .sma-launch{display:none}
  .sma-head{display:flex;align-items:baseline;gap:10px;padding:14px 16px 10px;border-bottom:1px solid var(--line,rgba(236,232,225,0.10))}
  .sma-title{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:var(--blood-text,#c4685d)}
  .sma-close{margin-left:auto;cursor:pointer;background:none;border:1px solid transparent;color:var(--mute,#8b867d);
    font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.1em;padding:4px 8px}
  .sma-close:hover,.sma-close:focus-visible{color:var(--bone,#ece8e1);border-color:var(--line-2,rgba(236,232,225,0.18))}
  .sma-scope{padding:10px 16px 0;font-size:13px;line-height:1.5;color:var(--mute,#8b867d)}
  .sma-log{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin}
  .sma-m{font-size:14.5px;line-height:1.55;white-space:pre-wrap;overflow-wrap:break-word;max-width:100%}
  .sma-m.u{align-self:flex-end;max-width:88%;background:var(--surface,#141416);
    border:1px solid var(--line,rgba(236,232,225,0.10));padding:8px 12px;color:var(--bone,#ece8e1)}
  .sma-m.a{color:var(--bone-soft,#c7c2b9)}
  .sma-m.a.sma-thinking{color:var(--mute,#8b867d);animation:smaPulse 1.4s ease-in-out infinite}
  @keyframes smaPulse{50%{opacity:0.35}}
  @media (prefers-reduced-motion:reduce){.sma-m.a.sma-thinking{animation:none}}
  .sma-nav{display:block;text-decoration:none;border:1px solid var(--blood-hairline,rgba(196,104,93,0.35));
    padding:10px 12px;transition:border-color 160ms ease}
  .sma-nav:hover,.sma-nav:focus-visible{border-color:var(--blood-text,#c4685d)}
  .sma-nav b{display:block;font-family:'JetBrains Mono',monospace;font-weight:400;font-size:11px;
    letter-spacing:0.12em;text-transform:uppercase;color:var(--blood-text,#c4685d)}
  .sma-nav i{font-style:normal;font-size:12px;color:var(--mute,#8b867d)}
  .sma-retry{display:inline-block;margin-top:8px;cursor:pointer;background:none;color:var(--bone,#ece8e1);
    border:1px solid var(--line-2,rgba(236,232,225,0.18));font-family:'JetBrains Mono',monospace;
    font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;padding:6px 10px}
  .sma-retry:hover{border-color:var(--bone,#ece8e1)}
  .sma-jump{position:absolute;right:16px;bottom:118px;display:none;cursor:pointer;
    background:var(--surface,#141416);color:var(--bone,#ece8e1);border:1px solid var(--line-2,rgba(236,232,225,0.18));
    font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;padding:6px 10px}
  .sma-pills{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px}
  .sma-pill{cursor:pointer;background:none;color:var(--mute,#8b867d);border:1px solid var(--line,rgba(236,232,225,0.10));
    font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:0.08em;padding:7px 10px;
    transition:color 160ms ease,border-color 160ms ease}
  .sma-pill:hover,.sma-pill:focus-visible{color:var(--bone,#ece8e1);border-color:var(--line-2,rgba(236,232,225,0.18))}
  .sma-form{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--line,rgba(236,232,225,0.10))}
  .sma-in{flex:1;min-width:0;background:transparent;border:1px solid var(--line-2,rgba(236,232,225,0.18));
    color:var(--bone,#ece8e1);font:inherit;font-size:14.5px;padding:10px 12px;border-radius:0;-webkit-appearance:none}
  .sma-in:focus{outline:none;border-color:var(--bone,#ece8e1)}
  .sma-send{cursor:pointer;background:none;color:var(--bone,#ece8e1);border:1px solid var(--line-2,rgba(236,232,225,0.18));
    font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;padding:10px 14px}
  .sma-send:hover,.sma-send:focus-visible{border-color:var(--bone,#ece8e1)}
  .sma-send:disabled{opacity:0.4;cursor:default}
  .sma-mail{padding:0 16px 12px;font-size:11.5px;color:var(--dim,#827d73)}
  .sma-mail a{color:var(--blood-text,#c4685d);text-decoration:none;border-bottom:1px solid var(--blood-hairline,rgba(196,104,93,0.35))}
  .sma-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
  @media (max-width:600px){
    .sma-panel{right:0;bottom:0;left:0;top:auto;width:100%;height:100%;border-left:none;border-right:none;border-bottom:none;
      padding-bottom:env(safe-area-inset-bottom)}
    .sma-launch{bottom:calc(72px + env(safe-area-inset-bottom))}
  }`;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };

  // ---- build ----------------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const root = el('div', 'sma-root');
  const launch = el('button', 'sma-launch', 'Ask about this work');
  launch.type = 'button';
  launch.setAttribute('aria-haspopup', 'dialog');
  launch.setAttribute('aria-expanded', 'false');

  const panel = el('div', 'sma-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Site assistant');

  const head = el('div', 'sma-head');
  const title = el('span', 'sma-title', 'Site assistant');
  const close = el('button', 'sma-close', 'Close');
  close.type = 'button';
  head.append(title, close);

  const scope = el('p', 'sma-scope', SCOPE_LINE);
  const log = el('div', 'sma-log');
  const jump = el('button', 'sma-jump', 'Jump to latest');
  jump.type = 'button';
  const pills = el('div', 'sma-pills');
  for (const q of PILLS) {
    const b = el('button', 'sma-pill', q);
    b.type = 'button';
    b.addEventListener('click', () => { input.value = q; form.requestSubmit(); });
    pills.appendChild(b);
  }
  const form = el('form', 'sma-form');
  const input = el('input', 'sma-in');
  input.type = 'text';
  input.maxLength = 1000;
  input.placeholder = 'Ask about the work';
  input.setAttribute('aria-label', 'Ask a question about Mitchell');
  const sendBtn = el('button', 'sma-send', 'Send');
  sendBtn.type = 'submit';
  form.append(input, sendBtn);
  const mail = el('p', 'sma-mail');
  mail.append('Prefer a person? ');
  const mailA = el('a', '', 'Email Mitchell');
  mailA.href = 'mailto:mitwilli@gmail.com';
  mail.appendChild(mailA);
  const announcer = el('div', 'sma-sr');
  announcer.setAttribute('aria-live', 'polite');

  panel.append(head, scope, log, jump, pills, form, mail, announcer);
  root.append(launch, panel);
  const mount = () => document.body.appendChild(root);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  // ---- state ----------------------------------------------------------------
  const history = [];
  let busy = false;
  let stick = true; // follow the stream only while the reader is at the bottom

  try {
    const saved = JSON.parse(sessionStorage.getItem('sma-log') || '[]');
    for (const m of saved) {
      if ((m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
        history.push(m);
        addMsg(m.role === 'user' ? 'u' : 'a', m.content);
      }
    }
    if (history.length) pills.style.display = 'none';
  } catch { /* fresh session */ }

  function persist() {
    try { sessionStorage.setItem('sma-log', JSON.stringify(history.slice(-24))); } catch { /* full */ }
  }

  // ---- behaviors ------------------------------------------------------------
  function openPanel() {
    root.classList.add('open');
    launch.setAttribute('aria-expanded', 'true');
    input.focus();
    fitViewport();
    log.scrollTop = log.scrollHeight;
  }
  function closePanel() {
    root.classList.remove('open');
    launch.setAttribute('aria-expanded', 'false');
    launch.focus();
  }
  launch.addEventListener('click', openPanel);
  close.addEventListener('click', closePanel);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

  log.addEventListener('scroll', () => {
    stick = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
    jump.style.display = stick ? 'none' : 'block';
  });
  jump.addEventListener('click', () => { log.scrollTop = log.scrollHeight; stick = true; jump.style.display = 'none'; });
  function follow() {
    if (stick) log.scrollTop = log.scrollHeight;
    else jump.style.display = 'block';
  }

  function fitViewport() {
    const vv = window.visualViewport;
    if (!vv) return;
    if (window.matchMedia('(max-width:600px)').matches && root.classList.contains('open')) {
      panel.style.height = vv.height + 'px';
      log.scrollTop = log.scrollHeight;
    } else {
      panel.style.height = '';
    }
  }
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitViewport);

  function addMsg(kind, text) {
    const m = el('div', `sma-m ${kind}`, text);
    log.appendChild(m);
    follow();
    return m;
  }

  function addNav(nav) {
    if (typeof nav.path !== 'string' || !/^\/[a-z0-9-]*$/.test(nav.path)) return;
    const a = el('a', 'sma-nav');
    a.href = nav.path;
    a.append(el('b', '', String(nav.label || 'Open the page')), el('i', '', 'thestorytellermitch.com' + nav.path));
    log.appendChild(a);
    follow();
  }

  function announce(text) {
    announcer.textContent = '';
    setTimeout(() => { announcer.textContent = text; }, 60);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    pills.style.display = 'none';
    history.push({ role: 'user', content: text });
    addMsg('u', text);
    persist();
    const bubble = addMsg('a', 'Thinking');
    bubble.classList.add('sma-thinking');
    run(text, bubble);
  });

  async function run(text, bubble) {
    busy = true;
    sendBtn.disabled = true;
    const ctrl = new AbortController();
    let acc = '';
    let gotDone = false;
    let navCount = 0;
    let raf = 0;
    let pend = '';
    let stallT = 0;
    const armStall = () => { clearTimeout(stallT); stallT = setTimeout(() => ctrl.abort(), STALL_MS); };
    const flush = () => {
      raf = 0;
      if (!pend) return;
      if (bubble.classList.contains('sma-thinking')) { bubble.classList.remove('sma-thinking'); bubble.textContent = ''; }
      acc += pend;
      pend = '';
      bubble.textContent = acc;
      follow();
    };

    try {
      armStall();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-HISTORY_SENT) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error('http ' + res.status);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        armStall();
        buf += dec.decode(value, { stream: true });
        const events = buf.split('\n\n');
        buf = events.pop() || '';
        for (const evt of events) {
          const line = evt.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          let p;
          try { p = JSON.parse(line.slice(5)); } catch { continue; }
          if (typeof p.text === 'string') {
            pend += p.text;
            if (!raf) raf = requestAnimationFrame(flush);
          } else if (p.nav) {
            if (raf) { cancelAnimationFrame(raf); flush(); }
            addNav(p.nav);
            navCount++;
          } else if (p.done) {
            gotDone = true;
          } else if (p.err) {
            throw new Error(String(p.err));
          }
        }
      }
      if (raf) cancelAnimationFrame(raf);
      flush();
      clearTimeout(stallT);
      if (!acc && navCount) { acc = 'Here is the page for that.'; bubble.textContent = acc; bubble.classList.remove('sma-thinking'); }
      if (!acc && !navCount) throw new Error('empty');
      if (!gotDone) { acc += '\n(response interrupted)'; bubble.textContent = acc; }
      history.push({ role: 'assistant', content: acc });
      persist();
      announce('Assistant: ' + acc);
    } catch {
      clearTimeout(stallT);
      bubble.classList.remove('sma-thinking');
      bubble.textContent = (acc ? acc + '\n' : '') + 'That did not go through.';
      const retry = el('button', 'sma-retry', 'Retry');
      retry.type = 'button';
      retry.addEventListener('click', () => {
        retry.remove();
        bubble.textContent = 'Thinking';
        bubble.classList.add('sma-thinking');
        run(text, bubble);
      });
      bubble.appendChild(retry);
      if (!input.value) input.value = text; // never lose a typed question
      announce('The assistant hit an error. A retry button is available.');
      follow();
    } finally {
      busy = false;
      sendBtn.disabled = false;
    }
  }
})();
