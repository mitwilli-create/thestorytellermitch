#!/usr/bin/env node
// Apply poster picks from tools/poster-picks-*.jsonl:
// copy tools/poster-candidates/<slug>/c<pick>.jpg -> assets/posters/<slug>.jpg,
// re-encoding via ffmpeg if the source frame exceeds 80KB.
import { readFileSync, readdirSync, existsSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, '..');
const OUT_DIR = resolve(SITE, 'assets/posters');
mkdirSync(OUT_DIR, { recursive: true });

const picks = new Map();
for (const f of readdirSync(HERE).filter((f) => /^poster-picks-\d+\.jsonl$/.test(f))) {
  for (const line of readFileSync(resolve(HERE, f), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { const o = JSON.parse(t); if (o.slug && o.pick) picks.set(o.slug, o.pick); } catch {}
  }
}

let applied = 0, missing = [], big = 0;
for (const [slug, pick] of picks) {
  const src = resolve(HERE, 'poster-candidates', slug, `c${pick}.jpg`);
  const out = resolve(OUT_DIR, `${slug}.jpg`);
  if (!existsSync(src)) { missing.push(slug); continue; }
  if (statSync(src).size > 80 * 1024) {
    spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-qscale:v', '6', out], { stdio: 'inherit' });
    big++;
  } else {
    copyFileSync(src, out);
  }
  applied++;
}
console.log(`posters applied: ${applied} (${big} re-encoded), picks on file: ${picks.size}, missing candidates: ${missing.join(',') || 'none'}`);

// census against manifest
const m = JSON.parse(readFileSync(resolve(SITE, 'assets/site-data/clips.json'), 'utf8'));
const need = m.clips.filter((c) => c.published && c.sourceFile);
const noPoster = need.filter((c) => !existsSync(resolve(SITE, c.poster)));
console.log(`census: ${need.length - noPoster.length}/${need.length} published clips have posters${noPoster.length ? ' | MISSING: ' + noPoster.map((c) => c.slug).join(',') : ''}`);
