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
  const paras = s.body.map((p, i) =>
    (i === s.body.length - 1 && s.pull)
      ? `          <div class="pull reveal">${esc(s.pull)}</div>\n          <p class="reveal">${esc(p)}</p>`
      : `          <p class="reveal">${esc(p)}</p>`
  ).join('\n');
  const clipsHtml = s.clipSlugs?.length
    ? `\n          <div class="clips reveal">\n${s.clipSlugs.map(clipTile).filter(Boolean).join('\n')}\n          </div>`
    : '';
  return `        <article class="story" id="${esc(s.id)}">
          <div class="kick reveal">${esc(s.kicker)}</div>
          <h2 class="reveal">${esc(s.title)}</h2>
${paras}${clipsHtml}
        </article>`;
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
