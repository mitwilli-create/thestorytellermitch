#!/usr/bin/env node
// Extract 4 poster-candidate frames per published clip at 15/35/55/75% of duration
// from the ORIGINAL source files (max quality) into gitignored tools/poster-candidates/.
// Idempotent: skips clips whose candidate dir already has 4 frames.
import { readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, '..');
const SRC_DIR = resolve(process.env.HOME, 'Downloads/VIDEOS');
const CAND_DIR = resolve(HERE, 'poster-candidates');

const manifest = JSON.parse(readFileSync(resolve(SITE, 'assets/site-data/clips.json'), 'utf8'));
const jobs = manifest.clips.filter((c) => c.published && c.sourceFile);

const FRACTIONS = [0.15, 0.35, 0.55, 0.75];
let done = 0, skipped = 0, failed = [];
for (const clip of jobs) {
  const src = resolve(SRC_DIR, clip.sourceFile);
  if (!existsSync(src)) { failed.push([clip.slug, 'source missing']); continue; }
  const dir = resolve(CAND_DIR, clip.slug);
  mkdirSync(dir, { recursive: true });
  if (readdirSync(dir).filter((f) => f.endsWith('.jpg')).length === 4) { skipped++; continue; }
  let ok = true;
  FRACTIONS.forEach((f, i) => {
    const t = Math.max(1, Math.floor(clip.durationSec * f));
    const res = spawnSync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-ss', String(t), '-i', src, '-frames:v', '1',
      '-vf', 'scale=w=1280:h=720:force_original_aspect_ratio=decrease:force_divisible_by=2',
      '-qscale:v', '5', resolve(dir, `c${i + 1}.jpg`),
    ], { stdio: ['ignore', 'ignore', 'inherit'] });
    if (res.status !== 0) ok = false;
  });
  ok ? done++ : failed.push([clip.slug, 'frame extraction failed']);
  if ((done + skipped) % 10 === 0) console.log(`progress: ${done + skipped}/${jobs.length}`);
}
console.log(`posters: ${done} extracted, ${skipped} skipped, ${failed.length} failed`);
for (const [slug, why] of failed) console.log(`  FAILED ${slug}: ${why}`);
process.exit(failed.length ? 1 : 0);
