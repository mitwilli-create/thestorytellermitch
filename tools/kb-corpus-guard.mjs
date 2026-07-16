#!/usr/bin/env node
// Fail a PR that changes the retrieval corpus without re-indexing and re-evaluating.
//
// The gap this closes, in one sentence: merging content that feeds the corpus
// (kb/, resumes-src/, an allowlisted site page, assets/site-data/) silently
// invalidates the live Vectorize index, and nothing re-indexes or re-evals, so
// the drift is only discovered by whoever next rebuilds -- as a pile of misses
// that look like THEIR regression.
//
// That is not a hypothetical failure mode; it is the reconstruction of
// 2026-07-15. PR #108 added a resume lane (+5 chunks). Nobody re-indexed. The
// next clean rebuild read 92.2% against a 95.1% baseline and the misses got
// provisionally blamed on three unrelated PRs. Attribution took hours; the
// actual cause was 5 chunks nobody re-measured. See tools/PHASE-B-REPORT.md.
//
// Mechanism: tools/kb-corpus-manifest.json is a tracked fingerprint of the
// built corpus. CI rebuilds and compares. Any drift fails the build with the
// runbook. Clearing it requires a real re-index + eval, because --update
// refuses to write unless a passing eval report is on disk.
//
// Usage:
//   node tools/kb-corpus-guard.mjs             # CI: compare, exit 1 on drift
//   node tools/kb-corpus-guard.mjs --update    # after a real re-index + eval
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = resolve(SITE, 'tools/.kb-corpus.json');
const MANIFEST = resolve(SITE, 'tools/kb-corpus-manifest.json');
const EVAL = resolve(SITE, 'tools/.kb-eval-report.json');
const GATE = 0.95;

if (!existsSync(CORPUS)) {
  console.error('No tools/.kb-corpus.json. Run `node tools/kb-build.mjs` first.');
  process.exit(1);
}
const { chunks } = JSON.parse(readFileSync(CORPUS, 'utf8'));

// Hash embedText, not text: embedText is what actually becomes a vector, so it
// is exactly the thing whose change invalidates the index. A pure-CSS PR that
// leaves embedText identical is correctly NOT flagged (measured: PR #114 was a
// 4-word heading rename and moved one chunk's embedText -- so it IS flagged,
// and should be; PRs #115/#104 touched zero chunks and are not).
function fingerprint(list) {
  const h = createHash('sha256');
  for (const c of [...list].sort((a, b) => a.id.localeCompare(b.id))) {
    h.update(`${c.id}\u0000${c.embedText ?? c.text}\u0000`);
  }
  return h.digest('hex');
}
const bySource = {};
for (const c of chunks) bySource[c.source] = (bySource[c.source] ?? 0) + 1;
const current = { chunkCount: chunks.length, corpusHash: fingerprint(chunks) };

if (process.argv.includes('--update')) {
  // The whole point of the gate is that the index was actually rebuilt and
  // re-measured. Writing the manifest from a stale eval would make this a
  // rubber stamp, so require a fresh PASSING report to exist on disk.
  if (!existsSync(EVAL)) {
    console.error('Refusing to update: no tools/.kb-eval-report.json.');
    console.error('Re-index and re-eval first (kb-ops runbook), then re-run with --update:');
    console.error('  node tools/kb-build.mjs && node tools/kb-index.mjs && node tools/kb-eval.mjs');
    process.exit(1);
  }
  const report = JSON.parse(readFileSync(EVAL, 'utf8'));
  if (!report.gatePass) {
    console.error(`Refusing to update: last eval FAILED the gate (${(report.hitRate * 100).toFixed(1)}% < ${GATE * 100}%).`);
    console.error('Fix retrieval before recording this corpus as good.');
    process.exit(1);
  }
  // On `bySource` keys being source paths: CodeRabbit flagged these as
  // "publishing a full personal name in a public JSON file" (2026-07-16).
  // REJECTED, and recorded here so it is not re-litigated: every one of these
  // paths is ALREADY a tracked file in this same public repo (`git ls-files
  // resumes-src/` lists all 8 `mitchell-williams-*.md` by name), on a personal
  // site published under Mitchell's own name. The manifest discloses nothing
  // that `git ls-files` does not, so there is no marginal disclosure to
  // prevent. Opaque ids would only make the drift diff unreadable -- naming the
  // source that moved is the entire diagnostic value of this field.
  const manifest = {
    _comment:
      'Fingerprint of the retrieval corpus that the live Vectorize index was last built from. ' +
      'CI fails if the built corpus drifts from this. Regenerate ONLY after a real wipe+re-index+eval: ' +
      'node tools/kb-corpus-guard.mjs --update',
    chunkCount: current.chunkCount,
    corpusHash: current.corpusHash,
    bySource,
    lastVerified: new Date().toISOString().slice(0, 10),
    lastEval: {
      topK: report.topK,
      hits: report.hits,
      total: report.total,
      hitRate: Number(report.hitRate.toFixed(4)),
      gatePass: report.gatePass,
    },
  };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Manifest updated: ${current.chunkCount} chunks, eval ${report.hits}/${report.total} = ${(report.hitRate * 100).toFixed(1)}% at topK=${report.topK}.`);
  process.exit(0);
}

if (!existsSync(MANIFEST)) {
  console.error('No tools/kb-corpus-manifest.json. Create it with: node tools/kb-corpus-guard.mjs --update');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));

if (manifest.corpusHash === current.corpusHash && manifest.chunkCount === current.chunkCount) {
  console.log(`KB corpus matches the indexed manifest (${current.chunkCount} chunks, verified ${manifest.lastVerified}).`);
  process.exit(0);
}

console.error('KB CORPUS DRIFT: this change alters the retrieval corpus, so the live index is now stale.');
console.error(`  chunk count: ${manifest.chunkCount} (indexed) -> ${current.chunkCount} (this branch)`);
console.error(`  corpus hash: ${manifest.corpusHash.slice(0, 12)}... -> ${current.corpusHash.slice(0, 12)}...`);

const old = manifest.bySource ?? {};
const keys = [...new Set([...Object.keys(old), ...Object.keys(bySource)])].sort();
const moved = keys.filter((k) => (old[k] ?? 0) !== (bySource[k] ?? 0));
if (moved.length) {
  console.error('  sources whose chunk count moved:');
  for (const k of moved) console.error(`    ${k}: ${old[k] ?? 0} -> ${bySource[k] ?? 0}`);
} else {
  console.error('  no chunk COUNT moved: some chunk text changed, which still re-embeds those vectors.');
}
console.error('');
console.error('Nothing re-indexes on merge, so shipping this as-is leaves the index serving old vectors');
console.error('and hands the next person an unattributable eval drop. Re-index, re-eval, then record it:');
console.error('  1. pkill -f "wrangler.*dev"');
console.error('  2. wrangler vectorize delete thestorytellermitch-kb --force');
console.error('  3. wrangler vectorize create thestorytellermitch-kb --dimensions=768 --metric=cosine');
console.error('  4. start `wrangler dev --remote` FRESH (from a dir with no .env), or upserts are silently dropped');
console.error('  5. node tools/kb-build.mjs && node tools/kb-index.mjs && node tools/kb-eval.mjs');
console.error('  6. node tools/kb-corpus-guard.mjs --update   # records the new fingerprint + hit rate');
process.exit(1);
