#!/usr/bin/env node
// Sync the latest Substack essays into writing.html (writing-02 pipeline).
//
// Fetches https://storytellermitch.substack.com/feed, writes
// assets/site-data/writing.json, and bakes:
//   - the featured-essay hero card between <!-- WRITING:FEAT:START/END -->
//   - the earlier-essays list between  <!-- WRITING:LIST:START/END -->
// using the same throwing splice() pattern as build-archive.mjs (a missing
// marker fails loud instead of shipping a stale page).
//
// Network-failure tolerant: on any fetch/parse error it exits 0 with a
// warning and leaves the last baked state untouched (deploy.sh relies on
// this). Em dashes in ingested titles/excerpts are scrubbed (site-wide ban;
// verify.mjs would fail the census otherwise).
//
// launchd invocation (heartbeat convention: absolute paths, nohup-wrapper,
// zsh $status is read-only so do not name a variable "status"):
//   /usr/local/bin/node /Users/mitchellwilliams/Documents/storytellermitch-site/tools/substack-sync.mjs
// wrap via the nohup-wrapper used by the heartbeat plists on macOS Tahoe.
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = resolve(SITE, 'writing.html');
const DATA = resolve(SITE, 'assets/site-data/writing.json');
const FEED = 'https://storytellermitch.substack.com/feed';
// Card descriptions render under a 3-line clamp (.ec-d, ~48 chars/line at
// the two-up card width); a straight word cut clips mid-sentence inside
// that clamp. Budget in characters so the excerpt both ends on a sentence
// boundary AND fits the visible box.
const EXCERPT_CHARS = 150;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// outward copy rides the site-wide em-dash ban (the dash appears only
// as a \u2014 escape so the census never flags this file)
const scrub = (s) => String(s ?? '').replace(/\s*\u2014\s*/g, ', ').replace(/\u2014/g, ', ');
const cdata = (s) => { const m = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(String(s ?? '').trim()); return m ? m[1] : String(s ?? '').trim(); };
// Substack truncates the RSS <description> (the subhead) at ~200 chars,
// frequently mid-word ("...getting wro"). Left as-is it stitches a broken
// word into the featured excerpt, so trim back to the last complete
// sentence; if the subhead carries no sentence break at all, drop only the
// dangling partial token. A subhead that already ends cleanly is untouched.
const detruncate = (s) => {
  s = String(s ?? '').trim();
  if (!s || /[.!?…"')\]]$/.test(s)) return s;
  const cut = s.replace(/[^.!?…]*$/, '').trim();
  return cut || s.replace(/\s*\S+$/, '').trim();
};
// Accumulate whole sentences while they fit the clamp budget, so cards
// never clip mid-sentence; only when the first sentence alone overflows
// the budget do we fall back to a word cut with an ellipsis.
const clampExcerpt = (s) => {
  s = String(s ?? '').trim();
  if (s.length <= EXCERPT_CHARS) return s;
  // Sticky-anchored scan: every sentence must start exactly where the last
  // one ended. An unanchored match() would skip an unmatchable prefix
  // ("Version 1.2 is stable.") and open the excerpt mid-token ("2 is
  // stable."). Closing-quote class includes the curly variants feeds emit.
  const re = /[^.!?…]+[.!?…]+["')\]”’]*(?:\s+|$)/y;
  let out = '';
  while (re.lastIndex < s.length) {
    const m = re.exec(s);
    if (!m) break;
    if ((out + m[0]).trim().length > EXCERPT_CHARS) break;
    out += m[0];
  }
  out = out.trim();
  if (out) return out;
  let cut = '';
  for (const w of s.split(/\s+/).filter(Boolean)) {
    if (`${cut} ${w}`.trim().length > EXCERPT_CHARS - 2) break;
    cut = `${cut} ${w}`.trim();
  }
  // a single token longer than the whole budget still gets a char prefix
  if (!cut) cut = s.slice(0, EXCERPT_CHARS - 2).trimEnd();
  return `${cut} …`;
};
const stripHtml = (s) => String(s ?? '')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#8217;|&rsquo;/g, "'").replace(/&#8216;|&lsquo;/g, "'")
  .replace(/&#8220;|&ldquo;/g, '"').replace(/&#8221;|&rdquo;/g, '"')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, ' ')
  .replace(/\s+/g, ' ').trim();

function parseItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const tag = (name) => {
      const t = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(block);
      return t ? cdata(t[1]) : '';
    };
    const title = scrub(stripHtml(tag('title')));
    const link = tag('link');
    const pub = tag('pubDate');
    const sub = detruncate(scrub(stripHtml(tag('description'))));
    const body = scrub(stripHtml(tag('content:encoded')));
    if (!title || !link) continue;
    const combined = (sub ? sub + ' ' : '') + body;
    const excerpt = clampExcerpt(combined);
    items.push({ title, link, date: pub ? new Date(pub).toISOString() : null, excerpt });
  }
  return items;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
// compact card label, e.g. "Essay · Substack · Jul 2026 · #02"
const cardLabel = (iso, num) => {
  const d = iso ? new Date(iso) : new Date();
  return `Essay · Substack · ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()} · #${String(num).padStart(2, '0')}`;
};

function splice(src, re, replacement, what) {
  if (!re.test(src)) throw new Error(`substack-sync: ${what} not found in writing.html: refusing to write a stale bake`);
  return src.replace(re, replacement);
}

async function main() {
  let xml;
  try {
    const res = await fetch(FEED, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'storytellermitch-site sync' } });
    if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
    xml = await res.text();
  } catch (e) {
    console.warn(`substack-sync: feed fetch failed (${e.message}); keeping the last baked state`);
    process.exit(0);
  }
  let posts;
  try {
    posts = parseItems(xml);
    if (!posts.length) throw new Error('no items parsed');
  } catch (e) {
    console.warn(`substack-sync: feed parse failed (${e.message}); keeping the last baked state`);
    process.exit(0);
  }
  // numeric-epoch sort; a missing/unparseable pubDate sinks to the end
  // instead of accidentally winning the featured slot
  const epoch = (d) => { const t = Date.parse(d); return Number.isNaN(t) ? -Infinity : t; };
  posts.sort((a, b) => epoch(b.date) - epoch(a.date));

  let prevData = null;
  if (existsSync(DATA)) {
    // refuse to proceed if the existing state cannot be snapshotted:
    // overwriting a file we could not read risks losing it on rollback
    prevData = readFileSync(DATA);
  }

  // carry-forward series numbering: Substack's RSS only exposes a recent
  // window, so posts.length is the feed size, not the issue number. Known
  // links keep their baked number from the last writing.json; unseen posts
  // count up from the highest known number, oldest first.
  const knownNum = new Map();
  if (prevData !== null) {
    try {
      for (const p of JSON.parse(String(prevData)).posts) if (p.link && p.num) knownNum.set(p.link, p.num);
    } catch { /* unparseable previous json: number from scratch */ }
  }
  let maxNum = Math.max(0, ...knownNum.values());
  for (const p of [...posts].sort((a, b) => epoch(a.date) - epoch(b.date))) {
    p.num = knownNum.get(p.link) ?? ++maxNum;
  }

  // no-op guard, before any page work: if the parsed posts match the
  // last bake, leave both files untouched (otherwise the churning
  // fetched-timestamp would make deploy.sh commit a noise bake on
  // every deploy)
  if (prevData !== null) {
    try {
      const prev = JSON.parse(String(prevData));
      if (JSON.stringify(prev.posts) === JSON.stringify(posts)) {
        console.log(`substack-sync: no changes (${posts.length} post${posts.length === 1 ? '' : 's'}, latest: ${posts[0].title})`);
        return;
      }
    } catch { /* unparseable previous json: fall through and rewrite */ }
  }

  // uniform equal-weight essay cards, newest first. The newest VISIBLE_CARDS
  // stay in the open grid; any older essays fold into a native <details>
  // disclosure so the section stays finite and scannable as the weekly
  // series grows (no infinite scroll).
  const VISIBLE_CARDS = 6;
  const card = (p) => `      <a class="ecard" href="${esc(p.link)}" target="_blank" rel="noopener">
        <span class="ec-k">${esc(cardLabel(p.date, p.num))}</span>
        <strong class="ec-t">${esc(p.title)}</strong>
        <span class="ec-d">${esc(p.excerpt)}</span>
        <span class="ec-cta">Read on Substack &#8599;</span>
      </a>`;
  const head = posts.slice(0, VISIBLE_CARDS);
  const tail = posts.slice(VISIBLE_CARDS);
  const cardsHtml = `<!-- WRITING:CARDS:START -->
    <div class="essay-cards reveal">
${head.map(card).join('\n')}
    </div>${tail.length ? `
    <details class="essay-more reveal">
      <summary>Show older essays (${tail.length})</summary>
      <div class="essay-cards">
${tail.map(card).join('\n')}
      </div>
    </details>` : ''}
    <!-- WRITING:CARDS:END -->`;

  // splice first, persist after: a missing marker throws before either
  // file is touched, so json and page can never go inconsistent
  let page = readFileSync(PAGE, 'utf8');
  page = splice(page, /<!-- WRITING:CARDS:START -->[\s\S]*?<!-- WRITING:CARDS:END -->/, cardsHtml, 'WRITING:CARDS markers');
  // best-effort pair consistency: each artifact lands via temp+rename
  // (atomic per file), the page renames first, and a failed second
  // rename restores the page from its snapshot. A torn state remains
  // theoretically possible (kill between renames), but both artifacts
  // are git-tracked, so any divergence is visible in git diff and one
  // checkout away from recovery.
  const dataOut = JSON.stringify({ fetched: new Date().toISOString(), feed: FEED, posts }, null, 2) + '\n';
  const pageBak = PAGE + '.bak';
  writeFileSync(pageBak, readFileSync(PAGE));
  writeFileSync(PAGE + '.tmp', page);
  writeFileSync(DATA + '.tmp', dataOut);
  renameSync(PAGE + '.tmp', PAGE);
  try {
    renameSync(DATA + '.tmp', DATA);
    unlinkSync(pageBak);
  } catch (e) {
    renameSync(pageBak, PAGE); // rollback is itself an atomic rename
    throw e;
  }
  console.log(`substack-sync: baked ${posts.length} post${posts.length === 1 ? '' : 's'} (newest: ${posts[0].title})`);
}

// template regressions (missing markers) exit 1 so deploy.sh logs them
// distinctly from tolerated network failures (which exit 0 above)
main().catch((e) => { console.error(`substack-sync: ${e.message}`); process.exit(1); });
