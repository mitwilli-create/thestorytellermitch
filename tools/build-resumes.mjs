#!/usr/bin/env node
// build-resumes.mjs : bake resumes-src/*.md into site-styled pages at resume/<lane>.html
// Web view: dark, on-brand (theme.css tokens). Print view (@media print): bone-paper
// light variant, same type system; Playwright's page.pdf() picks it up automatically.
// Fail-loud: unknown markdown shapes throw; a silent mis-parse must never ship.
// Also importable: parse() + page() are exported so private per-application CV
// renders (career-ops scripts/render-cv-site-pdf.mjs) reuse the exact same
// parser + print CSS without publishing anything to the site.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.RESUME_SRC || join(ROOT, 'resumes-src');
const OUT = join(ROOT, 'resume');

export const LANES = {
  'mitchell-williams-forward-deployed':       { slug: 'forward-deployed',       title: 'Forward Deployed Engineer / Creative' },
  'mitchell-williams-ai-solutions-architect': { slug: 'ai-solutions-architect', title: 'AI Solutions Architect' },
  'mitchell-williams-ai-enablement':          { slug: 'ai-enablement',          title: 'AI Enablement / Transformation Lead' },
  'mitchell-williams-ai-program-manager':     { slug: 'ai-program-manager',     title: 'AI / Technical Program Manager' },
  'mitchell-williams-comms-manager':          { slug: 'comms-manager',          title: 'Communications Manager (AI-native)' },
  'mitchell-williams-devrel-education':       { slug: 'devrel-education',       title: 'Developer Education / DevRel' },
  'mitchell-williams-content-editorial':      { slug: 'content-editorial',      title: 'Content Producer / Editorial Lead' },
};

export const PRINT_PT = {
  'forward-deployed': 9.8, 'ai-solutions-architect': 9.8, 'ai-enablement': 9.2,
  'ai-program-manager': 9.2, 'comms-manager': 9.6, 'devrel-education': 9.8,
  'content-editorial': 9.2,
};

// Deep links: first mention per resume of a video / story / project routes to its page.
// Applied to assembled section HTML only; skips text already inside an <a>.
const TERM_LINKS = [
  ['tax-verification-agent', '../tax-verification-agent.html'],
  ['comms-triage-agent', '../comms-triage-agent.html'],
  ['tax-verification agent', '../tax-verification-agent.html'],
  ['Communications-triage agent', '../comms-triage-agent.html'],
  ['comms-triage agent', '../comms-triage-agent.html'],
  ['comms-triage', '../comms-triage-agent.html'],
  ['broll-pipeline', '../broll-pipeline.html'],
  ['content-ops', '../content-ops.html'],
  ['voice-os', '../voice-os.html'],
  ['career-ops', '../career-ops.html'],
  ['monolith', '../monolith.html'],
  ['#FreeAhmed', '../stories.html#freeahmed-coalition'],
  ['Nelson Mandela', '../stories.html#mandela-special'],
  ['bin Laden', '../stories.html#stream-launch-night'],
  ['Umbrella Revolution', '../stories.html#mong-kok-backpack-live'],
  ['Scientology', '../stories.html#scientology-live-coverage'],
  ['digital-twin agent', '../stories.html#digital-twin'],
  ['digital twin', '../stories.html#digital-twin'],
  ['talent pipeline', '../stories.html#talent-pipeline'],
  ['explainer line', '../stories.html#aj-plus-50m-views'],
  ['measles explainer', '../work.html#play-ajp-2017-measles-outbreaks-usa-viral-50m-views'],
  ['talent-branding video', '../work.html#google'],
  ['engineer profiles', '../work.html#google'],
  ['operator runbook', '../writing.html'],
  ['Ahmed Shihab-Eldin', '../stories.html#freeahmed-coalition'],
  ['Mandela', '../stories.html#mandela-special'],
];
function deepLink(html) {
  const parts = html.split(/(<[^>]+>)/);
  const linked = new Set(); // one link per destination URL per document
  let anchorDepth = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith('<')) {
      if (/^<a[\s>]/i.test(p)) anchorDepth++;
      else if (/^<\/a>/i.test(p)) anchorDepth = Math.max(0, anchorDepth - 1);
      continue;
    }
    if (anchorDepth > 0 || !p.trim()) continue;
    // collect non-overlapping matches against the pristine token, then apply right-to-left
    const spans = [];
    for (const [phrase, url] of TERM_LINKS) {
      if (linked.has(url)) continue;
      const idx = p.toLowerCase().indexOf(phrase.toLowerCase());
      if (idx === -1) continue;
      if (spans.some(sp => idx < sp.end && idx + phrase.length > sp.start)) continue;
      spans.push({ start: idx, end: idx + phrase.length, url });
      linked.add(url);
    }
    spans.sort((a, b) => b.start - a.start);
    let text = p;
    for (const sp of spans) {
      text = text.slice(0, sp.start) + '<a href="' + sp.url + '">' + text.slice(sp.start, sp.end) + '</a>' + text.slice(sp.end);
    }
    parts[i] = text;
  }
  return parts.join('');
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// inline markdown: **bold**, [text](../site-relative.html or #anchor) phrase links;
// bare portfolio/profile URLs still auto-link. Site-relative-only md links keep
// LINK_RE from re-matching inside generated hrefs.
const LINK_RE = /\b((?:thestorytellermitch|github|linkedin)\.com(?:\/[\w.%/-]*[\w%/-])?)/g;
const inline = (s) => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(((?:\.\.\/|#)[\w./#-]+)\)/g, '<a href="$2">$1</a>')
  .replace(LINK_RE, '<a href="https://$1">$1</a>');

export function parse(md, file) {
  const lines = md.split('\n');
  let i = 0;
  const next = () => lines[i++];
  const peek = () => lines[i];

  if (!/^# /.test(peek())) throw new Error(`${file}: expected "# Name" on line 1`);
  const name = next().slice(2).trim();
  while (peek() === '') i++;
  if (!/^## /.test(peek())) throw new Error(`${file}: expected pillars h2 after name`);
  const pillars = next().slice(3).trim();
  while (peek() === '') i++;
  // contact block: consecutive non-empty, non-heading lines
  const contact = [];
  while (peek() !== undefined && peek() !== '' && !/^#/.test(peek())) contact.push(next().trim());

  // remaining: sections
  const sections = [];
  let cur = null;
  const pushSection = (title) => { cur = { title, blocks: [] }; sections.push(cur); };
  while (i < lines.length) {
    const line = next();
    if (line === undefined) break;
    const t = line.trimEnd();
    if (t === '') continue;
    if (/^## /.test(t)) { pushSection(t.slice(3).trim()); continue; }
    if (!cur) {
      // pre-section content (e.g. **Selected work:** block) -> intro pseudo-section
      pushSection('');
      cur.intro = true;
    }
    if (/^### /.test(t)) { cur.blocks.push({ type: 'role', head: t.slice(4).trim(), sub: '', body: [] }); continue; }
    if (/^#### /.test(t)) {
      const role = [...cur.blocks].reverse().find(b => b.type === 'role');
      const target = role ? role.body : cur.blocks;
      target.push({ type: 'initiative', head: t.slice(5).trim(), items: [] });
      continue;
    }
    if (/^- /.test(t)) {
      const item = t.slice(2).trim();
      const role = [...cur.blocks].reverse().find(b => b.type === 'role');
      const init = role ? [...role.body].reverse().find(b => b.type === 'initiative') : [...cur.blocks].reverse().find(b => b.type === 'initiative');
      if (init) { init.items.push(item); continue; }
      const last = (role ? role.body : cur.blocks)[(role ? role.body : cur.blocks).length - 1];
      if (last && last.type === 'ul') last.items.push(item);
      else (role ? role.body : cur.blocks).push({ type: 'ul', items: [item] });
      continue;
    }
    // paragraph line; org/date line right under a role becomes its sub
    const role = cur.blocks[cur.blocks.length - 1];
    if (role && role.type === 'role' && role.sub === '' && role.body.length === 0) { role.sub = t.trim(); continue; }
    if (role && role.type === 'role') { role.body.push({ type: 'p', text: t.trim() }); continue; }
    cur.blocks.push({ type: 'p', text: t.trim() });
  }
  return { name, pillars, contact, sections };
}

function renderBlocks(blocks) {
  return blocks.map(b => {
    if (b.type === 'p') return `<p class="rp">${inline(b.text)}</p>`;
    if (b.type === 'ul') return `<ul class="rl">${b.items.map(x => `<li>${inline(x)}</li>`).join('')}</ul>`;
    if (b.type === 'initiative') return `<div class="rinit"><div class="rinit-h">${inline(b.head)}</div><ul class="rl">${b.items.map(x => `<li>${inline(x)}</li>`).join('')}</ul></div>`;
    if (b.type === 'role') return `<div class="rrole"><div class="rrole-h">${inline(b.head)}</div><div class="rrole-s">${inline(b.sub)}</div>${renderBlocks(b.body)}</div>`;
    throw new Error(`unknown block type ${b.type}`);
  }).join('\n');
}

export function page({ name, pillars, contact, sections }, lane) {
  const secHtml = sections.map(s =>
    `<section class="rsec${s.intro ? ' rsec-intro' : ''}">${s.title ? `<h2 class="rsec-h">${inline(s.title)}</h2>` : ''}${renderBlocks(s.blocks)}</section>`
  ).join('\n');
  const secHtmlLinked = lane.noSiteLinks ? secHtml : deepLink(secHtml);

  const pt = lane.pt ?? PRINT_PT[lane.slug] ?? 9.2;
  const sm = (pt * 0.85).toFixed(2);
  const rh = (pt + 1.8).toFixed(1);
  return `<!doctype html>
<html lang="en" class="no-js">
<head>
  <script>document.documentElement.classList.remove('no-js')</script>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Resume · ${esc(lane.title)} · Mitchell Williams</title>
  <meta name="description" content="Mitchell Williams resume for ${esc(lane.title)} roles. Rendered from the same source as the downloadable PDF.">
  <meta name="robots" content="noindex">
  <link rel="preload" as="font" type="font/woff2" href="../assets/fonts/archivo-var-latin.woff2" crossorigin>
  <link rel="preload" as="font" type="font/woff2" href="../assets/fonts/inter-var-latin.woff2" crossorigin>
  <link rel="preload" as="font" type="font/woff2" href="../assets/fonts/jetbrains-mono-var-latin.woff2" crossorigin>
  <link rel="stylesheet" href="../shared/theme.css?v=20260711d">
  <style>
    /* ---- shared structure ---- */
    .rwrap{max-width:820px;margin:0 auto;padding:150px 24px 80px}
    .rname{font-family:'Archivo',sans-serif;font-weight:900;font-size:clamp(34px,5vw,54px);
      letter-spacing:-0.03em;text-transform:uppercase;line-height:1;color:var(--bone)}
    .rpillars{font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:0.1em;
      text-transform:uppercase;color:var(--blood-soft);margin-top:14px;line-height:1.7}
    .rcontact{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--mute);
      margin-top:12px;line-height:1.8}
    section.rsec{padding:0;margin-top:34px} /* theme.css sets global section padding; kill it here */
    .rsec-h{font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:0.14em;
      text-transform:uppercase;color:var(--blood-soft);border-bottom:1px solid var(--line);
      padding-bottom:8px;margin-bottom:14px}
    .rp{font-size:14.5px;line-height:1.6;color:var(--bone-soft);margin-bottom:10px}
    .rp strong,.rl strong{color:var(--bone);font-weight:700}
    .rl{list-style:none;margin:0 0 10px}
    .rl li{font-size:14px;line-height:1.55;color:var(--bone-soft);padding-left:16px;position:relative;margin-bottom:7px}
    .rl li::before{content:"·";position:absolute;left:2px;color:var(--blood-soft)}
    .rrole{margin:16px 0 6px}
    .rrole-h{font-family:'Archivo',sans-serif;font-weight:800;font-size:17px;color:var(--bone);letter-spacing:-0.01em}
    .rrole-s{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--mute);margin:3px 0 10px}
    .rrole-s strong{color:var(--bone-soft)}
    .rinit{margin:10px 0}
    .rinit-h{font-size:13.5px;font-weight:700;color:var(--bone);margin-bottom:6px}
    .rtop{display:flex;gap:14px;flex-wrap:wrap;margin-top:26px}
    /* ---- print: pure white, two-face type system (Mitchell's call 2026-07-10,
       overriding the dealbreaker's band/underline/mono-line compromises):
       Archivo carries every heading (name, section heads, role heads), Inter
       carries every text run (pillars, contact, subtitles, body). No band, no
       mono, no underlines; links signal by brand red alone. ---- */
    .rwrap section a,.rwrap .rcontact a{color:var(--blood-soft);text-decoration:none}
    .rwrap section a:hover,.rwrap .rcontact a:hover{color:var(--bone)}
    /* page size only; per-page top/bottom margins are passed to Playwright's
       page.pdf() in tools/export-resume-pdfs.mjs so page 2+ never starts flush */
    @page{size:letter}
    @media print{
      :root{--bg:#fff;--surface:#fff;--bone:#181614;--bone-soft:#2e2a26;
        --mute:#6b645b;--dim:#8b867d;--line:#d8d2c6;--line-2:#c9c2b4;
        --blood:#8a3a33;--blood-soft:#8a3a33}
      html,body{background:#fff !important;color:#2e2a26}
      .kicker,.rpillars,.rcontact,.rrole-s{font-family:'Inter',sans-serif}
      .kicker{font-weight:600}
      .rpillars{font-weight:600;letter-spacing:0.06em}
      .rsec-h{font-family:'Archivo',sans-serif;font-weight:800;letter-spacing:0.1em;border-bottom-color:var(--line-2)}
      .rwrap section a,.rwrap .rcontact a{color:#8a3a33 !important;text-decoration:none}
      /* theme.css grain overlay (SVG feTurbulence) forces Chromium to rasterize
         every printed page: 3.4MB PDFs with no extractable text. Kill it and any
         blend/filter contexts so print stays vector + ATS-parseable. */
      body::after{display:none !important;content:none !important}
      *{mix-blend-mode:normal !important;filter:none !important}
      .nav,.rtop,footer,.scrollcue{display:none !important}
      .rwrap{padding:0 0.42in 0.05in;max-width:none}
      .rname{font-size:20pt}
      .rpillars{font-size:${sm}pt;margin-top:6pt;line-height:1.5}
      .rcontact{font-size:${sm}pt;margin-top:5pt;line-height:1.5}
      section.rsec{margin-top:6pt;padding:0}
      .rsec-h{font-size:${sm}pt;padding-bottom:2pt;margin-bottom:4pt}
      .rp{font-size:${pt}pt;line-height:1.26;margin-bottom:3pt}
      .rl{margin-bottom:4pt}
      .rl li{font-size:${pt}pt;line-height:1.24;margin-bottom:2pt;padding-left:12pt;break-inside:avoid}
      .rl li::before{left:1pt}
      .rrole{margin:5pt 0 2pt}
      .rrole-h{font-size:${rh}pt;break-after:avoid}
      .rrole-s{font-size:${sm}pt;margin:1.5pt 0 4pt}
      .rinit{margin:4pt 0;break-inside:avoid}
      .rinit-h{font-size:${pt}pt;margin-bottom:2pt}
      .rp{break-inside:avoid}
      a{color:inherit;text-decoration:none}
    }
  </style>
</head>
<body>

<nav class="nav">
  <a href="../index.html" class="mark">MITCHELL<b>.</b>WILLIAMS</a>
  <input type="checkbox" id="navcheck" class="nav-check" aria-label="Open navigation menu">
  <label for="navcheck" class="nav-toggle"><span></span><span></span></label>
  <div class="nav-links">
    <a href="../fit.html">Role Fit</a>
    <a href="../projects.html">AI Projects</a>
    <a href="../assets/mitchell-williams-resume.pdf" target="_blank" rel="noopener">Resume</a>
    <a href="../comms.html">Comms &amp; Editorial</a>
    <a href="../work.html">Reel</a>
    <a href="../timeline.html">Timeline</a>
    <a href="../stories.html">Case Files</a>
    <a href="../about.html">About</a>
    <a href="../contact.html" class="nav-cta">Contact</a>
  </div>
</nav>

<div class="rwrap">
  <header>
    <div class="kicker">resume · ${esc(lane.title.toLowerCase())}</div>
    <h1 class="rname">${esc(name)}</h1>
    <div class="rpillars">${esc(pillars)}</div>
    <div class="rcontact">${contact.map(c => inline(c).replace(/\b\d{3}-\d{3}-\d{4}\b\s*\|\s*/, '<span class="pdf-phone"></span>')).join('<br>')}</div>
    <div class="rtop">
      <a class="btn" href="../resume.html"><span>&larr; All resumes</span></a>
      <a class="btn solid" href="../assets/resumes/${esc(Object.keys(LANES).find(k => LANES[k] === lane) ?? `mitchell-williams-${lane.slug}`)}.pdf"><span>Download PDF</span></a>
      <a class="btn" href="../fit.html#${esc(lane.slug === 'forward-deployed' ? 'forward-deployed' : lane.slug)}"><span>The fit case</span></a>
    </div>
  </header>
  ${secHtmlLinked}
</div>

<footer>
  <div class="wrap">
    <div class="foot">
      <div class="big">Let's<br>talk.</div>
      <div class="foot-links">
        <a href="mailto:mitwilli@gmail.com">mitwilli@gmail.com</a>
        <a href="https://github.com/mitwilli-create">github.com/mitwilli-create</a>
        <a href="https://linkedin.com/in/mitwilli">linkedin.com/in/mitwilli</a>
      </div>
    </div>
    <div class="foot-legal">Mitchell Williams · Seattle · Newsrooms, Google, AI-native systems.</div>
  </div>
</footer>

<script src="../shared/reveal.js?v=20260711e"></script>
<script src="../shared/audio.js?v=20260711c"></script>
</body>
</html>
`;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  mkdirSync(OUT, { recursive: true });
  let built = 0;
  for (const [base, lane] of Object.entries(LANES)) {
    const src = join(SRC, `${base}.md`);
    let md;
    try { md = readFileSync(src, 'utf8'); }
    catch { console.error(`MISSING SOURCE: ${src}`); process.exitCode = 1; continue; }
    if (md.includes('\u2014')) { console.error(`EM DASH (U+2014) in ${base}.md : refusing to bake`); process.exitCode = 1; continue; }
    const parsed = parse(md, base);
    writeFileSync(join(OUT, `${lane.slug}.html`), page(parsed, lane));
    built++;
    console.log(`baked resume/${lane.slug}.html (${md.split(/\s+/).length}w source)`);
  }
  console.log(`${built}/${Object.keys(LANES).length} resume pages baked`);
  if (built !== Object.keys(LANES).length) process.exit(1);
}
