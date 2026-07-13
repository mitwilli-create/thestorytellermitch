#!/usr/bin/env node
// One-shot: regenerate the timeline hero as an 8s steady-state loop
// (fill-timeline-c). Mitchell 2026-07-12: the 3.4s fill-timeline-b cycle
// reads as resetting; apply the projects-hero 8s perpetual-motion recipe.
// Gates: seam scdet <2 at the cycle boundary, palette vs the approved
// still, luma flat across the cycle, montage written for eyes-on review.
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fal from './lib/fal.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
const STILL = resolve(SITE, 'assets/stills/fill-timeline-hd.jpg'); // approved master (timeline-c-cand1)
const work = resolve(SITE, 'design/timeline-c-hero-candidates/work-8s');
mkdirSync(work, { recursive: true });

const MOTION = 'Perpetual steady-state motion with no beginning and no end, every element already mid-cycle: across the engraved wall of monitors, each screen drifts through its own independent signal pattern on a staggered offset, thin waveforms crawling steadily, chart lines stepping, subtle scanline shimmer moving at different rates per screen, the highlighted center monitor breathing on its own slow rhythm. Continuous, unsynchronized, machine-room motion. Camera locked off. Composition, framing, linework, and palette completely unchanged from the still. No strobing, no flashing, no new elements, no smoke, no camera motion.';

// Veo i2v cannot pad beyond 1376x768: pre-scale the 1920x1072 master
const input = resolve(work, 'input.jpg');
ff(['-i', STILL, '-vf', 'scale=1376:768', '-q:v', '2', input]);
const padded = resolve(work, 'pad.jpg');
ff(['-i', input, '-vf', 'pad=1376:774:0:3:color=0x0a0a0b', '-q:v', '2', padded]);
const dataUri = `data:image/jpeg;base64,${readFileSync(padded).toString('base64')}`;

console.log('[timeline-c] veo3.1 fast i2v 8s...');
const raw = resolve(work, 'raw.mp4');
const vid = await fal.imageToVideo({ prompt: MOTION, imageUrl: dataUri, seconds: 8, outPath: raw, aspectRatio: '16:9', log: () => {} });
console.log(`[timeline-c] req ${vid.requestId} est $${vid.estCostUsd.toFixed(3)}`);
const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', raw], { encoding: 'utf8' }).trim();
console.log('[timeline-c] raw dims:', probe);

// hero-scale plate: rebuild at 1920x1072 from raw (Veo returns 1920x1080)
const cropped = resolve(work, 'cropped.mp4');
const [rw] = probe.split(',').map(Number);
if (rw >= 1920) ff(['-i', raw, '-vf', 'crop=1920:1072:0:4', '-an', '-c:v', 'libx264', '-crf', '14', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', cropped]);
else ff(['-i', raw, '-vf', 'scale=1920:1080,crop=1920:1072:0:4', '-an', '-c:v', 'libx264', '-crf', '14', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', cropped]);

const loopDur = 7.2, xfade = 0.8;
const loop = resolve(work, 'loop.mp4');
ff(['-i', cropped, '-filter_complex',
  `[0:v]split[a][b];[a]trim=end=${loopDur},setpts=PTS-STARTPTS[first];` +
  `[b]trim=start=${loopDur},setpts=PTS-STARTPTS[last];` +
  `[last][first]xfade=transition=fade:duration=${xfade}:offset=0[v]`,
  '-map', '[v]', '-c:v', 'libx264', '-crf', '14', '-preset', 'veryslow', '-pix_fmt', 'yuv420p', loop]);

// seam gate
const doubled = loop.replace('.mp4', '-x2.mp4');
ff(['-stream_loop', '1', '-i', loop, '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', doubled]);
const scoresFile = loop.replace('.mp4', '-scd.txt');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', doubled, '-vf', `scdet=threshold=0,metadata=print:file=${scoresFile}`, '-f', 'null', '-']);
const txt = readFileSync(scoresFile, 'utf8');
const entries = [...txt.matchAll(/pts_time:([\d.]+)[\s\S]*?lavfi\.scd\.score=([\d.]+)/g)].map(m => ({ t: +m[1], score: +m[2] }));
if (!entries.length) { console.error('[timeline-c] scdet produced no parseable scores; refusing to pass an unmeasured seam'); process.exit(2); }
const seam = entries.filter(e => Math.abs(e.t - loopDur) < 0.15).reduce((mx, e) => Math.max(mx, e.score), 0);

// palette vs approved still
const poster = resolve(work, 'poster.jpg');
ff(['-ss', '0', '-i', loop, '-frames:v', '1', '-q:v', '4', poster]);
const palette = JSON.parse(execFileSync('python3', [resolve(SITE, 'tools/lib/palette_check.py'), STILL, poster], { encoding: 'utf8' }).trim());

// luma flatness across the cycle
const lumaOut = execFileSync('ffprobe', ['-f', 'lavfi', `movie=${loop},signalstats`, '-show_entries', 'frame_tags=lavfi.signalstats.YAVG', '-of', 'csv=p=0'], { encoding: 'utf8' });
const ys = lumaOut.trim().split('\n').map(Number).filter(n => !isNaN(n));
const yMin = Math.min(...ys), yMax = Math.max(...ys);

// montage for eyes-on review
const montage = resolve(work, 'montage.png');
ff(['-i', loop, '-vf', `select='eq(n\\,0)+eq(n\\,${Math.round(loopDur * 12)})+eq(n\\,${Math.round(loopDur * 24 - 2)})',scale=480:-1,tile=3x1`, '-frames:v', '1', montage]);

// luma flatness gate: a cycle-wide average-brightness span above ~3.5
// reads as a visible pulse at hero scale (accepted references run 0.1-2.2)
const LUMA_SPAN_MAX = 3.5;
console.log(`[timeline-c] seam=${seam.toFixed(3)} (gate <2) palette=${JSON.stringify(palette)} luma=[${yMin.toFixed(1)},${yMax.toFixed(1)}] (span gate <=${LUMA_SPAN_MAX})`);
if (seam >= 2 || !palette.pass || (yMax - yMin) > LUMA_SPAN_MAX) { console.error('[timeline-c] FAILED gates; inspect ' + work); process.exit(2); }

// encodes: 1920 hero plate + 960w mobile variant, new -c names
const enc = (w, crf264, crfVp9, name) => {
  const mp4 = resolve(SITE, 'assets/cinemagraphs', `${name}.mp4`);
  const webm = resolve(SITE, 'assets/cinemagraphs', `${name}.webm`);
  ff(['-i', loop, '-vf', `scale=${w}:-2`, '-c:v', 'libx264', '-preset', 'veryslow', '-crf', String(crf264), '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', mp4]);
  ff(['-i', loop, '-vf', `scale=${w}:-2`, '-c:v', 'libvpx-vp9', '-crf', String(crfVp9), '-b:v', '0', '-an', webm]);
  console.log(`[timeline-c] ${name}: mp4=${Math.round(statSync(mp4).size / 1024)}KB webm=${Math.round(statSync(webm).size / 1024)}KB`);
};
enc(1920, 23, 40, 'fill-timeline-c-hd');
enc(960, 26, 34, 'fill-timeline-c-loop');
ff(['-ss', '0', '-i', loop, '-frames:v', '1', '-q:v', '3', resolve(SITE, 'assets/stills', 'fill-timeline-c-hd.jpg')]);
console.log('[timeline-c] DONE; montage at', montage);
