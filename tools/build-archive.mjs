#!/usr/bin/env node
// Bake clips.json into work.html between <!-- ARCHIVE:START/END --> and
// <!-- FILTERS:START/END --> markers. Also sets body[data-playback] + data-stream-code.
// Data-only site changes = edit clips.json, re-run this, commit.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = resolve(SITE, 'work.html');
const m = JSON.parse(readFileSync(resolve(SITE, 'assets/site-data/clips.json'), 'utf8'));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function nojsHref(c) {
  if (c.media.youtubeId) return `https://www.youtube.com/watch?v=${c.media.youtubeId}`;
  if (m.playback === 'stream' && c.media.streamId)
    return `https://customer-${m.streamCustomerCode}.cloudflarestream.com/${c.media.streamId}/watch`;
  return c.media.local;
}

function tile(c, sizeClass, inBucket) {
  const tag = `${c.outletLabel} · ${c.type} · ${c.year}`;
  const pick = inBucket && c.startHere ? '<span class="pick-mark">start-here pick</span>' : '';
  const preview = c.hoverPreview
    ? `\n    <video class="preview" preload="none" muted loop playsinline data-src="${esc(c.hoverPreview)}" poster="${esc(c.poster)}"></video>`
    : '';
  return `  <a class="film ${sizeClass} reveal" href="${esc(nojsHref(c))}"
     data-clip="${esc(c.slug)}" data-bucket="${esc(c.bucket)}" data-outlet="${esc(c.outlet)}" data-era="${esc(c.era)}"
     data-tag="${esc(tag)}" data-title="${esc(c.title)}" data-sub="${esc(c.subtitle)}"
     data-poster="${esc(c.poster)}" data-local="${esc(c.media.local)}" data-stream-id="${esc(c.media.streamId ?? '')}"${c.media.youtubeId ? ` data-youtube-id="${esc(c.media.youtubeId)}"` : ''}${c.caseStudy ? ` data-case="${esc(c.caseStudy)}"` : ''}>
    <img class="thumb" src="${esc(c.poster)}" alt="${esc(c.title)}" loading="lazy" decoding="async">${preview}
    <div class="play-o"></div>
    <div class="meta">
      <div class="m-tag">${esc(tag)}${pick}</div>
      <div class="m-title">${esc(c.title)}</div>
      <div class="m-stat">${esc(c.duration)}</div>
    </div>
  </a>`;
}

const pub = m.clips.filter((c) => c.published);

// ---- start-here row ----
const start = pub.filter((c) => c.startHere).sort((a, b) => a.startHereRank - b.startHereRank);
const startHtml = `<section class="starthere" id="starthere">
  <div class="wrap">
    <div class="sec-head reveal">
      <span class="sec-num">00</span>
      <h2 class="sec-title">Start here</h2>
      <span class="sec-note">Eight pieces that explain the whole arc</span>
    </div>
    <div class="film-grid">
${start.map((c, i) => tile(c, i < 2 ? 'half' : 'third')).join('\n')}
    </div>
  </div>
</section>`;

// ---- bucket sections ----
const sectionsHtml = m.buckets.map((b) => {
  const clips = pub
    .filter((c) => c.bucket === b.key)
    .sort((a, b2) => String(a.year).localeCompare(String(b2.year)) || a.title.localeCompare(b2.title));
  if (!clips.length) return '';
  // optional on-camera figure rendered above the bucket's section head
  const oncam = b.oncam
    ? `    <figure class="oncam oncam--divider reveal" style="margin:0 0 48px">
      <img src="${esc(b.oncam.src)}" alt="${esc(b.oncam.alt)}" loading="lazy">
      <figcaption class="oncam-cap">${esc(b.oncam.cap ?? '')}</figcaption>
    </figure>\n`
    : '';
  return `<section class="bucket" data-bucket="${b.key}" id="${b.key}">
  <div class="wrap">
${oncam}    <div class="sec-head reveal">
      <span class="sec-num">${b.num}</span>
      <h2 class="sec-title">${esc(b.label)}</h2>
      <span class="sec-count">${clips.length}${clips.length === 1 ? ' piece' : ' pieces'}</span>${b.note ? `
      <span class="sec-note">${esc(b.note)}</span>` : ''}
    </div>
    <div class="film-grid">
${clips.map((c) => tile(c, 'third', true)).join('\n')}
    </div>
  </div>
</section>`;
}).filter(Boolean).join('\n\n');

// ---- filter chips ----
const usedOutlets = new Set(pub.map((c) => c.outlet));
const usedEras = new Set(pub.map((c) => c.era));
const chipGroup = (group, label, items) => `    <div class="chip-group" data-filter-group="${group}" role="group" aria-label="Filter by ${label}">
      <span class="cg-label">${label}</span>
      <button class="chip is-active" data-value="*" aria-pressed="true">All</button>
${items.map((i) => `      <button class="chip" data-value="${esc(i.key)}" aria-pressed="false">${esc(i.label)}</button>`).join('\n')}
    </div>`;
const filtersHtml = [
  chipGroup('outlet', 'Outlet', m.outlets.filter((o) => usedOutlets.has(o.key))),
  chipGroup('era', 'Years', m.eras.filter((e) => usedEras.has(e.key))),
].join('\n');

// ---- splice ----
let page = readFileSync(PAGE, 'utf8');
// fail loud if any splice target is missing: a silent no-op ships a stale archive
function splice(src, re, replacement, what) {
  if (!re.test(src)) throw new Error(`build-archive: ${what} not found in work.html: refusing to write a stale bake`);
  return src.replace(re, replacement);
}
page = splice(page, /<!-- ARCHIVE:START -->[\s\S]*?<!-- ARCHIVE:END -->/,
  `<!-- ARCHIVE:START -->\n${startHtml}\n\n${sectionsHtml}\n<!-- ARCHIVE:END -->`, 'ARCHIVE markers');
page = splice(page, /<!-- FILTERS:START -->[\s\S]*?<!-- FILTERS:END -->/,
  `<!-- FILTERS:START -->\n${filtersHtml}\n    <!-- FILTERS:END -->`, 'FILTERS markers');
page = splice(page, /<body data-playback="[^"]*" data-stream-code="[^"]*">/,
  `<body data-playback="${m.playback}" data-stream-code="${m.streamCustomerCode ?? ''}">`, 'body playback attributes');
writeFileSync(PAGE, page);

console.log(`baked work.html: ${start.length} start-here + ${pub.length} published tiles across ${m.buckets.length} buckets (playback=${m.playback})`);
