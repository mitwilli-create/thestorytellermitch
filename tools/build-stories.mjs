#!/usr/bin/env node
// Bake assets/site-data/stories.json into stories.html between
// <!-- STORIES:START/END --> and <!-- STINDEX:START/END --> markers.
// Adding a story = edit JSON, re-run, commit.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = resolve(SITE, 'stories.html');
const { stories } = JSON.parse(readFileSync(resolve(SITE, 'assets/site-data/stories.json'), 'utf8'));
const clips = JSON.parse(readFileSync(resolve(SITE, 'assets/site-data/clips.json'), 'utf8'));
const clipBySlug = new Map(clips.clips.map((c) => [c.slug, c]));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// body-paragraph inline links: [text](site-relative-or-https url), converted post-escape
const md = (s) => esc(s).replace(/\[([^\]]+)\]\((?!javascript:)([a-z0-9./#:-]+)\)/gi, '<a href="$2">$1</a>');

// em-dash gate: fail the bake rather than ship one
const blob = JSON.stringify(stories);
if (blob.includes('—')) { console.error('EM DASH found in stories.json — fix before baking'); process.exit(1); }

// ---- in-page clip playback (round-3 A1) --------------------------------
// Clip-derived visuals bake as a.mplay[data-clip-play] tiles: shared/clipplay.js
// opens the theater on click; a lazy child video.preview hover-autoplays the
// SAME clip's preview, contained inside the tile (provenance + containment
// are Mitchell mandates: never hover-play a clip over a different image).
function nojsHref(c) {
  if (c.media.youtubeId) return `https://www.youtube.com/watch?v=${c.media.youtubeId}`;
  if (clips.playback === 'stream' && c.media.streamId)
    return `https://customer-${clips.streamCustomerCode}.cloudflarestream.com/${c.media.streamId}/watch`;
  return c.media.local;
}
function clipOrDie(slug, where) {
  const c = clipBySlug.get(slug);
  if (!c) { console.error(`${where}: clip slug not in manifest: ${slug}`); process.exit(1); }
  return c;
}
function playAttrs(c) {
  const tag = `${c.outletLabel} · ${c.type} · ${c.year}`;
  return ` data-clip-play data-clip="${esc(c.slug)}" data-tag="${esc(tag)}" data-title="${esc(c.title)}" data-sub="${esc(c.subtitle)}" data-poster="${esc(c.poster)}" data-local="${esc(c.media.local)}" data-stream-id="${esc(c.media.streamId ?? '')}"${c.media.youtubeId ? ` data-youtube-id="${esc(c.media.youtubeId)}"` : ''}`;
}
const previewVideo = (src) => src
  ? `<video class="preview" preload="none" muted loop playsinline aria-hidden="true" data-src="${esc(src)}"></video>`
  : '';
function mplay(c, inner, extra = '') {
  return `<a class="mplay" href="${esc(nojsHref(c))}"${playAttrs(c)} aria-label="Play: ${esc(c.title)}">${inner}${previewVideo(c.hoverPreview)}<span class="play-o" aria-hidden="true"></span>${extra}</a>`;
}

function clipTile(slug) {
  const c = clipBySlug.get(slug);
  if (!c) { console.warn(`story clip slug not in manifest: ${slug}`); return ''; }
  return `            ${mplay(c, `<img src="${esc(c.poster)}" alt="${esc(c.title)}" loading="lazy">`, `<span class="cl">Watch: ${esc(c.title)}</span>`)}`;
}

const articles = stories.map((s) => {
  let still = '';
  if (s.still) {
    const img = `<img src="${esc(s.still.src)}" alt="${esc(s.still.alt ?? s.title)}" loading="lazy"${s.still.pos ? ` style="object-position:${esc(s.still.pos)}"` : ""}>`;
    // still.clip: this frame comes from a published clip; the whole still plays it.
    // still.preview (without clip): self-derived motion, same grammar as media rows
    const body = s.still.clip ? mplay(clipOrDie(s.still.clip, `story ${s.id} still`), img)
      : s.still.preview ? `<span class="m-prev" data-preview="${esc(s.still.preview)}">${img}</span>` : img;
    still = `          <figure class="still reveal">${body}<figcaption class="cap">${esc(s.still.cap ?? '')}</figcaption></figure>\n`;
  }
  // media rows: each entry may set after:<paragraph index> (default 1)
  function renderRow(items) {
    if (!items.length) return '';
    const soloImg = items.length === 1 && (!items[0].type || items[0].type === 'img');
    return `          <div class="media-row reveal${soloImg ? ' solo' : ''}">\n${items.map((m) => {
        if (m.type === 'headline')
          return `            <a class="clipcard" href="${esc(m.url)}" target="_blank" rel="noopener"><span class="co">${esc(m.outlet)}</span><span class="ch">${esc(m.headline)}</span>${m.excerpt ? `<span class="ce">${esc(m.excerpt)}</span>` : ''}<span class="cd">${esc(m.date)} ↗</span></a>`;
        if (m.type === 'chips')
          return `            <div class="chipscard"><span class="co">${esc(m.title)}</span><div class="chipset">${m.items.map((i) => `<span class="orgchip">${esc(i)}</span>`).join('')}</div></div>`;
        if (m.type === 'term')
          return `            <div class="termcard"><span class="tc-bar">${esc(m.title)}</span><pre class="tc-body">${esc(m.lines.join('\n'))}</pre></div>`;
        const cls = ['mcard', soloImg ? 'wide' : '', m.fit === 'contain' ? 'book' : '', m.tall ? 'tall' : ''].filter(Boolean).join(' ');
        const style = m.pos ? ` style="object-position:${esc(m.pos)}"` : '';
        // m.clip: the image IS a frame from that published clip; the tile
        // becomes an in-page player (theater on click, contained hover preview).
        // m.preview (without clip): self-derived motion only, e.g. generated
        // illustrations whose hover loop is a cinemagraph of the same image;
        // m.previewLabel overrides the badge text
        const img = `<img src="${esc(m.src)}" alt="${esc(m.alt ?? '')}" loading="lazy"${style}>`;
        const label = m.previewLabel ? ` data-plabel="${esc(m.previewLabel)}"` : '';
        const body = m.clip
          ? mplay(clipOrDie(m.clip, `story ${s.id} media ${m.src}`), img)
          : m.preview ? `<span class="m-prev" data-preview="${esc(m.preview)}"${label}>${img}</span>` : img;
        return `            <figure class="${cls}">${body}<figcaption class="mcap">${esc(m.cap ?? '')}</figcaption></figure>`;
      }).join('\n')}\n          </div>\n`;
  }
  // stories-02: when a still opens the case, the first media row hoists
  // to sit directly under it, so panel + still + tray read as one spread
  const rowsAfter = (idx) => {
    if (s.still && idx === 1) return '';
    return renderRow((s.media ?? []).filter((m) => (m.after ?? 1) === idx));
  };
  const hoistedRow = s.still ? renderRow((s.media ?? []).filter((m) => (m.after ?? 1) === 1)) : '';
  const paras = s.body.map((p, i) => {
    // the opening paragraph carries the panel that overlaps the still's
    // top edge (class only exists when a still follows)
    const pCls = (i === 0 && s.still) ? 'reveal lead-p' : 'reveal';
    const para = (i === s.body.length - 1 && s.pull)
      ? `          <div class="pull reveal">${esc(s.pull)}</div>\n          <p class="${pCls}">${md(p)}</p>`
      : `          <p class="${pCls}">${md(p)}</p>`;
    const row = rowsAfter(i);
    if (i === 0) return `${para}\n${still}${hoistedRow}${row}`;
    return row ? `${para}\n${row}` : para;
  }).join('\n');
  const clipsHtml = s.clipSlugs?.length
    ? `\n          <div class="clips reveal">\n${s.clipSlugs.map(clipTile).filter(Boolean).join('\n')}\n          </div>`
    : '';
  // optional on-camera divider rendered before this story's article
  const okStr = (v) => typeof v === 'string' && v.trim().length > 0;
  if (s.oncam && (!okStr(s.oncam.src) || !okStr(s.oncam.alt))) {
    console.error(`story ${s.id}: oncam src and alt must be non-empty strings`); process.exit(1);
  }
  const oncam = s.oncam
    ? `        <figure class="oncam oncam--divider reveal">
          <img src="${esc(s.oncam.src)}" alt="${esc(s.oncam.alt)}" loading="lazy">
          <figcaption class="oncam-cap">${esc(s.oncam.cap ?? '')}</figcaption>
        </figure>\n\n`
    : '';
  // stories-03: kick + title ride a per-case band that pins inside the
  // article; the page JS compresses it once stuck
  const inner = `        <article class="story" id="${esc(s.id)}">
          <div class="case-band">
            <div class="kick reveal">${esc(s.kicker)}</div>
            <h2 class="reveal">${esc(s.title)}</h2>
          </div>
${paras}${clipsHtml}
        </article>`;
  if (!s.compact) return oncam + inner;
  return `${oncam}        <details class="story-fold">
          <summary><span class="sf-kick">${esc(s.kicker)}</span><span class="sf-title">${esc(s.title)}</span><span class="sf-more">read</span></summary>
${inner}
        </details>`;
}).join('\n\n');

const index = stories.map((s) => `        <a href="#${esc(s.id)}">${esc(s.title)}</a>`).join('\n');

let page = readFileSync(PAGE, 'utf8');
page = page.replace(/<!-- STORIES:START -->[\s\S]*?<!-- STORIES:END -->/, `<!-- STORIES:START -->\n${articles}\n        <!-- STORIES:END -->`);
page = page.replace(/<!-- STINDEX:START -->[\s\S]*?<!-- STINDEX:END -->/, `<!-- STINDEX:START -->\n${index}\n        <!-- STINDEX:END -->`);
writeFileSync(PAGE, page);
console.log(`baked stories.html: ${stories.length} stories`);
