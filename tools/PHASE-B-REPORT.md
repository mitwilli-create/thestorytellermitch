# Phase B — Retrieval backbone: build report

**Built:** 2026-07-15 · **Status:** functional, tuned, **gate met** · **Deployed** (retrieval only; Phase F still handles the staged launch of the chat layer)

**Several hit rates appear in this report. They are not interchangeable** — each was measured against a different corpus *and* a different retrieval config, so always read the state, never just the number:

| figure | state it describes | corpus | config |
|---|---|---|---|
| **97.1% (100/103)** | **current, and what this code serves.** Verified on a clean index (`vectorCount` asserted exactly) | 382 chunks | cap=1, topK=15, pool=50 |
| 92.2% (95/103) | **what production served before the cap** — the regression it fixes | 381 chunks | no cap, topK=15 |
| 94.2% (97/103) | the pre-#108 corpus on a **clean** index — i.e. what 95.1% claimed to be | 376 chunks | no cap, topK=15 |
| ~~95.1% (98/103)~~ | **NEVER REAL — do not quote it.** Orphan-inflated; see below | — | — |

> ### The 95.1% baseline was never real, and the attribution built on it was wrong. Corrected 2026-07-16.
>
> An earlier version of this table called 95.1% "historical" — measured against a 377-chunk corpus before that day's merges. **That is not what happened.** 95.1% is not reproducible from *any* committed corpus state:
>
> - **The pre-#108 corpus measures 94.2% on a clean index**, not 95.1%. The gate had **never passed** before the cap.
> - The inflation was exactly **one question (AN1)**, which fails on every clean corpus. It passed only via an **orphan vector** — `kb-index.mjs` upserted without deleting, and ids are positional (`__c0`, `__c1`, …), so re-chunking renumbers them and strands retrievable vectors that no rebuild overwrites. The old ingest poll accepted `vectorCount >= expected`, which called an orphaned index healthy.
> - **`for-anthropic.html` edits (#114) were innocent** — the earlier note blamed them. Swapping #114's pre-rename text back into the live index for `for-anthropic__c2` left AN1's ranks byte-identical (for-anthropic at 2/4/5/11, stories.html at 16). A 4-word heading rename moved nothing.
> - Of the six merges that landed 2026-07-15, **only #108** (the 8th resume lane) changed the corpus at all — +5 chunks — and it broke exactly **c42 and c61**. #112, #114, #107, #115 and #104 changed **zero** chunks between them.
>
> **What is true and still worth keeping:** nothing reindexes on merge, so the index does silently drift from the site. That gap is now closed by `tools/kb-corpus-guard.mjs` + a CI step, and the orphan class by an exact-count assert in `kb-index.mjs`.
>
> *Standing lesson:* **a hit rate is a property of an index, not of a corpus.** Never quote one without the `vectorCount` it was measured at, and never compare two numbers measured against indexes you did not wipe.

Everything below the addendum was written against the 95.1% (377-chunk) state; where an older section calls 95.1% "current," read it as the artifact described above, not a baseline.

**Re-verified:** 2026-07-15, every figure below re-measured against the live corpus and `worker/index.js`. The report had drifted from the code on several points (pooling mode, gate status, chunk counts, the residual-gap list); see the **Correction log** at the bottom for what changed and why. Figures here are current as of that pass.

## What was built

- `tools/kb-build.mjs` — assembles the retrieval corpus: 26 `kb/*.md` files + an explicit allowlist of 20 site pages (case studies, narrative pages, `for-*` pages — never `relocation-os.html`) + 7 `resumes-src/*.md` + 4 `assets/site-data/*.json`. Zero npm dependencies, matching this repo's existing `tools/*.mjs` convention. Chunks kb/resume markdown by `##` heading, site pages by a 180-word sliding window (hand-rolled HTML stripper, no DOM parser available). Em-dash gate inherited from `build-stories.mjs`'s pattern. Output: **375 chunks (35 kb-authored, 212 site-page, 33 resume, 95 site-data)** — measured 2026-07-15 ~13:25 PDT, deterministic across repeated runs. *Read this as a snapshot, not a constant:* an independent count the same day reported 376 (36 kb-authored), differing only in the kb-authored bucket. `kb/` was being actively edited while this pass ran, which is the likely explanation. The count moves with `kb/`; re-run `node tools/kb-build.mjs` rather than quoting this figure.
  - **Why resume chunks fell 56 → 33 (intentional, not a regression).** The thin-section merge in `chunkMarkdownByHeading` (`MIN_SECTION_WORDS = 80`, added for the logistics-file hijack fix) applies to `resumes-src/` too, since resumes share that function with `kb/`. Arithmetic verified: the 7 resumes split into 70 raw `##` sections → 56 after the `>= 10`-word filter (this is the old 56) → 33 after the thin merge. No resume content is lost to the merge; short sections are concatenated onto their neighbour, not dropped. The merge is doing exactly what it was added to do: resumes are the most section-dense source in the corpus, so they absorb most of the effect.
  - **One real (pre-existing) drop worth knowing about:** each resume's `## Education` section is 8 words, which is below the `>= 10`-word filter that runs *before* the merge, so it is silently discarded in all 7 resumes. This is not new (it was equally true at 56 — that count already reflects the filter), and it is not the cause of the 56 → 33 change, but it does mean the corpus cannot currently answer "where did he go to school" from a resume. Education also appears in prose on `about.html`, so the corpus is not blind to it. Left as-is rather than fixed in a documentation pass; see **Open items**.
- **Cloudflare Vectorize index** `thestorytellermitch-kb` (768-dim, cosine, `@cf/baai/bge-base-en-v1.5` preset) — a new, live account resource.
- `worker/index.js` — the site's first server-side Worker code (previously pure static assets). Two routes: `POST /api/kb-index` (secret-gated via `KB_INDEX_SECRET`, local/CI build-time only, never public) and `POST /api/ask` (public, read-only retrieval — embeds a query, Vectorize similarity search, returns top-k chunks with source metadata; **no LLM generation yet**, that's Phase C).
- `wrangler.jsonc` updated: `main` + `assets.binding` (Workers-with-assets hybrid) + `ai` binding + `vectorize` binding. No `run_worker_first` needed — `/api/*` has no matching static file, so it naturally falls to the Worker.
- `tools/kb-index.mjs` — local driver that POSTs the built corpus to the dev server's indexing route.
- `tools/kb-eval-golden-set.json` — 103 questions (of the original 350) with expected sources, derived from the Phase A super-report + coverage matrix, corrected against real eval evidence (see below).
- `tools/kb-eval.mjs` — runs the golden set against a live `/api/ask` endpoint, reports hit rate, writes a full per-question report.

## Real infrastructure fix required

`wrangler` auto-loads this project's `.env`, which holds a `CLOUDFLARE_API_TOKEN` lacking Vectorize/Workers AI scope — this silently overrides the working OAuth session and breaks `wrangler vectorize`/`wrangler dev`, exactly the failure mode `deploy.sh` already documents and works around for `deploy`. Same fix applied here: run these commands from a directory with no `.env` (a working-tree copy, since `deploy.sh`'s `git archive HEAD` trick doesn't apply to uncommitted work).

## Tuning findings (empirical, not assumed)

1. **Embedding pooling mode matters, and a bad measurement is worse than no measurement.** Cloudflare's docs recommend `cls` pooling over the `mean` default for larger inputs. An early run appeared to refute that (`cls` 73.8% vs `mean` 80.6% at topK=8) and `mean` was pinned on that basis. **That comparison was methodologically invalid — it compared two different corpus versions**, so it measured the corpus change, not the pooling mode. Re-run head-to-head on *identical* corpora (post gap-fix, `embedText` scheme) at topK=15, the docs were right: **`cls` 96.1% vs `mean` 93.2%**. **`cls` is what is pinned in `worker/index.js`** (`EMBED_MODEL` block, and it is passed on both the index and query paths), with the measurement in a comment so a Workers AI default change can't silently flip it. The two modes' vectors are incompatible, so changing it requires a full index wipe + re-index.
   *Standing lesson:* an A/B that moves two variables measures neither. The invalid number survived in this report long enough to describe the opposite of what the code does.
2. **Most of the gap was ranking precision, not retrieval failure.** The right chunks are usually *in* the corpus and *findable*; they just don't always rank in the top few. **Operating default is topK=15** (`DEFAULT_TOP_K` in `worker/index.js`; `MAX_TOP_K` is 20). Re-measured 2026-07-15 on the current corpus:

   | topK | hit rate | gate (≥95%) |
   |---|---|---|
   | 8 | 84.5% (87/103) | FAIL |
   | 15 | **95.1% (98/103)** | **PASS** ← production default |
   | 20 | 97.1% (100/103) | PASS |

   **The earlier "noise past 15" finding no longer holds.** It was measured under `mean` pooling on the pre-split corpus, where topK=20 scored *worse* than 15 (91.3%). On the current corpus topK=20 is the best measured setting, +2pp over the default. That is a live tuning option, not a decision this pass made; see **Open items**.
3. **The original golden set had several too-narrow entries.** Seven questions (c28, c34, c40, c45, c49, CU48, CO10) were corrected after verifying in the actual eval output that additional sources are legitimate, substantive answers (e.g., `comms.html` was a strong rank-2 match for a question I'd only mapped to `about.html`; `assets/site-data/stories.json` is literally the same content as `stories.html` in another format). Each correction is noted inline in the golden-set JSON with the evidence.
4. **`tools/kb-eval.mjs` had silently drifted from production.** Its `--topK` default was 8 while `worker/index.js` served 15, so a plain `node tools/kb-eval.mjs` run measured a setting production doesn't use and reported a false **84.5% FAIL** against a corpus that passes at 95.1%. Fixed: the eval default now tracks `DEFAULT_TOP_K` (15), with a comment on both sides to sweep them together. Use `--topK` only for deliberate head-to-head runs like the table above. *Standing lesson:* an eval that doesn't measure what production serves is a random number generator with a plausible face.

## Residual known gaps (5 of 103, re-measured 2026-07-15)

**The previous list of 8 gaps in this section is obsolete — all 8 now pass.** They were measured under `mean` pooling against the pre-split corpus. The `cls` fix (finding 1) plus the `kb/gaps-and-honest-answers.md` split (see below) closed every one of them. The current misses at production topK=15 are a different set of 5:

| Question | Expected | What actually surfaces instead |
|---|---|---|
| c31 thrive in fast/ambiguous/direct culture | stories.html, career-ops.html | kb/deflect-why-looking.md, kb/the-edge.md, kb/identity-throughline.md |
| c34 hired/managed/scaled writers or educators | about.html, comms.html | kb/honest-nos.md (twice), content-editorial resume |
| c47 AI-generated vs human-crafted content | voice-os.html | kb/infra-literacy.md, content-ops.html, kb/how-i-build.md |
| c75 technical discovery with a vague customer | for-elevenlabs.html | kb/honest-nos.md, stories.json, kb/the-edge.md |
| CO7 depth on TPM fundamentals | resumes-src/…-ai-program-manager.md | for-fluidstack.html, stories.html, stories.json |

Three of these (c31, c47, c75) expect a **site page** but get **kb files** instead. That is the mirror image of the failure the `embedText` scheme was built to fix (site chunks losing to question-phrased kb chunks), which suggests the title-enrichment/policy-strip balance in `finalizeChunk` is now tipped slightly the other way rather than being simply wrong. Worth a look before adding content. c34 is notable because it is one of the *broadened* golden-set entries from finding 3: even with `comms.html` accepted as legitimate, neither expected source retrieves.

**The old attractor pattern is resolved, and the fix was the one this report predicted.** `kb/gaps-and-honest-answers.md` (flagged here as a likely generic "hedging/honesty" attractor, wrong top-match on c37/AN10/FS48) **no longer exists** — it was split into narrower files, and `kb/` grew from 20 to 26 files. That was Option 2 below, and it worked: all three of its misses now pass. A milder version of the same effect may persist in its successor `kb/honest-nos.md`, which is the wrong top-match on 2 of the 5 current misses (c34, c75) — smaller than the 3-of-8 it replaced, but the same shape, and the same remedy would likely apply.

**Spot-check on the single highest-stakes question** (cluster c1, "why on the market," asked by all 7 personas): `kb/deflect-why-looking.md` ranks #1 cleanly on the full golden-set phrasing (score 0.655) **and** on the terse paraphrase "why did you leave Google" (score 0.659). **The earlier terse-vs-full finding here is refuted** — it recorded the short query ranking lower and surfacing `work.html`, and concluded terse queries carry less signal for this model. Under `cls` pooling that reverses: the terse query scores marginally *higher*. Scores are not comparable across pooling modes, so the old 0.606 is not a like-for-like baseline; the ranking conclusion, though, was real and is now wrong. No phrasing-length caveat is currently warranted.

**None of these are unanswerable** — every expected source is real, existing, approved content (already live in Phase A's `kb/` or the site itself). The gap is retrieval ranking, not missing knowledge. Phase C's LLM layer (which reasons over retrieved context rather than doing pure vector lookup) is likely to close some of it on its own. **The "~92% honest ceiling on raw vector retrieval with this model" claimed here is also refuted:** the same model now measures 95.1% at topK=15 and 97.1% at topK=20. That ceiling was an artifact of the pooling bug and the unsplit kb file, not a property of `bge-base`. Worth remembering before reaching for a bigger model on ceiling grounds.

## Options for Mitchell — resolved

1. ~~**Ship as-is at 92.2%**~~ — moot. The gate is met at 95.1%; there is no longer a below-gate ship decision to make.
2. ~~**One more content pass** — split `gaps-and-honest-answers.md` into 3-4 narrower files~~ — **done, and it worked.** The file was split (`kb/` went 20 → 26 files) and all three of its associated misses now pass. Together with the `cls` pooling fix this is what moved 92.2% → 95.1%.
3. **Try a larger embedding model** (`bge-large-en-v1.5`, 1024-dim) — still untested. Would require a full index rebuild (different dimension) and a fresh eval run. **Weaker justification than when first written:** the ~92% "ceiling" that motivated it turned out to be a pooling bug, not a model limit.

## Pending corpus changes — both land BEFORE the next trustworthy eval

Two content corrections are queued on other branches. Both change chunk **text**, and because chunk ids are positional (`__c0`, `__c1`, …), both shift every downstream id in their document. **Neither can ride an incremental build: they need a wipe plus a full re-index.** Any hit rate measured before they land is measured against content that is about to change.

1. **`assets/site-data/picture-lock-run.json` — a phantom dub stage.** The corpus currently indexes `dub: $0.44 ("Spanish cut, earlier logged run")`, and the file's stages sum to **$8.70** (verified in the built corpus, chunk `data-picture-lock-run__c0`, which embeds the full stage-by-stage breakdown). Per the branch carrying the fix, the real logged dub is **$0.42** and the implied **$8.70 was never real**. *Not verifiable from `main` — the fix commit is not reachable here, so treat the corrected figure as pending, not confirmed.* Until it merges, **the retrieval corpus serves a cost number with no basis in the committed manifest**, which is precisely the failure `kb/metrics-provenance.md` exists to prevent. Rebuild after that PR merges.
2. **Exclude the voice-os worked-run trace from the corpus.** The `$14.20` draft quotes on `voice-os.html` are an approved exclusion. Scope check before implementing: `$14.20`/`$9.51` currently appear in **4 chunks across 3 sources** — `voice-os__c7`, `voice-os__c8`, `picture-lock__c8`, and `kb/metrics-provenance.md` (`kb-metrics-provenance__c0`). The standing rule is that these figures are banned *outside honest-history lines*, so the metrics-provenance chunk is plausibly a legitimate keep. **Do not blanket-strip the number** — decide per chunk, or the corpus loses the very file that documents the provenance. This lands on `kb-build.mjs`'s side once Phase B is committed.

## Open items (not decided this pass)

These came out of the 2026-07-15 re-verification. All are code/content changes, deliberately left un-made in what was a documentation-correction pass:

1. **Raise `DEFAULT_TOP_K` 15 → 20?** Measured +2pp (95.1% → 97.1%), and `MAX_TOP_K` is already 20 so no clamp change is needed. Costs a little latency and feeds Phase C more context per query. The old "noise past 15" objection was measured under the pooling bug and no longer stands.
2. **Restore each resume's `## Education` section to the corpus?** Currently dropped in all 7 resumes by the `>= 10`-word filter (8-word sections). Smallest honest fix is to let the thin-merge absorb sub-10-word sections instead of filtering them out first, so they ride along with a neighbour the way every other short section does.
3. **Investigate kb-vs-site-page balance in `finalizeChunk`?** 3 of the 5 current misses expect a site page and get kb files.
4. **Split `kb/honest-nos.md`?** Same attractor shape as its predecessor, at lower amplitude (2 of 5 misses). The predecessor's split is the precedent that it works.

## Verification performed

- Full pipeline tested end-to-end via `wrangler dev --remote` against live Cloudflare resources (not mocked): corpus build → embed → Vectorize upsert → semantic query → correct results, confirmed with real spot-checks before and after tuning.
- 103-question golden-set eval run at topK 8/15/20 with full result logging (`tools/.kb-eval-report.json`, gitignored — regenerate via `node tools/kb-eval.mjs`).
- Nothing deployed to production; `thestorytellermitch-kb` Vectorize index and the wrangler.jsonc/worker.js changes are live-account/repo state but not shipped to the public site (deploy.sh untouched, not run).

### Re-verification pass, 2026-07-15

Every claim in this report was re-checked against source rather than carried forward. Method: read `worker/index.js` for the pinned constants; ran `node tools/kb-build.mjs` (twice, deterministic) for chunk counts; ran the golden set at topK 8/15/20 against `wrangler dev` on 127.0.0.1:8787; re-ran the c1 spot-check directly against `/api/ask`; counted golden-set correction notes from the JSON.

Two limits on this pass, stated rather than papered over:

- **The `cls` 96.1% vs `mean` 93.2% head-to-head was not re-run.** Re-measuring `mean` means wiping and re-indexing the whole corpus (the modes' vectors are incompatible), then re-indexing back to `cls` — destructive to live index state, for a conclusion the re-measured `cls` number already supports. Both figures date from the pre-split corpus and should be read as a *relative* result on that corpus, not as current absolutes. The direction (`cls` wins) is what the pin rests on, and that is unchallenged.
- **The eval measures the live Vectorize index, not the freshly built local corpus.** This pass deliberately did not re-index, to avoid mutating live state while auditing it.

> ### ⚠️ STOP — the live Vectorize index is BROKEN as of 2026-07-15 ~13:25 PDT. Do not trust a fresh eval run right now.
>
> **A re-index was started by another session and stalled part-way.** `wrangler vectorize info thestorytellermitch-kb` reports **55 vectors against a 375-chunk corpus**, frozen at the same `processedUpToMutation` across repeated samples (20:25:06Z). Only `assets/site-data/*` chunks survive: querying a resume chunk's own verbatim text no longer retrieves it, and `get-vectors` reports current resume ids (e.g. `…forward-deployed__c0`) as absent. An eval run at 13:26 PDT scored **3/103 (2.9%)** — that number is an artifact of the half-empty index, **not** a retrieval regression.
>
> **Root cause (confirmed by the session that owns the re-index, and the single most important line in this file):** the index was **deleted and recreated while `wrangler dev` still held the old binding**, so roughly **320 upserts were silently dropped while returning HTTP 200**. The indexer reported success for writes that went nowhere. This is why `indexed` counts cannot be trusted as evidence of anything: **only a post-upsert `vectorCount` read proves the corpus is actually in the index.** If you delete/recreate a Vectorize index, restart `wrangler dev` before re-indexing.
>
> **The 95.1% headline in this report predates the wipe.** It was measured against the fully-populated index earlier in the same session, through the same production code path (`cls`, topK=15), and is independently corroborated by a separate measurement of 98/103. It stands as the corpus's real hit rate; it is simply not reproducible until the index is repopulated.
>
> **To restore:** re-run the corpus build and the full `tools/kb-index.mjs` upsert (375 chunks), confirm `vectorCount` reaches 375, then re-run `node tools/kb-eval.mjs`. Expect ~95.1%. Anything far below that means the upsert did not finish — check the count before reading the hit rate.
>
> **Also note `kb-index.mjs` upserts but never deletes.** Chunk ids are positional (`__c0`, `__c1`, …) and the thin-merge renumbered them, so a partial or repeated re-index can leave orphaned vectors from a previous chunking scheme that no rebuild will ever overwrite. A clean wipe before re-index is the safe move. This is worth a permanent fix in the indexer rather than a manual habit.

## Correction log — 2026-07-15

What this report asserted, versus what the code and corpus actually do. Recorded rather than quietly overwritten, because the drift pattern is itself the lesson: **every wrong claim below was a real measurement that outlived the thing it measured.**

| # | Report said | Verified reality |
|---|---|---|
| 1 | Pooling pinned to `mean`; `cls` scored worse (73.8% vs 80.6% at topK=8) | Pinned to **`cls`**. The topK=8 comparison was invalid (different corpus versions); the valid head-to-head at topK=15 has `cls` ahead, 96.1% vs 93.2% |
| 2 | Gate not met, 92.2% vs 95% target | **Gate met: 95.1% (98/103)** at production topK=15 |
| 3 | 396 chunks (33 kb-authored, 213 site-page, 56 resume, 95 site-data) | **375 chunks (35, 212, 33, 95)**. Resume 56 → 33 is the intentional thin-merge; see the arithmetic under "What was built" |
| 4 | 20 `kb/*.md` files | **26** — `gaps-and-honest-answers.md` was split, as this report recommended |
| 5 | topK=20 → 91.3%, "noise past 15" | **topK=20 → 97.1%**, the best measured setting. The old ordering was an artifact of `mean` pooling |
| 6 | 8 residual gaps (c37, c46, c55, c69, AN5, AN10, FS48, OAI5) | **All 8 pass.** 5 different questions miss now (c31, c34, c47, c75, CO7) |
| 7 | `gaps-and-honest-answers.md` is a wrong-match attractor | File no longer exists. Successor `kb/honest-nos.md` shows a milder version of the same shape |
| 8 | c1 spot-check: 0.606, terse paraphrase ranks lower and surfaces `work.html` | **0.655 full / 0.659 terse**, both rank #1. The terse-vs-full conclusion is refuted |
| 9 | "~92% honest ceiling on raw vector retrieval with this model" | Refuted — same model, 95.1% / 97.1%. The ceiling was the pooling bug |
| 10 | "Six questions (c28, c34, c40, c45, c49, CU48, CO10)" | **Seven** — the list always had seven ids; the prose miscounted |

**A related drift, fixed before this pass and recorded here for completeness:** `tools/kb-eval.mjs`'s topK default was 8 while production served 15, so a plain eval run reported a false 84.5% FAIL. Now tracks `DEFAULT_TOP_K`. See tuning finding 4.

**Why this drifted, in one line:** the report was written while the corpus, the pooling mode, and the kb file set were all still moving, and none of its numbers carried the state they were measured against. The dated stamps and corpus caveats added in this pass are the cheap fix; re-running the eval before trusting any figure here is the real one.

## 2026-07-15 addendum: per-source diversity cap (92.2% -> 97.1%)

**The state this fixed (historical — superseded by the 97.1% at the top of this report).** After the day's content merges (an 8th resume lane, `for-anthropic.html` edits), a full reindex measured **92.2% (95/103), gate FAIL** — see the memory note on the index going stale on content merges. Nothing reindexes on merge, so the 95.1% headline had been measured against a corpus that no longer matched the site. Production served that 92.2% corpus until this change shipped.

**Root cause: near-duplicate document crowding, not ranking quality.** Measured on the live 381-chunk index at topK=15:

| q | symptom |
|---|---|
| c42 | **9 of 15 slots** were resumes; neither expected source appeared |
| CO7 | **8 of 15** resumes; the wrong resume lane outranked the right one |
| c61 | `systems.html` took **4 of 15**; only 8 distinct sources |
| AN1 | `for-anthropic.html` took **4 of 15** |

Five of the eight misses had their expected source at **raw rank 16-19** — one slot outside the window. The corpus holds 8 near-identical resume lanes, so one document routinely starved the rest.

**Fix:** over-fetch a pool of 20 (`POOL_K`; a hard Vectorize ceiling when `returnMetadata:'all'`, not a tuning choice) and let any one source document occupy at most `PER_SOURCE_CAP` slots of the served set. The policy-only filter now runs *before* the cap, so a policy-only chunk can no longer burn its document's slot and suppress that source entirely.

**Head-to-head, full 103-question golden set, topK=15, same index:**

| cap | hit rate | gate |
|---|---|---|
| none (baseline) | 92.2% (95/103) | FAIL |
| 3 | 94.2% (97/103) | FAIL |
| 2 | 94.2% (97/103) | FAIL |
| **1 (shipped)** | **97.1% (100/103)** | **PASS** |

Simulated offline against live `topK=20` responses, then **confirmed end-to-end** by running the modified Worker locally (`wrangler dev --remote`) against the same production index: 100/103, identical miss set.

**Read the win honestly.** cap=1 at 15 returns the *same* recall as a raw `topK=20` (100/103) while serving 15 cards instead of 20, all from distinct documents (avg distinct sources 11.6 -> 13.8). It buys topK=20's reach without duplicate cards, and it does not raise the served card count. The golden-set metric is source-level recall@15, which rewards diversity by construction — so the score movement overstates the retrieval-quality gain. The user-facing gain is real but narrower: no more 9-of-15 resume walls.

**No regressions.** cap=1's miss set (c47, c75, CO7) is a strict **subset** of the baseline's eight; every question that passed still passes. The three that remain are unreachable by ranking: c47 and c75 are the documented-wrong golden entries, CO7 a genuine miss whose expected source never appears even at topK=20.

**100/103 is the measured ceiling for this query configuration** (one query, pool ≤ 20) — **not a corpus ceiling.** c47 and c75 are unreachable on the merits (documented-wrong golden entries), but CO7 was only ever observed *absent from the top 20*; its expected source could rank deeper and be reachable via a two-pass query (ids only, pool up to 100 → cap → `getByIds`). That was never tested, so it is claimed neither way. `POOL_K` stays at 20 because nothing measured so far justifies the second round trip, not because the ceiling is proven. Revisit if the golden set is corrected, or if CO7 is worth a deep-pool probe.

**Cost:** cap=1 can serve slightly fewer cards than requested when the pool holds fewer distinct sources than topK (c42 returns 13, not 15). Acceptable: 13 distinct beats 15 with 4 duplicates.

**Phase C caveat:** generation wants context *depth* (several chunks of the best document), which is the opposite of this cap. Phase C should read its own context server-side from Vectorize metadata rather than raise `PER_SOURCE_CAP`.

## Not done (deferred)

Everything in Phase C onward: system prompt, tools, streaming, the chat widget, guardrails, staged launch.

Also deferred: **the standing process gap** — no CI step reindexes or re-evals when `kb/`, `resumes-src/`, an allowlisted site page, or `assets/site-data/` changes, so any content PR silently drifts the index from main. This cap raises the floor; it does not close that gap.

## Addendum — 2026-07-16: the baseline was fake, the pool was starving, and both classes are now gated

Triggered by a post-merge rebuild reading 92.2% against a 95.1% baseline. The regression was mostly not in the merges; it was in the baseline.

### What changed in the code

- **`POOL_K` 20 → 50.** The note pinning it at 20 said *"20 is a hard Vectorize ceiling for a single-pass query… going deeper needs a two-pass query (ids only, pool up to 100 → cap → getByIds)."* **That is wrong.** Measured against the live index: `topK=60` with `returnMetadata:'all'` fails with `VECTOR_QUERY_ERROR 40025 — "max top K is 50, but got 60"`; **`topK=50` with full metadata succeeds in one pass.** No second round trip exists to avoid.

  This mattered more than a comment fix, because the cap **drops** over-cap chunks rather than demoting them, so the served set can be no larger than the pool has distinct sources. Measured over the golden set at topK=15:

  | POOL_K | queries served < 15 cards | avg cards | worst |
  |---|---|---|---|
  | 20 (as shipped) | **51 / 103** | 13.80 / 15 | c26 got **7** |
  | 50 | **0 / 103** | 15.00 / 15 | — |

  Golden-set hit rate is **identical** (100/103) either way — hit rate only asks whether the expected source appears *at all*, so it cannot see a starved context window. Phase C would have: on c26, POOL_K=20 hands it 7 cards instead of 15. The old comment's *"avg distinct sources 11.6 → 13.8"* was reporting this shortfall and reading it as a diversity win.

- **`kb-index.mjs` asserts `vectorCount == corpus length`** (was `>=`). A `>=` check calls an orphaned index healthy, which is exactly how 95.1% was measured and believed. Verified by injecting a synthetic orphan: the indexer refused; the old check would have printed "Done".

- **`tools/kb-corpus-guard.mjs` + a CI step** fail any PR that changes the corpus without a re-index and re-eval. `tools/kb-corpus-manifest.json` is the tracked fingerprint of what the live index was actually built from. `--update` refuses to write unless a *passing* eval report exists, so the gate cannot be cleared without really re-indexing. Regression-tested against replays of #108 (new resume lane → FAIL, names the source), #114 (text-only rename → FAIL, "no chunk COUNT moved"), and a CSS-only PR (→ PASS).

### CO7: open question closed, and the answer is no

The cap comment recorded CO7 as *"only ever observed absent from the top 20; its expected source could rank deeper and be reachable via a two-pass query… never tested."* **Tested 2026-07-16 with a 50-deep single-pass pool:** `resumes-src/…-ai-program-manager.md` is absent from the top 20 **distinct** sources entirely, while five other resume lanes surface ahead of it (marketing @1, forward-deployed @4, devrel @6, ai-solutions-architect @8, ai-enablement @13). Since `MAX_TOP_K` is 20, **no pool depth can reach it** — a two-pass query to 100 would change nothing.

So **100/103 is the real ceiling for single-query dense retrieval here**: c47 and c75 are documented-wrong golden entries, and CO7 is a content question (does that lane contain the TPM-fundamentals vocabulary at all?), not a retrieval-tuning one. Broadening the golden set for CO7 was considered and **declined** (owner, 2026-07-16): the cap fixes c42/c61 on their *original* expected sources, and editing the answer key to match a failure is what makes a gate unfalsifiable.

### Verification performed

Full runbook reindex from current `main` (`316ef19`): dev down → wipe + recreate → dev up **fresh** → build (382 chunks) → index (exact count asserted) → eval. `tools/kb-eval.mjs` **unmodified, default topK**: **100/103 = 97.1%, gate PASS**. Card fill: 15.00/15 on all 103. `node tools/verify.mjs`: all invariants hold.

**Note for whoever deploys next:** the live index was rebuilt from `316ef19`, so it now matches `main` — but #121/#102/#117/#118/#119 had already invalidated it before this pass (24 chunks' text had changed across `about.html`, `picture-lock.html`, `for-fluidstack.html`). That is precisely the drift the CI guard now catches at PR time.
