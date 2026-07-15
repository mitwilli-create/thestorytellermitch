#!/usr/bin/env node
// Phase B retrieval eval. Runs every golden-set question against the live
// /api/ask endpoint, checks whether any expected_source appears among the
// returned matches, and reports the hit rate. Gate: >=95%.
//
// Usage: wrangler dev must be running (see kb-index.mjs). Then:
//   node tools/kb-eval.mjs [--topK N] [--server URL]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = process.argv.includes('--server')
  ? process.argv[process.argv.indexOf('--server') + 1]
  : (process.env.KB_DEV_SERVER ?? 'http://127.0.0.1:8787');
// MUST match DEFAULT_TOP_K in worker/index.js: the gate is only meaningful if
// the eval measures what production actually serves. This defaulted to 8 while
// production served 15, so a plain run reported 84.5% FAIL against a corpus
// that passes at 95.1%. Sweep both if either moves; use --topK only for
// deliberate head-to-head runs (see tools/PHASE-B-REPORT.md).
const TOP_K = process.argv.includes('--topK')
  ? Number(process.argv[process.argv.indexOf('--topK') + 1])
  : 15;

const golden = JSON.parse(readFileSync(resolve(SITE, 'tools/kb-eval-golden-set.json'), 'utf8'));
const questions = golden.golden_set;

console.log(`Running ${questions.length} golden-set questions against ${SERVER} (topK=${TOP_K}) ...`);

const results = [];
for (const q of questions) {
  const res = await fetch(`${SERVER}/api/ask`, {
    method: 'POST',
    // Origin required by the worker's interim abuse gate; localhost is allowlisted
    headers: { 'Content-Type': 'application/json', Origin: SERVER },
    body: JSON.stringify({ query: q.question, topK: TOP_K }),
  });
  if (!res.ok) {
    results.push({ ...q, hit: false, error: `HTTP ${res.status}`, returnedSources: [] });
    continue;
  }
  const { matches } = await res.json();
  const returnedSources = matches.map((m) => m.source);
  const hit = q.expected_sources.some((s) => returnedSources.includes(s));
  const hitRank = hit ? returnedSources.findIndex((s) => q.expected_sources.includes(s)) + 1 : null;
  results.push({ ...q, hit, hitRank, returnedSources });
  process.stdout.write(hit ? '.' : 'X');
}
console.log();

const hits = results.filter((r) => r.hit).length;
const hitRate = hits / results.length;
const misses = results.filter((r) => !r.hit);

console.log(`\nHit rate: ${hits}/${results.length} = ${(hitRate * 100).toFixed(1)}%`);
console.log(`Gate (>=95%): ${hitRate >= 0.95 ? 'PASS' : 'FAIL'}`);

if (misses.length) {
  console.log(`\nMisses (${misses.length}):`);
  for (const m of misses) {
    console.log(`  [${m.id}] "${m.question}"`);
    console.log(`    expected: ${m.expected_sources.join(' | ')}`);
    console.log(`    got:      ${m.returnedSources.slice(0, 3).join(', ') || '(none)'}${m.error ? ` (${m.error})` : ''}`);
  }
}

const report = {
  server: SERVER,
  topK: TOP_K,
  total: results.length,
  hits,
  hitRate,
  gatePass: hitRate >= 0.95,
  results,
};
writeFileSync(resolve(SITE, 'tools/.kb-eval-report.json'), JSON.stringify(report, null, 2));
console.log(`\nFull report: tools/.kb-eval-report.json`);
