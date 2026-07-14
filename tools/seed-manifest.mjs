#!/usr/bin/env node
// Seed assets/site-data/clips.json from the career-ops video inventory.
// Idempotent by design EXCEPT: if clips.json already exists, curated fields
// (title, subtitle, poster picks, previewStart, startHere*) are PRESERVED
// per slug so re-seeding never clobbers hand-curation.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, '..');
const INVENTORY = resolve(
  process.env.HOME,
  'Documents/career-ops/data/storytellermitch-video-inventory-2026-07-07.json'
);
const OUT = resolve(SITE, 'assets/site-data/clips.json');

const inventory = JSON.parse(readFileSync(INVENTORY, 'utf8'));

// ---------- normalization tables ----------
const OUTLET_KEY = {
  'AJE-STREAM': 'aje-stream',
  AJP: 'ajplus',
  FUSION: 'fusion',
  HUFFPOST: 'huffpost',
  'GOOGLE-CORPENG': 'google',
  'GOOGLE-XGE': 'google',
};

// Ambiguous outlets: filter key assigned by where Mitchell worked that year
// (Fusion 2013-15, AJ+ 2016-18, HuffPost Live 2012-13); display label stays honest.
function resolveOutlet(raw, yearStart) {
  if (raw === 'AJP-OR-FUSION') return yearStart >= 2016 ? 'ajplus' : 'fusion';
  if (raw === 'HUFFPOST-OR-AJE') return 'huffpost';
  return OUTLET_KEY[raw] ?? 'other';
}

const BUCKET_BY_TYPE = {
  'Social Video': 'social-video',
  'Explainer Video': 'social-video',
  'Short Cut': 'social-video',
  'Documentary Segment': 'field-documentary',
  'Documentary Short': 'field-documentary',
  'Investigative Video': 'field-documentary',
  'Live Coverage': 'live-panels',
  'Live Panel': 'live-panels',
  'Panel Discussion': 'live-panels',
  'Panel Interview': 'live-panels',
  'Celebrity Interview': 'interviews-longform',
  'Interview Segment': 'interviews-longform',
  'Entertainment Segment': 'interviews-longform',
  Segment: 'interviews-longform',
  'Extended Segment': 'interviews-longform',
  'Full Episode': 'interviews-longform',
  'Full Episode Part 1': 'interviews-longform',
  'Full Episode Part 2': 'interviews-longform',
  Showreel: 'interviews-longform',
  'Conference Interview': 'interviews-longform',
  'Full Presentation': 'interviews-longform',
  'Internal Presentation': 'interviews-longform',
  'Short Clip': 'interviews-longform',
  'Internal Clip': 'interviews-longform',
};

// Field-production overrides (type says Social Video, craft says field).
const BUCKET_OVERRIDES = {
  'AJP_2017_Hurricane-Maria-Puerto-Rico-Aftermath_Social-Video_2m57s.mp4': 'field-documentary',
  'AJP_2017_San-Juan-Mayor-Speaks-Out-Hurricane-Maria_Social-Video_1m16s.mp4': 'field-documentary',
  'AJP_2016-2018_The-Dangerous-Divide-In-Venezuela_Social-Video_4m1s.mp4': 'field-documentary',
};

// Google-internal confidentiality gate (Mitchell 2026-07-07: keep Grace Hopper only).
const UNPUBLISHED_GOOGLE = new Set([
  'GOOGLE-CORPENG_2022_Internal-Content-Social-Share_Short-Clip_2m57s.mp4',
  'GOOGLE-CORPENG_2022_Working-On-CorpEng_Internal-Clip_2m9s.mp4',
  'GOOGLE-XGE_2023_All-Hands-Googler_Full-Presentation_41m28s.mp4',
  'GOOGLE-XGE_2023_Honey-I-Shrunk-The-Population_Internal-Presentation_5m31s.mp4',
]);

// Duplicate-content pairs: keep the Social Video variant; the Short Cut files are
// byte-duplicate content and are dropped from the manifest entirely (not published:false)
// so the published variant keeps the clean slug.
const DROPPED_DUPES = new Set([
  'AJP_2017_How-One-Company-Aims-To-Compete_Short-Cut_5m0s.mp4',
  'AJP_2017_Truvada-PrEP-Not-Just-For-Gay-Men_Short-Cut_7m26s.mp4',
]);

// Curated Start-here row (picture-lock tile is rank 1, added below).
const START_HERE = {
  'AJP_2017_Measles-Outbreaks-USA-VIRAL-50M-Views_Social-Video_2m5s.mp4': 2,
  'AJE-STREAM_2011_Global-Reactions-Bin-Laden-Death-Bahrain_Live-Coverage_45m11s.mp4': 3,
  'AJP_2017_San-Juan-Mayor-Speaks-Out-Hurricane-Maria_Social-Video_1m16s.mp4': 4,
  'FUSION_2013-2015_America-With-Jorge-Ramos_Showreel_43m50s.mp4': 5,
  'AJP_2017_Truvada-PrEP-Not-Just-For-Gay-Men_Social-Video_7m26s.mp4': 6,
  'AJP_2016-2018_Bill-Nye-Curbing-Climate-Change_Interview-Segment_3m2s.mp4': 7,
  'AJP_2016-2018_Surviving-An-Atomic-Bomb_Documentary-Short_3m56s.mp4': 8,
};

function yearStartOf(year) {
  return parseInt(String(year).slice(0, 4), 10);
}
function eraOf(yearStart) {
  if (yearStart <= 2012) return '2010-2013';
  if (yearStart <= 2014) return '2013-2015';
  if (yearStart <= 2018) return '2015-2018';
  return '2022-2023';
}
function durationSecOf(dur) {
  const m = dur.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}
function kebab(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function humanTitle(t) {
  // inventory titles are Title-Case-With-Hyphens already joined by spaces
  return t.replace(/\s+/g, ' ').trim();
}

const OUTLET_LABELS = {
  'aje-stream': 'Al Jazeera · The Stream',
  ajplus: 'AJ+',
  fusion: 'Fusion',
  huffpost: 'HuffPost Live',
  google: 'Google',
};

// ---------- preserve prior curation ----------
const prior = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null;
const priorBySlug = new Map((prior?.clips ?? []).map((c) => [c.slug, c]));
const PRESERVE = ['title', 'subtitle', 'poster', 'hoverPreview', 'previewStart', 'startHere', 'startHereRank', 'published', 'bucket'];

// ---------- build ----------
const slugs = new Set();
const clips = inventory.filter((row) => !DROPPED_DUPES.has(row.file)).map((row) => {
  const yearStart = yearStartOf(row.year);
  const outlet = resolveOutlet(row.outletRaw, yearStart);
  let slug = `${row.outletRaw.toLowerCase()}-${yearStart}-${kebab(row.title)}`.slice(0, 60).replace(/-+$/, '');
  let n = 2;
  while (slugs.has(slug)) slug = `${slug}-${n++}`;
  slugs.add(slug);

  const published = !UNPUBLISHED_GOOGLE.has(row.file);
  const durationSec = durationSecOf(row.dur);
  const clip = {
    slug,
    published,
    bucket: BUCKET_OVERRIDES[row.file] ?? BUCKET_BY_TYPE[row.type] ?? 'interviews-longform',
    outlet,
    outletLabel: row.outlet,
    year: row.year,
    era: eraOf(yearStart),
    type: row.type,
    title: humanTitle(row.title),
    subtitle: '',
    duration: row.dur,
    durationSec,
    poster: `assets/posters/${slug}.jpg`,
    hoverPreview: null,
    previewStart: Math.round(durationSec * 0.25),
    media: { local: `media/${slug}.mp4`, streamId: null, youtubeId: null },
    startHere: row.file in START_HERE,
    startHereRank: START_HERE[row.file] ?? null,
    caseStudy: null,
    sourceFile: row.file,
  };
  const prev = priorBySlug.get(slug);
  if (prev) for (const k of PRESERVE) if (prev[k] !== undefined) clip[k] = prev[k];
  return clip;
});

// Carry over prior manifest clips that are NOT derived from the inventory
// (picture-lock flagship, YouTube embeds) so hand-added entries survive re-seeds.
for (const prev of prior?.clips ?? []) {
  if (!prev.sourceFile && !clips.some((c) => c.slug === prev.slug)) clips.push(prev);
}

// picture-lock flagship tile (assets already in repo; case-study child page).
// Upserted: paths and copy refresh on every re-seed, while curated playback
// ids (streamId/youtubeId) on an existing entry are preserved.
{
  const flagship = {
    slug: 'broll-pipeline-2026',
    published: true,
    bucket: 'ai-native',
    outlet: 'independent',
    outletLabel: 'Independent · AI-native',
    year: '2026',
    era: '2022-2023',
    type: 'AI Pipeline Demo',
    title: 'One script in, a produced short out',
    subtitle: 'picture-lock: seven stages, ElevenLabs stack, every call logged',
    duration: '0m15s',
    durationSec: 15,
    poster: 'assets/picture-lock-poster.jpg',
    hoverPreview: 'assets/picture-lock-short.mp4',
    previewStart: 0,
    media: { local: 'assets/picture-lock-short.mp4', streamId: null, youtubeId: null },
    startHere: true,
    startHereRank: 1,
    caseStudy: 'picture-lock.html',
    sourceFile: null,
  };
  const i = clips.findIndex((c) => c.slug === flagship.slug);
  if (i === -1) {
    clips.unshift(flagship);
  } else {
    const prev = clips[i];
    clips[i] = { ...prev, ...flagship, media: { ...flagship.media, streamId: prev.media?.streamId ?? null, youtubeId: prev.media?.youtubeId ?? null } };
  }
}

const manifest = {
  version: 1,
  playback: 'local',
  streamCustomerCode: null,
  buckets: [
    { key: 'ai-native', label: 'AI-Native Production', num: '01' },
    { key: 'social-video', label: 'Social Video', num: '02' },
    { key: 'field-documentary', label: 'Field & Documentary', num: '03' },
    { key: 'live-panels', label: 'Live & Panels', num: '04' },
    { key: 'interviews-longform', label: 'Interviews & Long-Form', num: '05' },
  ],
  outlets: [
    { key: 'aje-stream', label: 'Al Jazeera · The Stream' },
    { key: 'huffpost', label: 'HuffPost Live' },
    { key: 'fusion', label: 'Fusion' },
    { key: 'ajplus', label: 'AJ+' },
    { key: 'google', label: 'Google' },
    { key: 'independent', label: 'Independent' },
  ],
  eras: [
    { key: '2010-2013', label: '2010–13' },
    { key: '2013-2015', label: '2013–15' },
    { key: '2015-2018', label: '2015–18' },
    { key: '2022-2023', label: '2022+' },
  ],
  clips,
};

writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n');

// ---------- census ----------
const pub = clips.filter((c) => c.published);
const byBucket = {};
for (const c of pub) byBucket[c.bucket] = (byBucket[c.bucket] || 0) + 1;
console.log(`clips.json written: ${clips.length} records, ${pub.length} published`);
console.log('published by bucket:', byBucket);
console.log('unpublished:', clips.filter((c) => !c.published).map((c) => c.slug).join(', '));
console.log('start-here:', pub.filter((c) => c.startHere).sort((a, b) => a.startHereRank - b.startHereRank).map((c) => `${c.startHereRank}:${c.slug}`).join(' '));
