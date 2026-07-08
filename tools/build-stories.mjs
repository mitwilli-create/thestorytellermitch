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

// em-dash gate: fail the bake rather than ship one
const blob = JSON.stringify(stories);
if (blob.includes('—')) { console.error('EM DASH found in stories.json — fix before baking'); process.exit(1); }

function clipTile(slug) {
  const c = clipBySlug.get(slug);
  if (!c) { console.warn(`story clip slug not in manifest: ${slug}`); return ''; }
  return `            <a href="work.html#${esc(c.bucket)}"><img src="${esc(c.poster)}" alt="${esc(c.title)}" loading="lazy"><span class="cl">Watch: ${esc(c.title)}</span></a>`;
}

const articles = stories.map((s) => {
  const still = s.still
    ? `          <figure class="still reveal"><img src="${esc(s.still.src)}" alt="${esc(s.still.alt ?? s.title)}" loading="lazy"${s.still.pos ? ` style="object-position:${esc(s.still.pos)}"` : ""}><figcaption class="cap">${esc(s.still.cap ?? '')}</figcaption></figure>\n`
    : '';
  // media rows: each entry may set after:<paragraph index> (default 1)
  function renderRow(items) {
    if (!items.length) return '';
    const soloImg = items.length === 1 && (!items[0].type || items[0].type === 'img');
    return `          <div class="media-row reveal${soloImg ? ' solo' : ''}">\n${items.map((m) => {
        if (m.type === 'headline')
          return `            <a class="clipcard" href="${esc(m.url)}" rel="noopener"><span class="co">${esc(m.outlet)}</span><span class="ch">${esc(m.headline)}</span>${m.excerpt ? `<span class="ce">${esc(m.excerpt)}</span>` : ''}<span class="cd">${esc(m.date)} ↗</span></a>`;
        if (m.type === 'chips')
          return `            <div class="chipscard"><span class="co">${esc(m.title)}</span><div class="chipset">${m.items.map((i) => `<span class="orgchip">${esc(i)}</span>`).join('')}</div></div>`;
        if (m.type === 'term')
          return `            <div class="termcard"><span class="tc-bar">${esc(m.title)}</span><pre class="tc-body">${esc(m.lines.join('\n'))}</pre></div>`;
        const cls = ['mcard', soloImg ? 'wide' : '', m.fit === 'contain' ? 'book' : '', m.tall ? 'tall' : ''].filter(Boolean).join(' ');
        const style = m.pos ? ` style="object-position:${esc(m.pos)}"` : '';
        return `            <figure class="${cls}"><img src="${esc(m.src)}" alt="${esc(m.alt ?? '')}" loading="lazy"${style}><figcaption class="mcap">${esc(m.cap ?? '')}</figcaption></figure>`;
      }).join('\n')}\n          </div>\n`;
  }
  const rowsAfter = (idx) => renderRow((s.media ?? []).filter((m) => (m.after ?? 1) === idx));
  const paras = s.body.map((p, i) => {
    const para = (i === s.body.length - 1 && s.pull)
      ? `          <div class="pull reveal">${esc(s.pull)}</div>\n          <p class="reveal">${esc(p)}</p>`
      : `          <p class="reveal">${esc(p)}</p>`;
    const row = rowsAfter(i);
    if (i === 0) return `${para}\n${still}${row}`;
    return row ? `${para}\n${row}` : para;
  }).join('\n');
  const clipsHtml = s.clipSlugs?.length
    ? `\n          <div class="clips reveal">\n${s.clipSlugs.map(clipTile).filter(Boolean).join('\n')}\n          </div>`
    : '';
  // optional on-camera divider rendered before this story's article
  if (s.oncam && (!s.oncam.src || !s.oncam.alt)) {
    console.error(`story ${s.id}: oncam entry missing src or alt`); process.exit(1);
  }
  const oncam = s.oncam
    ? `        <figure class="oncam oncam--divider reveal">
          <img src="${esc(s.oncam.src)}" alt="${esc(s.oncam.alt)}" loading="lazy">
          <figcaption class="oncam-cap">${esc(s.oncam.cap ?? '')}</figcaption>
        </figure>\n\n`
    : '';
  const inner = `        <article class="story" id="${esc(s.id)}">
          <div class="kick reveal">${esc(s.kicker)}</div>
          <h2 class="reveal">${esc(s.title)}</h2>
${paras}${clipsHtml}
        </article>`;
  if (!s.compact) return oncam + inner;
  return `${oncam}        <details class="story-fold">
          <summary><span class="sf-kick">${esc(s.kicker)}</span><span class="sf-title">${esc(s.title)}</span><span class="sf-more">read</span></summary>
${inner}
        </details>`;
}).join('\n\n');

const index = stories.map((s) => {
  const short = s.title.length > 34 ? s.title.slice(0, 33).replace(/\s+\S*$/, '') + '…' : s.title;
  return `        <a href="#${esc(s.id)}">${esc(short)}</a>`;
}).join('\n');

let page = readFileSync(PAGE, 'utf8');
page = page.replace(/<!-- STORIES:START -->[\s\S]*?<!-- STORIES:END -->/, `<!-- STORIES:START -->\n${articles}\n        <!-- STORIES:END -->`);
page = page.replace(/<!-- STINDEX:START -->[\s\S]*?<!-- STINDEX:END -->/, `<!-- STINDEX:START -->\n${index}\n        <!-- STINDEX:END -->`);
writeFileSync(PAGE, page);
console.log(`baked stories.html: ${stories.length} stories`);
