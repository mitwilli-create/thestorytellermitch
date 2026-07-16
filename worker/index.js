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
// Candidate pool over-fetched before diversification. 20 is a hard Vectorize
// ceiling for a single-pass query, not a tuning choice: topK is capped at 20
// when returnMetadata is 'all'. Going deeper needs a two-pass query (ids only,
// pool up to 100 -> cap -> getByIds); nothing measured so far justifies that
// round trip, but it is untested rather than ruled out (see PER_SOURCE_CAP).
const POOL_K = 20;
// Max chunks any ONE source document may occupy in the served set.
//
// Why this exists: the corpus holds 8 near-duplicate resume lanes plus long
// site pages, so a single document routinely hogged the window and starved the
// expected source. Measured 2026-07-15 on the live 381-chunk index: q c42
// spent 9 of 15 slots on resumes, CO7 8 of 15; systems.html took 4 of 15 on
// c61 and for-anthropic.html 4 of 15 on AN1. Five golden questions had their
// expected source sitting at raw rank 16-19, one slot outside the window.
//
// Measured head-to-head, full 103-question golden set at topK=15:
//   no cap  92.2% (95/103) FAIL   cap=3  94.2% FAIL
//   cap=2   94.2% (97/103) FAIL   cap=1  97.1% (100/103) PASS
// cap=1's miss set (c47, c75, CO7) is a strict SUBSET of the baseline's, so it
// regresses nothing; the 3 that remain are the two documented-wrong golden
// entries (c47, c75) plus one genuine miss (CO7).
//
// Read the win honestly: cap=1 at 15 returns the same recall as a raw topK=20
// (100/103) while serving 15 cards instead of 20, all from distinct documents
// (avg distinct sources 11.6 -> 13.8). It buys topK=20's reach without showing
// duplicate cards.
//
// 100/103 is the measured ceiling for THIS query configuration (one query, pool
// <= 20) -- NOT a corpus ceiling. c47 and c75 are unreachable on the merits
// (documented-wrong golden entries), but CO7 was only ever observed absent from
// the top 20; its expected source could rank deeper and be reachable via a
// two-pass query (ids only, pool up to 100 -> cap -> getByIds). That was never
// tested, so it is not claimed either way. POOL_K stays at 20 because nothing
// measured so far justifies the second round trip, not because 100/103 is a
// proven ceiling.
//
// Phase C caveat: generation wants context DEPTH (several chunks of the best
// doc), which is the opposite of this. Phase C should read its own context
// server-side rather than raise this constant.
const PER_SOURCE_CAP = 1;

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

// Chunk `text` is authored FOR the assistant: it carries policy meta-language
// ("For the assistant:", "Must NOT:", hard limits) that instructs generation
// and, by necessity, names the things it forbids -- including the relocation
// destination the assistant must never state. That text is safe to hold in
// Vectorize metadata (Phase C reads it server-side, inside the Worker) but is
// NOT safe to return over a public API. Shipped 2026-07-15 unstripped: the
// preview page rendered "Never name Spain or any specific country/city" to
// anyone who asked about availability, and any caller could curl the same.
// Strip at the response boundary so no re-index is needed and so the leak
// cannot come back via a page that innocently renders what the API returns.
//
// Matching policy by line-prefix does not work: the kb files phrase it a dozen
// ways ("**For the assistant:**", "**What the assistant must NOT do:**",
// "**Note to Mitchell (not for the assistant to surface)**", "**All facts here
// are safe for the assistant to state**"). A prefix denylist leaked all three
// of the last ones on the first attempt. Use the property that actually holds:
// policy paragraphs are the ones that TALK ABOUT THE ASSISTANT. Drop any
// paragraph mentioning it, plus any naming an excluded term.
//
// Measured against the 375-chunk corpus 2026-07-15: drops 48 of 2176
// paragraphs (2.2%), leaves 0 chunks without an excerpt, and 0 leaks. Erring
// toward over-stripping is correct here -- a dropped sentence costs an excerpt,
// a leaked one costs the exclusion policy.
//
// NOTE the deliberately loose word boundaries: "layoff" must also catch
// "layoffs" (the plural leaked past \blayoff\b on the first attempt).
// Enumerated from the corpus rather than guessed (grep '^\*\*.*\*\*' kb/).
// Every policy marker in kb/ contains the word "assistant" -- "For the
// assistant:", "Assistant response pattern:", "Approved framing (assistant,
// third person):", "What the assistant must NOT do:", "Suggested assistant
// response:", "One-liner the assistant can use:", "Note to Mitchell (not for
// the assistant to surface)" -- with exactly ONE exception: a bare
// "**Must NOT:**" (4 uses). That exception leaked to the live page.
// Content-bearing bold leads ("The honest scope limit:", "Third-party
// verified:", "Next 30 days:") deliberately survive.
const POLICY_MARKER = /\bassistant\b|\bmust not\b/i;
const NEVER_PUBLIC = /Spain|Barcelona|Madrid|laid off|layoff|garden leave/i;

function publicExcerpt(text) {
  if (typeof text !== 'string') return '';
  return text
    .split(/\n{2,}/)
    .filter((p) => {
      const t = p.trim();
      if (!t) return false;
      return !POLICY_MARKER.test(t) && !NEVER_PUBLIC.test(t);
    })
    .join('\n\n')
    .trim();
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
  // Over-fetch the pool, then diversify down to topK below.
  const results = await env.VECTORIZE.query(embedded.data[0], { topK: POOL_K, returnMetadata: 'all' });

  const candidates = results.matches
    .map((m) => ({
      score: m.score,
      source: m.metadata?.source,
      docTitle: m.metadata?.docTitle,
      typeTag: m.metadata?.typeTag,
      // public-safe: assistant-policy paragraphs removed. Phase C must read
      // the FULL text from Vectorize metadata server-side, never from here.
      text: publicExcerpt(m.metadata?.text),
    }))
    // a chunk that is nothing but policy has no public excerpt to show; drop
    // it from the response rather than emit an empty card. Runs BEFORE the cap
    // so a policy-only chunk cannot burn its document's slot and silently
    // suppress that source entirely.
    .filter((m) => m.text.length > 0);

  // Diversify: walk score-desc, skipping any document already at PER_SOURCE_CAP.
  // Vectorize returns matches sorted by score, and both .map and .filter above
  // preserve that order, so first-seen is always the document's best chunk.
  const perSource = new Map();
  const matches = [];
  for (const m of candidates) {
    // Guard: a chunk with no source metadata would otherwise share one bucket
    // with every other such chunk and cap them collectively. Give each its own.
    const key = m.source ?? Symbol('unkeyed');
    const used = perSource.get(key) ?? 0;
    if (used >= PER_SOURCE_CAP) continue;
    perSource.set(key, used + 1);
    matches.push(m);
    if (matches.length >= topK) break;
  }

  return Response.json({ query, matches });
}
