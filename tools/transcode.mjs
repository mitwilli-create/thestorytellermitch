#!/usr/bin/env node
// Batch-transcode source clips to web MP4s in gitignored media/.
// Two-tier ladder:
//   Tier S (<=10min): 1080p cap, x264 CRF 22, maxrate 2M, AAC 128k, preset slow
//   Tier L (>10min):  720p cap,  x264 CRF 23, maxrate 1M, AAC 96k,  preset medium
//     (medium on Tier L: talking-head long-form at CRF 23/720p is visually
//      indistinguishable from slow, and it halves a multi-hour batch)
// Idempotent: skips outputs that already exist and are non-empty.
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, '..');
const SRC_DIR = resolve(process.env.HOME, 'Downloads/VIDEOS');
const OUT_DIR = resolve(SITE, 'media');
mkdirSync(OUT_DIR, { recursive: true });

const manifest = JSON.parse(readFileSync(resolve(SITE, 'assets/site-data/clips.json'), 'utf8'));
// shortest-first so the bulk of the archive becomes playable soonest
const jobs = manifest.clips.filter((c) => c.published && c.sourceFile)
  .sort((a, b) => a.durationSec - b.durationSec);

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

let done = 0, skipped = 0, failed = [];
const t0 = Date.now();
for (const clip of jobs) {
  if (only && clip.slug !== only) continue;
  const src = resolve(SRC_DIR, clip.sourceFile);
  const out = resolve(OUT_DIR, `${clip.slug}.mp4`);
  if (!existsSync(src)) { failed.push([clip.slug, 'source missing']); continue; }
  if (existsSync(out) && statSync(out).size > 0) { skipped++; continue; }

  const tierS = clip.durationSec <= 600;
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', src,
    '-c:v', 'libx264',
    '-preset', tierS ? 'slow' : 'medium',
    '-crf', tierS ? '22' : '23',
    '-maxrate', tierS ? '2000k' : '1000k',
    '-bufsize', tierS ? '4000k' : '2000k',
    '-vf', tierS
      ? 'scale=w=1920:h=1080:force_original_aspect_ratio=decrease:force_divisible_by=2'
      : 'scale=w=1280:h=720:force_original_aspect_ratio=decrease:force_divisible_by=2',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', tierS ? '4.1' : '4.0',
    '-c:a', 'aac', '-b:a', tierS ? '128k' : '96k', '-ac', '2', '-ar', '48000',
    '-movflags', '+faststart',
    out,
  ];
  const started = Date.now();
  const res = spawnSync('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (res.status === 0) {
    done++;
    const mb = (statSync(out).size / 1048576).toFixed(1);
    console.log(`[${done + skipped}/${jobs.length}] ${clip.slug} tier=${tierS ? 'S' : 'L'} ${mb}MB ${((Date.now() - started) / 1000).toFixed(0)}s`);
  } else {
    failed.push([clip.slug, `ffmpeg exit ${res.status}`]);
    console.error(`FAIL ${clip.slug}: ffmpeg exit ${res.status}`);
  }
}
console.log(`\ntranscode complete: ${done} encoded, ${skipped} skipped, ${failed.length} failed in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
for (const [slug, why] of failed) console.log(`  FAILED ${slug}: ${why}`);
process.exit(failed.length ? 1 : 0);
