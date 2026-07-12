// lib/fal.mjs: fal.ai queue adapter for the visual stage. Same shape as
// lib/elevenlabs.mjs: bare fetch, no SDK, every call visible and loggable.
//
// The visual stage is a pluggable provider boundary: this adapter is one
// implementation of it. Auth via FAL_KEY in .env. Model selectable via
// FAL_MODEL_SLUG; rates below are table estimates (fal returns no cost
// header), recorded in the manifest as costSource: "estimate".

const QUEUE = 'https://queue.fal.run';

function key() {
  const k = process.env.FAL_KEY;
  if (!k) throw new Error('FAL_KEY not set: add a fal.ai API key to .env (https://fal.ai/dashboard/keys).');
  return k;
}

const headers = () => ({ Authorization: `Key ${key()}`, 'Content-Type': 'application/json' });

export const DEFAULT_SLUG = 'fal-ai/veo3.1/fast';

// usdPerSec verified against fal.ai model pages 2026-07-08 (720p/1080p, no audio).
// durations = the discrete lengths the model accepts; generateClip picks the
// smallest one >= the beat's seconds and the compositor trims the tail.
export const RATES = {
  'fal-ai/veo3.1/fast': {
    usdPerSec: 0.10,
    durations: [4, 6, 8],
    input: ({ prompt, seconds }) => ({
      prompt,
      aspect_ratio: '9:16',
      duration: `${seconds}s`,
      generate_audio: false,
      resolution: '1080p',
    }),
  },
  // Fallback (verify slug + rate before first use; fal churns quarterly).
  'fal-ai/bytedance/seedance-2.0/fast/text-to-video': {
    usdPerSec: 0.06,
    durations: [5, 10],
    input: ({ prompt, seconds }) => ({ prompt, aspect_ratio: '9:16', duration: seconds }),
  },
};

export function pickDuration(slug, seconds) {
  const r = RATES[slug];
  if (!r) throw new Error(`no RATES entry for ${slug}: add one before using it`);
  return r.durations.find((d) => d >= seconds) ?? r.durations[r.durations.length - 1];
}

export function estimateCost(slug, seconds) {
  const r = RATES[slug];
  return r ? pickDuration(slug, seconds) * r.usdPerSec : 0;
}

// $0 slug-liveness check: a deliberately empty submit returns a validation
// error (4xx with field detail) for a live model, 404 "App not found" for a
// dead slug. Distinguishes drift from auth trouble without spending.
export async function verifyModel(slug = DEFAULT_SLUG) {
  const r = await fetch(`${QUEUE}/${slug}`, { method: 'POST', headers: headers(), body: '{}', signal: AbortSignal.timeout(30_000) });
  const body = await r.text();
  if (r.status === 404) throw new Error(`fal model slug not found: ${slug} (pricing/slug drift; check fal.ai/models)`);
  if (r.status === 401 || r.status === 403) throw new Error(`fal auth failed (${r.status}): ${body.slice(0, 160) || 'check FAL_KEY'}`);
  // a live model rejects the empty probe with a 4xx validation error; 429s and
  // 5xxs are transient queue trouble and must not mark the slug healthy
  if (r.status === 429 || r.status >= 500) return { slug, status: r.status, live: false, detail: body.slice(0, 200) };
  return { slug, status: r.status, live: true, detail: body.slice(0, 200) };
}

async function poll(statusUrl, { deadlineMs = 10 * 60 * 1000, everyMs = 6000, log = () => {} } = {}) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const r = await fetch(statusUrl, { headers: headers(), signal: AbortSignal.timeout(30_000) });
    const j = await r.json();
    if (j.status === 'COMPLETED') return j;
    if (j.status === 'FAILED' || j.error) throw new Error('fal job failed: ' + JSON.stringify(j).slice(0, 300));
    log(`  fal: ${j.status ?? 'polling'}...`);
    await new Promise((res) => setTimeout(res, everyMs));
  }
  throw new Error('fal polling timed out after 10 min');
}

// Shared queue runner: submit -> poll -> return result JSON.
async function queueRun(slug, input, { log = () => {} } = {}) {
  const submit = await fetch(`${QUEUE}/${slug}`, {
    method: 'POST', headers: headers(), body: JSON.stringify(input), signal: AbortSignal.timeout(60_000),
  });
  if (!submit.ok) throw new Error(`fal submit ${submit.status}: ${(await submit.text()).slice(0, 300)}`);
  const { request_id, status_url, response_url } = await submit.json();
  log(`  fal: submitted ${request_id} (${slug})`);
  await poll(status_url, { log });
  const res = await fetch(response_url, { headers: headers(), signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`fal result ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return { out: await res.json(), requestId: request_id };
}

// Still image with legible text (nano banana 2, $0.08/image @1K). Verified
// slug + rate 2026-07-08. Returns { url, path, estCostUsd }.
export async function generateImage({ prompt, outPath, slug = 'fal-ai/nano-banana-2', aspectRatio = '9:16', log = console.log }) {
  const { out, requestId } = await queueRun(slug, { prompt, aspect_ratio: aspectRatio }, { log });
  const url = out.images?.[0]?.url ?? out.image?.url;
  if (!url) throw new Error('fal image result had no url: ' + JSON.stringify(out).slice(0, 200));
  const dl = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  const { writeFileSync } = await import('fs');
  writeFileSync(outPath, Buffer.from(await dl.arrayBuffer()));
  return { url, path: outPath, requestId, estCostUsd: 0.08 };
}

// Animate a still (Veo 3.1 Fast image-to-video, $0.10/s, verified 2026-07-08).
export async function imageToVideo({ prompt, imageUrl, seconds, outPath, slug = 'fal-ai/veo3.1/fast/image-to-video', aspectRatio = 'auto', log = console.log }) {
  const reqSeconds = [4, 6, 8].find((d) => d >= seconds) ?? 8;
  const { out, requestId } = await queueRun(slug, {
    prompt, image_url: imageUrl, duration: `${reqSeconds}s`, generate_audio: false, resolution: '1080p', aspect_ratio: aspectRatio,
  }, { log });
  const videoUrl = out.video?.url;
  if (!videoUrl) throw new Error('fal i2v result had no video url: ' + JSON.stringify(out).slice(0, 200));
  const dl = await fetch(videoUrl, { signal: AbortSignal.timeout(120_000) });
  const { writeFileSync } = await import('fs');
  writeFileSync(outPath, Buffer.from(await dl.arrayBuffer()));
  return { path: outPath, requestId, slug, requestedSeconds: reqSeconds, estCostUsd: reqSeconds * 0.10 };
}

// Text-to-video: submit -> poll -> download. Returns clip metadata for the
// manifest; caller owns caching (sidecar hash) and cost recording.
export async function generateClip({ prompt, seconds, slug = process.env.FAL_MODEL_SLUG ?? DEFAULT_SLUG, outPath, log = console.log }) {
  const rate = RATES[slug];
  if (!rate) throw new Error(`no RATES entry for ${slug}`);
  const reqSeconds = pickDuration(slug, seconds);
  const submit = await fetch(`${QUEUE}/${slug}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(rate.input({ prompt, seconds: reqSeconds })),
    signal: AbortSignal.timeout(60_000),
  });
  if (!submit.ok) throw new Error(`fal submit ${submit.status}: ${(await submit.text()).slice(0, 300)}`);
  const { request_id, status_url, response_url } = await submit.json();
  log(`  fal: submitted ${request_id} (${slug}, ${reqSeconds}s requested)`);
  await poll(status_url, { log });
  const res = await fetch(response_url, { headers: headers(), signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`fal result ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const out = await res.json();
  const videoUrl = out.video?.url ?? out.video_url ?? out.output?.video?.url;
  if (!videoUrl) throw new Error('fal result had no video url: ' + JSON.stringify(out).slice(0, 300));
  const dl = await fetch(videoUrl, { signal: AbortSignal.timeout(120_000) });
  if (!dl.ok) throw new Error(`fal video download ${dl.status}`);
  const { writeFileSync } = await import('fs');
  writeFileSync(outPath, Buffer.from(await dl.arrayBuffer()));
  return { path: outPath, requestId: request_id, slug, requestedSeconds: reqSeconds, estCostUsd: reqSeconds * rate.usdPerSec };
}
