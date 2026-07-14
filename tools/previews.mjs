#!/usr/bin/env node
// Generate 4s silent hover-preview loops for Start-here clips only.
// Reads previewStart per clip; writes assets/previews/<slug>.mp4 and sets
// hoverPreview in clips.json. Skips clips whose media.local is not under media/
// (e.g. the picture-lock tile, which already ships its own short as the preview).
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, '..');
const SRC_DIR = resolve(process.env.HOME, 'Downloads/VIDEOS');
const OUT_DIR = resolve(SITE, 'assets/previews');
mkdirSync(OUT_DIR, { recursive: true });

const manifestPath = resolve(SITE, 'assets/site-data/clips.json');
const m = JSON.parse(readFileSync(manifestPath, 'utf8'));

let made = 0, skipped = 0;
for (const c of m.clips) {
  if (!c.published || !c.startHere || !c.sourceFile) { continue; }
  const src = resolve(SRC_DIR, c.sourceFile);
  const out = resolve(OUT_DIR, `${c.slug}.mp4`);
  if (existsSync(out) && statSync(out).size > 0) { c.hoverPreview = `assets/previews/${c.slug}.mp4`; skipped++; continue; }
  const res = spawnSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-ss', String(c.previewStart ?? Math.round(c.durationSec * 0.25)), '-t', '4', '-i', src, '-an',
    '-vf', 'scale=w=640:h=360:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=24',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', out,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (res.status === 0) {
    c.hoverPreview = `assets/previews/${c.slug}.mp4`;
    made++;
    console.log(`${c.slug}: ${(statSync(out).size / 1024).toFixed(0)}KB`);
  } else {
    console.error(`FAIL ${c.slug}`);
  }
}
writeFileSync(manifestPath, JSON.stringify(m, null, 2) + '\n');
console.log(`previews: ${made} made, ${skipped} already present; manifest updated`);
