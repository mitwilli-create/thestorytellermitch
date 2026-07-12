#!/usr/bin/env node
// Reusable fill-hero asset generator: candidate stills, then animate a
// chosen still into the site's engraved-technical cinemagraph loop.
// Recipe validated end-to-end on fit-cand-steps.jpg -> fill-fit2-loop
// (2026-07-12): scdet seam 0.05 on a doubled clip, palette-check clean,
// <1MB mp4/webm at 960w. Mirrors broll-pipeline's scripts/_fill-plates.mjs
// but parameterized by page/prompt so it works for any new page.
//
// Usage:
//   node tools/gen-fill-hero.mjs stills --page projects --n 4 \
//     --subject "a wall of small framed project cards feeding into one larger lit frame, isometric"
//   node tools/gen-fill-hero.mjs animate --page projects \
//     --still design/projects-hero-candidates/projects-cand2.jpg \
//     --motion "one framed card's edge glows softly, breathing"
//
// stills   -> writes design/<page>-hero-candidates/<page>-cand{1..n}.jpg
// animate  -> writes assets/cinemagraphs/fill-<page>-loop.mp4/.webm
//             + assets/stills/fill-<page>-hd.jpg
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fal from './lib/fal.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const W = 1376, H = 768, PADH = 774; // exact fill-hero plate size + 16:9 pad for Veo

const STYLE = `Flat 2D technical-diagram illustration, isometric/blueprint drafting register, in the style of a patent illustration or maintenance-manual engraving. Background: solid flat near-black (#111111), completely flat, no gradients, no vignette, no visible texture or noise. Linework: thin uniform-weight bone-cream outlines (#ECE9DE), precise and engineering-clean, consistent stroke width throughout. Exactly one restrained oxblood/rust accent color (#9A4C42) used as a small solid fill on only one or two elements, never more, never as an outline color elsewhere. Strictly no photorealism, no 3D shading, no soft drop shadows, no color gradients, no legible text, words, letters, or numerals anywhere in the frame (at most a few tiny abstract tick-mark engravings standing in for labels, never actual characters). Generous black negative space around the subject; the subject does not fill the whole frame. Mood: restrained, precise, engraved-technical, machine-and-signal.`;

const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : fallback;
}

async function cmdStills() {
  const page = arg('--page');
  const subject = arg('--subject');
  const n = parseInt(arg('--n', '4'), 10);
  if (!page || !subject) { console.error('usage: stills --page <name> --subject "<description>" [--n 4]'); process.exit(1); }
  const outDir = resolve(SITE, 'design', `${page}-hero-candidates`);
  mkdirSync(outDir, { recursive: true });
  let total = 0;
  for (let i = 1; i <= n; i++) {
    const raw = resolve(outDir, `${page}-cand${i}-raw.jpg`);
    const img = await fal.generateImage({ prompt: `${STYLE}\n\nSubject: ${subject}`, outPath: raw, aspectRatio: '16:9', log: () => {} });
    total += img.estCostUsd;
    const final = resolve(outDir, `${page}-cand${i}.jpg`);
    ff(['-i', raw, '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`, '-q:v', '2', final]);
    console.log(`[${page}] candidate ${i}/${n}: ${final} ($${img.estCostUsd.toFixed(3)}, running $${total.toFixed(3)})`);
  }
  console.log(`done: ${n} candidates in ${outDir}, total $${total.toFixed(3)}`);
}

function selfCrossfadeLoop(inMp4, outMp4, loopDur, xfade) {
  ff(['-i', inMp4, '-filter_complex',
    `[0:v]split[a][b];[a]trim=end=${loopDur},setpts=PTS-STARTPTS[first];` +
    `[b]trim=start=${loopDur},setpts=PTS-STARTPTS[last];` +
    `[last][first]xfade=transition=fade:duration=${xfade}:offset=0[v]`,
    '-map', '[v]', '-c:v', 'libx264', '-crf', '14', '-preset', 'veryslow', '-pix_fmt', 'yuv420p', outMp4]);
}

function seamScore(loopMp4, loopDur) {
  const doubled = loopMp4.replace('.mp4', '-x2.mp4');
  ff(['-stream_loop', '1', '-i', loopMp4, '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', doubled]);
  const scoresFile = loopMp4.replace('.mp4', '-scd.txt');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', doubled, '-vf', `scdet=threshold=0,metadata=print:file=${scoresFile}`, '-f', 'null', '-']);
  const txt = readFileSync(scoresFile, 'utf8');
  const entries = [...txt.matchAll(/pts_time:([\d.]+)[\s\S]*?lavfi\.scd\.score=([\d.]+)/g)].map(m => ({ t: +m[1], score: +m[2] }));
  return entries.filter(e => Math.abs(e.t - loopDur) < 0.15).reduce((mx, e) => Math.max(mx, e.score), 0);
}

function paletteCheck(srcJpg, candJpg) {
  const out = execFileSync('python3', [resolve(dirname(fileURLToPath(import.meta.url)), 'lib/palette_check.py'), srcJpg, candJpg], { encoding: 'utf8' });
  return JSON.parse(out.trim());
}

async function cmdAnimate() {
  const page = arg('--page');
  const still = arg('--still');
  const motion = arg('--motion', 'Subtle cinemagraph, camera locked off, composition and framing completely unchanged from the still. Animate exactly one small element with a soft, slow breathing glow or drift. Everything else stays completely still. No strobing, no flashing, no camera motion.');
  if (!page || !still) { console.error('usage: animate --page <name> --still <path> [--motion "<prompt>"]'); process.exit(1); }
  const work = resolve(SITE, 'design', `${page}-hero-candidates`, 'work');
  mkdirSync(work, { recursive: true });

  const padded = resolve(work, 'pad.jpg');
  ff(['-i', still, '-vf', `pad=${W}:${PADH}:0:${Math.round((PADH - H) / 2)}:color=0x0a0a0b`, '-q:v', '2', padded]);
  const dataUri = `data:image/jpeg;base64,${readFileSync(padded).toString('base64')}`;

  console.log(`[${page}] veo3.1 fast i2v 4s...`);
  const raw = resolve(work, 'raw.mp4');
  const vid = await fal.imageToVideo({ prompt: motion, imageUrl: dataUri, seconds: 4, outPath: raw, aspectRatio: '16:9', log: () => {} });
  console.log(`[${page}] req ${vid.requestId} est $${vid.estCostUsd.toFixed(3)}`);

  const cropped = resolve(work, 'cropped.mp4');
  ff(['-i', raw, '-vf', `scale=${W}:${PADH},crop=${W}:${H}:0:${Math.round((PADH - H) / 2)}`, '-an', '-c:v', 'libx264', '-crf', '14', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', cropped]);

  const loopDur = 3.4, xfade = 0.6;
  const loop = resolve(work, 'loop.mp4');
  selfCrossfadeLoop(cropped, loop, loopDur, xfade);
  const seam = seamScore(loop, loopDur);
  const poster = resolve(work, 'poster.jpg');
  ff(['-ss', '0', '-i', loop, '-frames:v', '1', '-q:v', '4', poster]);
  const palette = paletteCheck(still, poster);
  console.log(`[${page}] seam=${seam.toFixed(3)} (gate <2) palette=${JSON.stringify(palette)}`);
  if (seam >= 2 || !palette.pass) {
    console.error(`[${page}] FAILED gates (seam<2 and palette.pass required); inspect ${work} before shipping, not writing final assets.`);
    process.exit(2);
  }

  const outMp4 = resolve(SITE, 'assets/cinemagraphs', `fill-${page}-loop.mp4`);
  const outWebm = resolve(SITE, 'assets/cinemagraphs', `fill-${page}-loop.webm`);
  const attempts = [{ w: 960, crfH264: 26, crfVp9: 32 }, { w: 960, crfH264: 30, crfVp9: 36 }, { w: 720, crfH264: 30, crfVp9: 38 }];
  for (const a of attempts) {
    ff(['-i', loop, '-vf', `scale=${a.w}:-2`, '-c:v', 'libx264', '-preset', 'veryslow', '-crf', String(a.crfH264), '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', outMp4]);
    ff(['-i', loop, '-vf', `scale=${a.w}:-2`, '-c:v', 'libvpx-vp9', '-crf', String(a.crfVp9), '-b:v', '0', '-an', outWebm]);
    if (statSync(outMp4).size < 1024 * 1024 && statSync(outWebm).size < 1024 * 1024) {
      console.log(`[${page}] encoded at ${a.w}w: mp4=${Math.round(statSync(outMp4).size / 1024)}KB webm=${Math.round(statSync(outWebm).size / 1024)}KB`);
      break;
    }
  }
  const outPoster = resolve(SITE, 'assets/stills', `fill-${page}-hd.jpg`);
  ff(['-ss', '0', '-i', loop, '-frames:v', '1', '-q:v', '4', outPoster]);
  console.log(`[${page}] DONE: assets/cinemagraphs/fill-${page}-loop.{mp4,webm} + assets/stills/fill-${page}-hd.jpg`);
}

const cmd = process.argv[2];
if (cmd === 'stills') cmdStills().catch((e) => { console.error(e); process.exit(1); });
else if (cmd === 'animate') cmdAnimate().catch((e) => { console.error(e); process.exit(1); });
else { console.error('usage: node tools/gen-fill-hero.mjs <stills|animate> ...'); process.exit(1); }
