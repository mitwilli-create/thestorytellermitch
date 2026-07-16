#!/usr/bin/env node
// Build the retrieval corpus for the site chat agent (Phase B).
// Reads kb/*.md + an explicit allowlist of site pages + resumes-src/*.md +
// assets/site-data/*.json, chunks each, and writes tools/.kb-corpus.json -
// the input to kb-index.mjs, which embeds and upserts into Vectorize.
//
// Deliberately an ALLOWLIST, not "everything in the repo": relocation-os.html
// is never indexed (Spain/relocation content, permanently excluded per the
// hard exclusion policy in kb/status-availability.md), and nav/index pages
// (fit.html, resume.html) and kit/bundle docs aren't in the coverage matrix's
// source list, so they're left out until a future pass adds them deliberately.
//
// Re-run after any content change (kb/, site pages, resumes-src): the
// corpus is rebuilt from the live files each time, never hand-edited.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(SITE, 'tools/.kb-corpus.json');

const CHUNK_TARGET_WORDS = 180;
const CHUNK_OVERLAP_WORDS = 40;

const SITE_PAGE_ALLOWLIST = [
  'about.html', 'impact.html', 'timeline.html', 'work.html', 'stories.html',
  'comms.html', 'writing.html', 'content-ops.html', 'career-ops.html',
  'comms-triage-agent.html', 'tax-verification-agent.html', 'monolith.html',
  'voice-os.html', 'picture-lock.html', 'projects.html', 'systems.html',
  'for-anthropic.html', 'for-elevenlabs.html', 'for-fluidstack.html',
  'for-comms-leadership.html',
];

// ---- text helpers -------------------------------------------------------

function slug(path) {
  return path.replace(/\.(html|md|json)$/, '').replace(/[\/.]/g, '-');
}

function words(text) {
  return text.split(/\s+/).filter(Boolean);
}

// Fixed-size overlapping windows over paragraph-joined text. Splits on
// paragraph boundaries where possible so a window rarely cuts mid-sentence.
function chunkText(text, { targetWords = CHUNK_TARGET_WORDS, overlapWords = CHUNK_OVERLAP_WORDS } = {}) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = [];
  let currentWordCount = 0;

  for (const para of paragraphs) {
    const paraWords = words(para).length;
    if (currentWordCount > 0 && currentWordCount + paraWords > targetWords) {
      chunks.push(current.join('\n\n'));
      // carry the tail of the previous chunk forward as overlap context
      const tailWords = words(current[current.length - 1] ?? '').slice(-overlapWords).join(' ');
      current = tailWords ? [tailWords, para] : [para];
      currentWordCount = words(tailWords).length + paraWords;
    } else {
      current.push(para);
      currentWordCount += paraWords;
    }
  }
  if (current.length) chunks.push(current.join('\n\n'));
  return chunks.filter((c) => words(c).length >= 15); // drop near-empty tail fragments
}

// ---- HTML stripping ------------------------------------------------------
// Hand-rolled, not a DOM parser: this repo has no package.json / npm deps,
// and these are simple hand-authored pages (confirmed: single <main>, no
// nested widget markup). Regex is sufficient and keeps the zero-dep pattern
// the rest of tools/*.mjs already uses.

function stripHtml(html) {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const mainMatch = s.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) s = mainMatch[1];

  s = s
    // block-level boundaries become paragraph breaks before tags are stripped
    .replace(/<\/(p|div|li|h[1-6]|figcaption|blockquote|section|article)>/gi, '\n\n')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +([.,;:!?])/g, '$1') // stray space left where an inline tag was stripped before punctuation
    .trim();
  return s;
}

function extractTitle(html) {
  // h1s here are often multi-line span stacks; join the lines, don't truncate
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    const joined = stripHtml(h1[1]).replace(/\s*\n+\s*/g, ' ').trim();
    if (joined) return joined;
  }
  const title = html.match(/<title>([\s\S]*?)<\/title>/i);
  return title ? title[1].trim() : '';
}

// ---- markdown chunking (kb/ + resumes-src/) ------------------------------
// These are hand-structured with clear ## headings; chunk by section rather
// than by word-window so each chunk stays a complete, coherent answer.

const MIN_SECTION_WORDS = 80;
const MIN_EMBEDDABLE_WORDS = 30;

// `embeddableOf` reports how much of a section survives into the embedding
// (for kb files, policy meta-language is stripped first). A section is judged
// on that, not on raw length: a 110-word section that is 105 words of policy
// is a 5-word retrieval unit, and pretending otherwise is what leaked the
// relocation policy into the vector space (see finalizeChunk).
function chunkMarkdownByHeading(markdown, embeddableOf = (t) => t) {
  const body = markdown.replace(/^---\n[\s\S]*?\n---\n/, ''); // strip frontmatter
  const parts = body.split(/\n(?=## )/).map((p) => p.trim()).filter((p) => words(p).length >= 10);
  // Merge small sections forward on either measure:
  //  - raw < 80w: a bare question-headed fragment embeds as a generic
  //    "question-shaped" vector and out-competes real answers on unrelated
  //    queries (measured 2026-07-15: the restructured logistics file's
  //    mini-sections hijacked culture/comp questions).
  //  - embeddable < 30w: a policy-only section has nothing to retrieve on, so
  //    it must ride along with the answer it governs rather than stand alone.
  //    Phase C still sees the policy (it stays in `text`); the embedding never does.
  const thin = (t) =>
    words(t).length < MIN_SECTION_WORDS || words(embeddableOf(t)).length < MIN_EMBEDDABLE_WORDS;
  const merged = [];
  for (const part of parts) {
    const prev = merged[merged.length - 1];
    if (prev && (thin(prev) || thin(part))) {
      merged[merged.length - 1] = `${prev}\n\n${part}`;
    } else {
      merged.push(part);
    }
  }
  return merged;
}

function parseFrontmatter(markdown) {
  const m = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^"|"$/g, '');
  }
  return fm;
}

// ---- source processors ----------------------------------------------------

function processKbFiles() {
  const dir = resolve(SITE, 'kb');
  const chunks = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const raw = readFileSync(resolve(dir, file), 'utf8');
    const fm = parseFrontmatter(raw);
    const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? fm.kb_id ?? file;
    const sections = chunkMarkdownByHeading(raw, stripPolicyText);
    sections.forEach((text, i) => {
      chunks.push({
        id: `${slug(`kb/${file}`)}__c${i}`,
        text,
        source: `kb/${file}`,
        docTitle: title,
        docType: 'kb-authored',
        typeTag: fm.type ?? 'reference',
        topics: fm.topics,
      });
    });
  }
  return chunks;
}

function processSitePages() {
  const chunks = [];
  for (const file of SITE_PAGE_ALLOWLIST) {
    const html = readFileSync(resolve(SITE, file), 'utf8');
    const title = extractTitle(html);
    const text = stripHtml(html);
    const windows = chunkText(text);
    windows.forEach((chunkTxt, i) => {
      chunks.push({
        id: `${slug(file)}__c${i}`,
        text: chunkTxt,
        source: file,
        docTitle: title,
        docType: 'site-page',
        typeTag: 'site',
      });
    });
  }
  return chunks;
}

function processResumes() {
  const dir = resolve(SITE, 'resumes-src');
  const chunks = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const raw = readFileSync(resolve(dir, file), 'utf8');
    const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? file;
    const sections = chunkMarkdownByHeading(raw.startsWith('#') ? raw : `## Resume\n${raw}`);
    const effectiveSections = sections.length ? sections : chunkText(raw);
    effectiveSections.forEach((text, i) => {
      chunks.push({
        id: `${slug(`resumes-src/${file}`)}__c${i}`,
        text,
        source: `resumes-src/${file}`,
        docTitle: title,
        docType: 'resume',
        typeTag: 'resume',
      });
    });
  }
  return chunks;
}

function processSiteData() {
  const dir = resolve(SITE, 'assets/site-data');
  const chunks = [];

  const clips = JSON.parse(readFileSync(resolve(dir, 'clips.json'), 'utf8'));
  clips.clips.filter((c) => c.published).forEach((c, i) => {
    const text = `Video: "${c.title}" (${c.subtitle ?? ''}). Outlet: ${c.outletLabel}. Type: ${c.type}, ${c.year}, duration ${c.duration}.${c.caseStudy ? ` Related case study: ${c.caseStudy}.` : ''}`;
    chunks.push({ id: `data-clips__c${i}`, text, source: 'assets/site-data/clips.json', docTitle: 'Video/clip index', docType: 'site-data', typeTag: 'video-production' });
  });

  const plRun = JSON.parse(readFileSync(resolve(dir, 'picture-lock-run.json'), 'utf8'));
  const stageLines = plRun.stages.map((s) => `${s.label} (${s.detail}): ${s.calls} calls, $${s.costUsd}${s.api ? ` via ${s.api}` : ''}`).join('. ');
  chunks.push({
    id: 'data-picture-lock-run__c0',
    text: `Picture-lock production run cost breakdown. ${plRun._provenance} Total calls: ${plRun.totalCalls}. Stage-by-stage: ${stageLines}.`,
    source: 'assets/site-data/picture-lock-run.json', docTitle: 'Picture-lock run manifest', docType: 'site-data', typeTag: 'metrics-provenance',
  });

  const stories = JSON.parse(readFileSync(resolve(dir, 'stories.json'), 'utf8'));
  stories.stories.forEach((s, i) => {
    const text = `${s.title} (${s.kicker}). ${s.body.join(' ')}${s.pull ? ` Key line: "${s.pull}"` : ''}`;
    chunkText(text, { targetWords: 220, overlapWords: 30 }).forEach((c, j) => {
      chunks.push({ id: `data-stories-${slug(s.id)}__c${j}`, text: c, source: 'assets/site-data/stories.json', docTitle: s.title, docType: 'site-data', typeTag: 'stories' });
    });
    void i;
  });

  const writing = JSON.parse(readFileSync(resolve(dir, 'writing.json'), 'utf8'));
  if (writing.posts?.length) {
    const text = `Published writing: ${writing.posts.map((p) => `"${p.title}" (${new Date(p.date).toISOString().slice(0, 10)}): ${p.excerpt}`).join(' ')}`;
    chunks.push({ id: 'data-writing__c0', text, source: 'assets/site-data/writing.json', docTitle: 'Published writing feed', docType: 'site-data', typeTag: 'dev-writing' });
  }

  return chunks;
}

// ---- run ------------------------------------------------------------------

// G1 (approved 2026-07-15, refined after eval iteration 2): title-enriched
// embeddings for site pages / resumes / site-data ONLY. kb-authored files are
// already question-phrased and deliberately NOT enriched: the first iteration
// showed short question-phrased kb chunks out-compete long site-page chunks on
// any question-shaped query, so kb files get the opposite treatment: their
// assistant-policy meta-language ("For the assistant:", "Must NOT:", hard
// limits) is stripped from the EMBEDDED text (embedText) while the full text
// still ships in metadata for Phase C generation guidance.
const DOC_TYPE_LABELS = {
  'site-page': 'site page',
  resume: 'resume',
  'site-data': 'site data',
};

const POLICY_LINE = /^(\*\*For the assistant\b|\*\*Must NOT\b|\*\*Important for the assistant\b|## Hard limits for the assistant|- Openness to relocation may|- Do not state specific calendar|- Do not discuss notice periods)/;
function stripPolicyText(text) {
  const kept = [];
  for (const para of text.split(/\n{2,}/)) {
    if (POLICY_LINE.test(para.trim())) continue;
    kept.push(para);
  }
  return kept.join('\n\n').trim();
}

// Frontmatter `topics:` are the query-side vocabulary: the words a visitor
// actually types: while the prose uses the formal word. bge-base does not
// bridge abbreviations: measured 2026-07-15, "compensation expectations"
// ranked deflect-comp #1 at 0.670 while "comp expectations" left it out of the
// top 15 entirely. Frontmatter is stripped before chunking, so those curated
// keywords were being discarded. Fold them back into the embedded text only;
// `text` (what Phase C generates from) stays clean.
function topicsLine(topics) {
  if (!topics) return '';
  const list = topics
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((t) => t.trim().replace(/-/g, ' ')) // "comp-expectations" -> "comp expectations", so "comp" is its own token
    .filter(Boolean);
  return list.length ? `Topics: ${list.join(', ')}.` : '';
}

// ---- structural policy separation (Phase C) --------------------------------
// Split each chunk's full text into `text` (public-safe: what /api/ask may
// serve and what any page may render) and `policy` (assistant-only guidance:
// "For the assistant:", "Must NOT:", hard limits -- the prose that necessarily
// NAMES what it forbids). Phase B stripped policy at the response boundary
// with a regex (worker publicExcerpt); that regex stays as defense in depth,
// but after this split the public field never CONTAINS policy, so the leak
// class ("Never name Spain" rendered to a visitor) is dead structurally, not
// just filtered. Phase C generation reads text + policy server-side.
//
// The classifier is the same one publicExcerpt uses, for the same reason it
// was chosen there: prefix denylists leaked three phrasings on the first
// attempt; the property that actually holds is that policy paragraphs TALK
// ABOUT THE ASSISTANT (sole exception: a bare "**Must NOT:**"), and any
// paragraph naming an excluded term is policy by definition.
const POLICY_MARKER = /\bassistant\b|\bmust not\b/i;
const NEVER_PUBLIC = /Spain|Barcelona|Madrid|laid off|layoff|garden leave/i;

function splitPolicy(text) {
  const pub = [];
  const pol = [];
  for (const para of text.split(/\n{2,}/)) {
    const t = para.trim();
    if (!t) continue;
    (POLICY_MARKER.test(t) || NEVER_PUBLIC.test(t) ? pol : pub).push(t);
  }
  return { publicText: pub.join('\n\n'), policyText: pol.join('\n\n') };
}

const policyFallbacks = [];

function finalizeChunk(chunk) {
  // `split` is what ships (text = public-safe, policy = assistant-only);
  // embedText below is still computed from the ORIGINAL full text via the
  // existing stripPolicyText path, so the embedding-side corpus fingerprint
  // (kb-corpus-guard hashes embedText) is byte-identical across this change.
  const { publicText, policyText } = splitPolicy(chunk.text);
  const split = { ...chunk, text: publicText, policy: policyText };
  if (chunk.docType === 'kb-authored') {
    const stripped = stripPolicyText(chunk.text);
    // Last-resort guard against an empty embedding. The policy-aware merge in
    // chunkMarkdownByHeading should make this unreachable; if it ever fires, the
    // chunk is mostly policy and embedding the fallback would put assistant
    // meta-language (and whatever it forbids) into the vector space. Surface it
    // rather than leak it silently: that failure was live from the title fix
    // until 2026-07-15 and put "Never name Spain" into a retrievable vector.
    const enoughToEmbed = stripped.split(/\s+/).filter(Boolean).length >= 10;
    if (!enoughToEmbed) policyFallbacks.push(chunk.id);
    const base = enoughToEmbed ? stripped : chunk.text;
    const topics = topicsLine(chunk.topics);
    return { ...split, embedText: topics ? `${topics}\n\n${base}` : base };
  }
  const title = (chunk.docTitle ?? '').trim();
  if (!title || chunk.text.slice(0, 120).toLowerCase().includes(title.toLowerCase())) {
    return { ...split, embedText: chunk.text };
  }
  const label = DOC_TYPE_LABELS[chunk.docType] ?? chunk.docType;
  return { ...split, embedText: `${title} (${label})\n\n${chunk.text}` };
}

const corpus = [
  ...processKbFiles(),
  ...processSitePages(),
  ...processResumes(),
  ...processSiteData(),
].map(finalizeChunk);

// text + policy together cover the full authored content (text alone is only
// the public half after the split above), so the gate still sees everything.
const blob = corpus.map((c) => `${c.text}\n${c.policy ?? ''}`).join('\n');
const EM_DASH = String.fromCharCode(0x2014); // constructed so a sweep of this file cannot rewrite the needle
if (blob.includes(EM_DASH)) {
  console.error('EM DASH found in indexed content: fix the source file before building the corpus.');
  process.exit(1);
}

// Hard exclusion gate, embeddings only. These terms appear in kb/ legitimately,
// but only inside assistant-policy lines that FORBID them ("Never name Spain").
// Those lines must reach Phase C via `text` and must never reach the vector
// space via `embedText`: an embedded prohibition is retrievable by the very
// query it exists to refuse. `text` is deliberately not checked here.
const EXCLUDED_FROM_EMBEDDINGS = [
  [/\bSpain\b|\bBarcelona\b|\bMadrid\b/i, 'relocation destination'],
  [/\blaid off\b|\blayoff\b|\bgarden leave\b/i, 'employment-status exclusion'],
];
const leaks = [];
for (const c of corpus) {
  for (const [re, label] of EXCLUDED_FROM_EMBEDDINGS) {
    if (re.test(c.embedText)) leaks.push(`${c.id} (${c.source}): ${label}`);
  }
}
if (leaks.length) {
  console.error('HARD EXCLUSION LEAK into embedText: these would be semantically retrievable:');
  for (const l of leaks) console.error(`  ${l}`);
  console.error('Fix: keep the term inside a paragraph matched by POLICY_LINE so it is stripped from the embedding.');
  process.exit(1);
}

if (policyFallbacks.length) {
  console.warn(`WARNING: policy-strip fallback fired for ${policyFallbacks.join(', ')}: chunk is mostly policy; its full text (including assistant meta-language) was embedded.`);
}

writeFileSync(OUT, JSON.stringify({ built: new Date().toISOString(), count: corpus.length, chunks: corpus }, null, 2));

const bySourceType = {};
for (const c of corpus) bySourceType[c.docType] = (bySourceType[c.docType] ?? 0) + 1;
console.log(`Built ${corpus.length} chunks -> ${basename(OUT)}`);
console.log(bySourceType);
