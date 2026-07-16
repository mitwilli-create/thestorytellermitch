#!/usr/bin/env node
// Push tools/.kb-corpus.json (built by kb-build.mjs) into Vectorize via the
// local wrangler dev server's secret-gated /api/kb-index route. Embeddings
// happen inside the Worker (env.AI.run), authenticated by the same OAuth
// session wrangler dev already uses; this script never touches Cloudflare
// credentials directly.
//
// Usage: run `wrangler dev` in one terminal, then `node tools/kb-index.mjs`
// in another. Reads KB_INDEX_SECRET from .dev.vars.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEV_SERVER = process.env.KB_DEV_SERVER ?? 'http://127.0.0.1:8787';
const POST_BATCH = 40; // chunks per HTTP request to /api/kb-index

const devVars = readFileSync(resolve(SITE, '.dev.vars'), 'utf8');
const secret = devVars.match(/^KB_INDEX_SECRET=(.+)$/m)?.[1]?.trim();
if (!secret) {
  console.error('KB_INDEX_SECRET not found in .dev.vars; run kb-build.mjs setup first.');
  process.exit(1);
}

const { chunks } = JSON.parse(readFileSync(resolve(SITE, 'tools/.kb-corpus.json'), 'utf8'));
console.log(`Indexing ${chunks.length} chunks against ${DEV_SERVER} ...`);

let indexed = 0;
for (let i = 0; i < chunks.length; i += POST_BATCH) {
  const batch = chunks.slice(i, i + POST_BATCH);
  const res = await fetch(`${DEV_SERVER}/api/kb-index`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ chunks: batch }),
  });
  if (!res.ok) {
    console.error(`Batch ${i}-${i + batch.length} failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const { indexed: n } = await res.json();
  indexed += n;
  process.stdout.write(`\r  ${indexed}/${chunks.length}`);
}
console.log(`\nUpserts accepted: ${indexed}. Waiting for Vectorize to ingest ...`);

// Accepted != queryable. Vectorize is eventually consistent, and worse, upserts
// are silently DROPPED if the running `wrangler dev` bound the index before it
// was deleted/recreated -- every batch still returns 200. That failure cost a
// full debug cycle on 2026-07-15 (index froze at 55/375; the eval read 3/103
// and looked like a tuning regression). Never sleep a fixed interval here:
// poll the real count, and fail loudly if it stalls.
//
// Runbook, learned the hard way:
//   1. kill wrangler dev  2. wipe+recreate the index  3. START dev fresh
//   4. index  5. wait for this poll  6. eval
// Skipping (3) is what drops the upserts. Wipe before re-index regardless:
// chunk ids are positional (__c0...), so re-chunking renumbers them and
// upsert-without-delete strands orphans from the old id scheme.
const expected = chunks.length;
const DEADLINE_MS = 5 * 60 * 1000;
const started = Date.now();
let last = -1;
let stalledSince = Date.now();
for (;;) {
  const res = await fetch(`${DEV_SERVER}/api/kb-index`, { headers: { Authorization: `Bearer ${secret}` } });
  if (!res.ok) {
    console.error(`\nCould not read index stats: ${res.status}. Verify manually with: wrangler vectorize info`);
    process.exit(1);
  }
  const { vectorCount } = await res.json();
  process.stdout.write(`\r  ingested ${vectorCount}/${expected}`);
  if (vectorCount >= expected) {
    // EXACT, not >=. A count ABOVE the corpus size means orphans: this script
    // upserts and never deletes, and chunk ids are positional (__c0, __c1...),
    // so any re-chunking renumbers them and strands vectors from the old scheme
    // that no rebuild will ever overwrite. Those orphans are still retrievable,
    // so they quietly inflate the eval.
    //
    // This is not hypothetical. The 95.1% hit rate reported as Phase B's
    // headline (and copied into PHASE-B-REPORT.md and two memory files) was
    // measured against an index in exactly this state; a clean rebuild of the
    // same content reads 92.2%, and no committed corpus reproduces 95.1%. A
    // `>=` check called that index healthy. Fail instead: a wrong number that
    // looks healthy costs more than a red line here.
    if (vectorCount > expected) {
      console.error(`\nORPHANS: index holds ${vectorCount} vectors for a ${expected}-chunk corpus.`);
      console.error(`${vectorCount - expected} vector(s) belong to no current chunk and are still retrievable,`);
      console.error('so any eval run against this index is inflated and not reproducible.');
      console.error('Fix: wipe and re-index from a clean index (see the kb-ops runbook):');
      console.error('  pkill -f "wrangler.*dev"');
      console.error('  wrangler vectorize delete thestorytellermitch-kb --force');
      console.error('  wrangler vectorize create thestorytellermitch-kb --dimensions=768 --metric=cosine');
      console.error('  # restart wrangler dev FRESH before re-indexing, or upserts are silently dropped');
      process.exit(1);
    }
    console.log(`\nDone: ${expected} chunks indexed and queryable (exact count, no orphans).`);
    break;
  }
  if (vectorCount !== last) {
    last = vectorCount;
    stalledSince = Date.now();
  } else if (Date.now() - stalledSince > 90_000) {
    console.error(`\nSTALLED at ${vectorCount}/${expected} for 90s. Upserts were accepted but are not landing.`);
    console.error('Almost certainly: the index was deleted/recreated while this dev server was running,');
    console.error('so its binding points at the old index. Kill wrangler dev, restart it, and re-run.');
    process.exit(1);
  }
  if (Date.now() - started > DEADLINE_MS) {
    console.error(`\nTimed out at ${vectorCount}/${expected} after 5 minutes.`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 5000));
}
