// Site chat agent Worker: Phase B scope is retrieval only (no LLM generation
// yet — that's Phase C). Two routes, everything else falls through to the
// static site via the ASSETS binding.
//
//   POST /api/kb-index  secret-gated, local/CI build-time only. Embeds and
//                       upserts chunks produced by tools/kb-build.mjs. Never
//                       called by the public site.
//   POST /api/ask       public, read-only. Embeds a query, does a Vectorize
//                       similarity search, returns top-k chunks with source
//                       metadata. No generation, no chunk text is invented.
//
// KB_INDEX_SECRET is a Worker secret (wrangler secret put / .dev.vars for
// local dev), never committed and never exposed to /api/ask callers.

const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';
// Pooling pinned to 'cls', measured head-to-head 2026-07-15 on identical
// corpora (post gap-fix, embedText scheme) at topK=15: cls 96.1% vs mean
// 93.2% golden-set hit rate. (An earlier "mean wins" note compared different
// corpus versions at topK=8 and was methodologically invalid.) Both figures
// are from the pre-split corpus, so read them as a relative result -- cls
// wins -- not as current absolutes; cls alone re-measures 95.1% today. The
// mean side was not re-run: comparing modes means wiping and re-indexing the
// whole corpus, since the vectors are incompatible. Pinned explicitly so a
// Workers AI default change can't silently flip it; MUST be identical on
// index and query side -- changing this requires a full index wipe +
// re-index.
const INDEX_BATCH_SIZE = 50;
// topK=15 default. Re-measured 2026-07-15 on the current corpus (375 chunks):
// 8 -> 84.5%, 15 -> 95.1% (98/103, gate PASS), 20 -> 97.1%. The earlier
// "15 -> 96.1%" note here was measured on the pre-split corpus (kb/ was 20
// files, before gaps-and-honest-answers.md was split) and no longer
// reproduces; corpus composition moved, not the code. topK=20 now measures
// best -- an open call, not a silent change. Sweep tools/kb-eval.mjs's TOP_K
// with this. See tools/PHASE-B-REPORT.md + tools/.kb-eval-report.json.
const DEFAULT_TOP_K = 15;
const MAX_TOP_K = 20;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/kb-index' && request.method === 'POST') {
      return handleIndex(request, env);
    }
    if (url.pathname === '/api/kb-index' && request.method === 'GET') {
      return handleIndexStats(request, env);
    }
    if (url.pathname === '/api/ask' && request.method === 'POST') {
      return handleAsk(request, env);
    }
    if (url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
};

// Secret-gated, same key as the POST side: lets the build script wait for
// Vectorize to actually ingest rather than sleeping a fixed interval. Measured
// 2026-07-15: a full 375-chunk rebuild read 0 vectors at 15s, 40 at 30s, and
// 375 at 45s -- the old 35-40s sleep landed mid-ingestion and produced a
// 3/103 eval that looked exactly like a tuning regression.
async function handleIndexStats(request, env) {
  const auth = request.headers.get('Authorization') ?? '';
  if (!env.KB_INDEX_SECRET || auth !== `Bearer ${env.KB_INDEX_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const info = await env.VECTORIZE.describe();
  return Response.json({ vectorCount: info?.vectorCount ?? null, dimensions: info?.dimensions ?? null });
}

async function handleIndex(request, env) {
  const auth = request.headers.get('Authorization') ?? '';
  if (!env.KB_INDEX_SECRET || auth !== `Bearer ${env.KB_INDEX_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }
  const chunks = body?.chunks;
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return new Response('Expected { chunks: [...] }', { status: 400 });
  }

  let indexed = 0;
  let lastMutation = null;
  for (let i = 0; i < chunks.length; i += INDEX_BATCH_SIZE) {
    const batch = chunks.slice(i, i + INDEX_BATCH_SIZE);
    // embedText (when present) is the retrieval-optimized variant: policy
    // meta-language stripped from kb files, titles added to site chunks.
    // metadata.text keeps the FULL text for Phase C generation guidance.
    const embedded = await env.AI.run(EMBED_MODEL, { text: batch.map((c) => c.embedText ?? c.text), pooling: 'cls' });
    // A short/ragged embedding response would otherwise zip vectors to the
    // wrong chunks (values: undefined, or chunk N's vector on chunk N+1) and
    // still report success. Fail loudly instead: a silently mis-embedded
    // corpus looks exactly like a tuning regression and costs a day to chase.
    if (!Array.isArray(embedded?.data) || embedded.data.length !== batch.length) {
      return new Response(
        `Embedding count mismatch: got ${embedded?.data?.length ?? 0} for ${batch.length} chunks`,
        { status: 502 },
      );
    }
    const vectors = batch.map((c, j) => ({
      id: c.id,
      values: embedded.data[j],
      metadata: {
        text: c.text,
        source: c.source,
        docTitle: c.docTitle ?? '',
        docType: c.docType ?? '',
        typeTag: c.typeTag ?? '',
      },
    }));
    const mutation = await env.VECTORIZE.upsert(vectors);
    indexed += vectors.length;
    lastMutation = mutation?.mutationId ?? null;
  }

  // mutationId lets the caller wait for Vectorize to actually ingest the
  // upserts. Vectorize is eventually consistent: `indexed` only means the
  // writes were accepted, never that they are queryable, and a fixed sleep is
  // a guess. kb-index.mjs polls the real vector count instead.
  return Response.json({ indexed, total: chunks.length, mutationId: lastMutation });
}

// Interim abuse gate until Phase E's full hardening (Turnstile, rate limits,
// daily caps): only browser requests originating from the site (or local dev)
// may call /api/ask. Spoofable by a determined caller, but it blocks casual
// scripted use, and the endpoint can't spend LLM tokens (embeddings only).
const ALLOWED_ORIGIN_HOSTS = ['thestorytellermitch.com', 'www.thestorytellermitch.com', 'localhost', '127.0.0.1'];
function originAllowed(request) {
  const ref = request.headers.get('Origin') || request.headers.get('Referer');
  if (!ref) return false;
  try {
    return ALLOWED_ORIGIN_HOSTS.includes(new URL(ref).hostname);
  } catch {
    return false;
  }
}

async function handleAsk(request, env) {
  if (!originAllowed(request)) {
    return new Response('Forbidden', { status: 403 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }
  const query = body?.query;
  if (!query || typeof query !== 'string') {
    return new Response('Expected { query: "..." }', { status: 400 });
  }
  const topK = Math.min(Math.max(Number(body?.topK) || DEFAULT_TOP_K, 1), MAX_TOP_K);

  const embedded = await env.AI.run(EMBED_MODEL, { text: [query], pooling: 'cls' });
  const results = await env.VECTORIZE.query(embedded.data[0], { topK, returnMetadata: 'all' });

  return Response.json({
    query,
    matches: results.matches.map((m) => ({
      score: m.score,
      source: m.metadata?.source,
      docTitle: m.metadata?.docTitle,
      typeTag: m.metadata?.typeTag,
      text: m.metadata?.text,
    })),
  });
}
