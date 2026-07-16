#!/usr/bin/env node
// Render each page's narration script to audio in Mitchell's cloned voice.
//
// The script is NOT stored here: it is read out of the page's own
// .vc-transcript block. The visible transcript is the single source of truth,
// so the audio can never drift from the text a reader can check it against.
// Change the copy, re-run, and only the changed clips re-render.
//
// Every clip is normalized to the loudness spec systems.html publishes
// (-16 LUFS integrated, -1.5 dBTP true peak) by two-pass ffmpeg loudnorm,
// measured rather than eyeballed, and the measurements land in the manifest.
//
// Usage: node tools/gen-narration.mjs [--force] [--only <slug>] [--dry-run]

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(SITE, 'assets/audio/narration');
const MANIFEST = join(OUT_DIR, 'manifest.json');
// The raw TTS take is the only artifact that costs money, so it is kept and
// gitignored. Re-tuning the loudness spec then re-normalizes from cache for
// free, instead of re-billing 8.5k characters to change a dB.
const CACHE_DIR = join(OUT_DIR, '.cache');

// The clone Mitchell re-recorded on 2026-07-12 ("Mitchell retake 2026-07-12 IVC").
// The older "Mitchell Williams" clone (tsgjxmopI9Rjfakm4qOg) is superseded; do not use it.
const VOICE_ID = 'JqleYXcfWmF1IvSuSlLw';
// multilingual_v2 is ElevenLabs' own pick for voiceover work. v3 is more
// expressive but wants per-clip prompt engineering, which would make nine
// batch-rendered clips inconsistent with each other.
const MODEL_ID = 'eleven_multilingual_v2';
const VOICE_SETTINGS = {
  stability: 0.5,          // below ~0.4 an IVC clone wanders take to take
  similarity_boost: 0.75,
  style: 0.0,              // style exaggeration destabilizes instant clones
  use_speaker_boost: true,
};

const TARGET_I = -16.0;    // LUFS integrated, per systems.html
const TARGET_TP = -1.5;    // dBTP true peak, per systems.html
const TARGET_LRA = 11.0;

// Every page carrying a .voice-console, in nav order.
const PAGES = [
  'about', 'picture-lock', 'voice-os', 'monolith', 'relocation-os',
  'comms-triage-agent', 'tax-verification-agent', 'content-ops', 'career-ops',
];

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const DRY = args.includes('--dry-run');
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

let KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  // same fallback the other site tools use
  const envPath = resolve(process.env.HOME, 'Documents/career-ops/.env');
  if (existsSync(envPath)) {
    KEY = readFileSync(envPath, 'utf8').match(/^ELEVENLABS_API_KEY="?([^"\n\r]+)"?$/m)?.[1];
  }
}
if (!KEY && !DRY) { console.error('no ELEVENLABS_API_KEY (env or career-ops/.env)'); process.exit(2); }

// Pull the narration script out of the page's own transcript block.
const decode = (s) => s
  .replace(/<[^>]*>/g, '')
  .replace(/&middot;/g, '·').replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

function scriptFor(slug) {
  const html = readFileSync(join(SITE, `${slug}.html`), 'utf8');
  const m = html.match(/<details class="vc-transcript">[\s\S]*?<p>([\s\S]*?)<\/p>/);
  if (!m) throw new Error(`${slug}.html: no .vc-transcript <p> found`);
  return decode(m[1]);
}

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

function ffprobeDuration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' });
  return +(+out.trim()).toFixed(2);
}

// Pass 1 of loudnorm: measure. ffmpeg writes its reports to stderr, so this
// must use spawnSync (execFileSync hands back stdout only). Pass 2, in the
// loop, feeds these numbers back in. Single-pass loudnorm guesses and lands a
// dB or two off, which is the exact sloppiness the published spec prevents.
const ffmpegStderr = (argv) => (spawnSync('ffmpeg', argv, { encoding: 'utf8' }).stderr || '');

function measure(file) {
  const stderr = ffmpegStderr(['-nostdin', '-i', file,
    '-af', `loudnorm=I=${TARGET_I}:TP=${TARGET_TP}:LRA=${TARGET_LRA}:print_format=json`,
    '-f', 'null', '-']);
  const open = stderr.lastIndexOf('{'), close = stderr.lastIndexOf('}');
  if (open < 0 || close < 0) throw new Error(`loudnorm measure failed for ${file}`);
  return JSON.parse(stderr.slice(open, close + 1));
}

// Pass 2: apply the measured values.
//
// Deliberately NOT linear=true. Raw TTS comes off the API around -18 LUFS with
// true peaks near -0.6 dBTP, so the flat gain needed to reach -16 would drive
// peaks to roughly +1.5 dBTP, way through the -1.5 ceiling. Linear mode
// resolves that by refusing to reach the loudness target (every clip landed
// ~0.8 LU shy). Dynamic mode uses loudnorm's limiter to hit both numbers, the
// same way broadcast normalization does. Speech has the headroom for it: the
// LRA here is ~2 LU, so the limiter is barely working.
function normalizeToSpec(inFile, outFile) {
  const m = measure(inFile);
  execFileSync('ffmpeg', ['-nostdin', '-y', '-i', inFile, '-af',
    `loudnorm=I=${TARGET_I}:TP=${TARGET_TP}:LRA=${TARGET_LRA}` +
    `:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
    `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:print_format=summary`,
    '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', outFile],
    { stdio: ['ignore', 'ignore', 'ignore'] });
}

// Independent verification of what actually landed on disk, read back off the
// file rather than trusted from loudnorm's own prediction.
function integratedLufs(file) {
  const out = ffmpegStderr(['-nostdin', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const m = out.match(/Integrated loudness:[\s\S]*?I:\s*(-?[\d.]+)\s*LUFS/);
  const tp = out.match(/True peak:[\s\S]*?Peak:\s*(-?[\d.]+)\s*dBFS/);
  return { i: m ? +m[1] : null, peak: tp ? +tp[1] : null };
}

const prev = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { clips: {} };
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(CACHE_DIR, { recursive: true });

const manifest = { generated: new Date().toISOString().slice(0, 10), voice_id: VOICE_ID,
  voice_name: 'Mitchell retake 2026-07-12 IVC', model_id: MODEL_ID,
  voice_settings: VOICE_SETTINGS, target: { I: TARGET_I, TP: TARGET_TP }, clips: {} };

let charsSpent = 0, rendered = 0, skipped = 0, renormed = 0;

for (const slug of PAGES) {
  if (ONLY && slug !== ONLY) { if (prev.clips[slug]) manifest.clips[slug] = prev.clips[slug]; continue; }
  const text = scriptFor(slug);
  const hash = sha(text + MODEL_ID + VOICE_ID + JSON.stringify(VOICE_SETTINGS));
  const out = join(OUT_DIR, `${slug}.mp3`);

  const raw = join(CACHE_DIR, `${slug}.raw.mp3`);

  if (!FORCE && existsSync(out) && prev.clips[slug]?.hash === hash) {
    console.log(`skip   ${slug.padEnd(24)} (script unchanged)`);
    manifest.clips[slug] = prev.clips[slug];
    skipped++;
    continue;
  }

  // Script unchanged but the spec moved (or the mp3 went missing): the paid
  // artifact is already on disk, so re-normalize from cache and bill nothing.
  if (!FORCE && existsSync(raw) && prev.clips[slug]?.hash === hash) {
    console.log(`renorm ${slug.padEnd(24)} (from cached take, no API call)`);
    normalizeToSpec(raw, out);
    const a = integratedLufs(out);
    manifest.clips[slug] = { ...prev.clips[slug], lufs_out: a.i, peak_out_dbfs: a.peak,
      duration_s: ffprobeDuration(out) };
    console.log(`       → ${a.i} LUFS  peak ${a.peak} dBFS`);
    renormed++;
    continue;
  }

  console.log(`render ${slug.padEnd(24)} ${String(text.length).padStart(5)} chars`);
  if (DRY) { manifest.clips[slug] = { hash, chars: text.length, dry: true }; continue; }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS }),
  });
  if (!res.ok) {
    console.error(`  FAIL ${slug}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    process.exitCode = 1;
    continue;
  }
  writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  charsSpent += text.length;

  normalizeToSpec(raw, out);
  const before = integratedLufs(raw);
  const after = integratedLufs(out);
  const dur = ffprobeDuration(out);
  manifest.clips[slug] = {
    hash, chars: text.length, duration_s: dur,
    lufs_in: before.i, lufs_out: after.i, peak_out_dbfs: after.peak,
  };
  console.log(`       ${'→'} ${dur}s  ${before.i} LUFS ${'→'} ${after.i} LUFS  peak ${after.peak} dBFS`);
  rendered++;
}

if (!DRY) {
  manifest.chars_this_run = charsSpent;
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
}
console.log(`\n${rendered} rendered, ${renormed} renormalized from cache, ${skipped} skipped, ${charsSpent} chars billed this run`);
console.log(`manifest: ${MANIFEST.replace(SITE + '/', '')}`);
