#!/usr/bin/env node
// Extract wide story-still candidates for stories that have clip links.
// 3 frames per story's primary clip at 20/50/80% (offset from the poster pick)
// into gitignored tools/still-candidates/<storyId>/s1..s3.jpg at 1600w.
import { readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, '..');
const SRC_DIR = resolve(process.env.HOME, 'Downloads/VIDEOS');
const OUT = resolve(HERE, 'still-candidates');

const { stories } = JSON.parse(readFileSync(resolve(SITE, 'assets/site-data/stories.json'), 'utf8'));
const clips = JSON.parse(readFileSync(resolve(SITE, 'assets/site-data/clips.json'), 'utf8'));
const bySlug = new Map(clips.clips.map((c) => [c.slug, c]));

let done = 0;
for (const s of stories) {
  const slug = s.clipSlugs?.[0];
  if (!slug) continue;
  const clip = bySlug.get(slug);
  if (!clip?.sourceFile) continue;
  const src = resolve(SRC_DIR, clip.sourceFile);
  if (!existsSync(src)) continue;
  const dir = resolve(OUT, s.id);
  mkdirSync(dir, { recursive: true });
  if (readdirSync(dir).length >= 3) { done++; continue; }
  [0.2, 0.5, 0.8].forEach((f, i) => {
    const t = Math.max(2, Math.floor(clip.durationSec * f) + 7); // +7s offset dodges the poster frames
    spawnSync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-ss', String(Math.min(t, clip.durationSec - 2)), '-i', src, '-frames:v', '1',
      '-vf', 'scale=w=1600:h=900:force_original_aspect_ratio=decrease:force_divisible_by=2',
      '-qscale:v', '4', resolve(dir, `s${i + 1}.jpg`),
    ], { stdio: ['ignore', 'ignore', 'inherit'] });
  });
  done++;
  console.log(`${s.id} <- ${slug}`);
}
console.log(`story-still candidates for ${done} stories at ${OUT}`);
