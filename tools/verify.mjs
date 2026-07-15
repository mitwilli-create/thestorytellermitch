#!/usr/bin/env node
// Deterministic site verifier. Zero dependencies, zero network, zero LLM.
// Run: node tools/verify.mjs   (exit 0 = all invariants hold)
// Gates, in order:
//   1. bake-drift: stories.html and work.html must be byte-identical to a
//      fresh bake from their JSON (catches hand-edits of baked regions)
//   2. em-dash census: 0 em dashes across html/css/site-data/tools/srt
//      (the one detector line in build-stories.mjs is the sole exemption)
//   3. asset references: every local src/href/poster in *.html resolves to
//      a file on disk (media/ is exempt: gitignored self-host payloads)
//   4. site-data parse: clips.json + stories.json parse and carry the
//      fields the bakers depend on
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fail = [];
const ok = (m) => console.log('  ok  ' + m);

// ---- 1. bake-drift ---------------------------------------------------
for (const [baker, artifact] of [['build-stories.mjs', 'stories.html'], ['build-archive.mjs', 'work.html']]) {
  const before = readFileSync(resolve(SITE, artifact), 'utf8');
  execFileSync(process.execPath, [resolve(SITE, 'tools', baker)], { cwd: SITE, stdio: 'pipe' });
  const after = readFileSync(resolve(SITE, artifact), 'utf8');
  if (before === after) ok(`bake-drift ${artifact} matches ${baker} output`);
  else fail.push(`bake-drift: ${artifact} differs from a fresh ${baker} bake. Baked regions were hand-edited or the JSON changed without a re-bake. Diff is now in the working tree; inspect with: git diff -- ${artifact}`);
}

// ---- 2. em-dash census -----------------------------------------------
const censusFiles = [];
// Directories with no deployable .html (or that we never census): skipped by the recursive walk.
const IGNORE_DIRS = new Set(['.git', 'node_modules', '.claude', '.wrangler', 'media', 'design', 'output']);
const push = (dir, re) => { for (const f of readdirSync(resolve(SITE, dir))) if (re.test(f)) censusFiles.push((dir ? dir + '/' : '') + f); };
// Recursive: root-level *.html plus subdirectory pages (docs/, resume/) all get censused.
const walk = (dir, re) => { for (const ent of readdirSync(resolve(SITE, dir), { withFileTypes: true })) {
  const rel = (dir ? dir + '/' : '') + ent.name;
  if (ent.isDirectory()) { if (!IGNORE_DIRS.has(ent.name)) walk(rel, re); }
  else if (re.test(ent.name)) censusFiles.push(rel);
} };
walk('', /\.html$/); push('shared', /\.(css|js)$/); push('assets/site-data', /\.json$/); push('tools', /\.mjs$/); push('assets', /\.srt$/);
const EM = String.fromCharCode(0x2014); // constructed so this file stays census-clean
let dashHits = 0;
for (const f of censusFiles) {
  const lines = readFileSync(resolve(SITE, f), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!line.includes(EM)) return;
    if (f === 'tools/build-stories.mjs' && line.includes('blob.includes(')) return; // the detector itself
    dashHits++; fail.push(`em-dash: ${f}:${i + 1}`);
  });
}
if (!dashHits) ok(`em-dash census clean across ${censusFiles.length} files`);

// ---- 3. asset references ----------------------------------------------
let refCount = 0, refBad = 0;
const MEDIA = resolve(SITE, 'media');
const under = (p, root) => p === root || p.startsWith(root + sep);
for (const f of censusFiles.filter((f) => f.endsWith('.html'))) {
  const fileDir = dirname(resolve(SITE, f)); // resolve refs relative to the page, so ../ paths in docs/ + resume/ work
  const html = readFileSync(resolve(SITE, f), 'utf8');
  for (const m of html.matchAll(/(?:src|href|poster)="([^"#][^"]*)"/g)) {
    const url = m[1];
    // skip external / non-file schemes; // is protocol-relative (also external)
    if (/^(https?:|mailto:|tel:|data:|\/\/|back$|forward$)/.test(url)) continue;
    const path = url.split('#')[0].split('?')[0];
    // root-relative (/x) resolves under SITE; page-relative (x, ../x) resolves against the page dir
    const abs = path.startsWith('/') ? resolve(SITE, path.replace(/^\/+/, '')) : resolve(fileDir, path);
    if (under(abs, MEDIA)) continue; // gitignored self-host payloads
    refCount++;
    // anything resolving outside SITE is not a deployable asset -> treat as missing
    if (!under(abs, SITE) || !existsSync(abs)) { refBad++; fail.push(`asset-ref: ${f} references missing ${path}`); }
  }
}
if (!refBad) ok(`asset references resolve (${refCount} local refs)`);

// ---- 4. site-data parse -----------------------------------------------
try {
  const clips = JSON.parse(readFileSync(resolve(SITE, 'assets/site-data/clips.json'), 'utf8'));
  const missing = clips.clips.filter((c) => !c.slug || !c.title || !c.bucket);
  if (missing.length) fail.push(`clips.json: ${missing.length} clips missing slug/title/bucket`);
  else ok(`clips.json parses (${clips.clips.length} clips)`);
  const stories = JSON.parse(readFileSync(resolve(SITE, 'assets/site-data/stories.json'), 'utf8'));
  const badStories = stories.stories.filter((s) => !s.id || !s.title || !Array.isArray(s.body));
  if (badStories.length) fail.push(`stories.json: ${badStories.length} stories missing id/title/body`);
  else ok(`stories.json parses (${stories.stories.length} stories)`);
} catch (e) { fail.push('site-data parse: ' + e.message); }

// ---- verdict ------------------------------------------------------------
if (fail.length) {
  console.error('\nVERIFY FAILED (' + fail.length + '):');
  for (const f of fail) console.error('  FAIL ' + f);
  process.exit(1);
}
console.log('\nverify: all invariants hold');
