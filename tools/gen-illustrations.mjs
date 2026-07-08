#!/usr/bin/env node
// Generate abstract system illustrations via Gemini image API (Nano Banana 2).
// Non-representational by policy: these depict SYSTEMS, never real events/people.
// Usage: GEMINI_API_KEY=... node tools/gen-illustrations.mjs
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  // fall back to career-ops .env
  const env = readFileSync(resolve(process.env.HOME, 'Documents/career-ops/.env'), 'utf8');
  KEY = env.match(/^GEMINI_API_KEY="?([^"\n]+)"?$/m)?.[1];
}
if (!KEY) { console.error('no GEMINI_API_KEY'); process.exit(2); }

const STYLE = 'Minimal brutalist technical editorial illustration on a near-black background (hex 0a0a0b). Thin bone-white (hex ece8e1) diagram linework, one sparse oxblood red (hex 8a3a33) accent element. High contrast, cinematic, lots of dark negative space, flat 2D diagram aesthetic, no photorealism, absolutely no text, letters, numbers, or logos anywhere in the image. Wide 16:9 composition.';

const JOBS = [
  ['illo-triage-agent.jpg', `${STYLE} Subject: an automated communications triage machine seen in cross-section: many small incoming message envelopes flowing as a stream into a sorting mechanism with three gates; most envelopes routed onward automatically along clean paths, a few diverted upward to a small human silhouette at a desk; one oxblood envelope highlighted mid-sort.`],
  ['illo-digital-twin.jpg', `${STYLE} Subject: a voice made of a single elegant audio waveform passing left to right through a row of six measuring gates or calipers, each gate slightly adjusting the wave; rejected fragments falling away below as faint dust; the final wave exiting clean and continuous with one oxblood pulse.`],
  ['illo-agent-fleet.jpg', `${STYLE} Subject: a constellation-style fleet map of about fifty small autonomous agent nodes arranged in orbital schedules around one central orchestrator node, thin connection lines, a few nodes emitting tiny heartbeat pulse rings, one node highlighted oxblood; feels like an air-traffic control diagram for software.`],
];

const MODEL = 'gemini-3.1-flash-image';
for (const [file, prompt] of JOBS) {
  const out = resolve(SITE, 'assets/stills', file);
  if (existsSync(out) && !process.argv.includes('--force')) { console.log('exists, skip:', file); continue; }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
    }),
  });
  if (!res.ok) { console.error(`${file}: HTTP ${res.status} ${await res.text()}`); continue; }
  const j = await res.json();
  const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) { console.error(`${file}: no image in response`, JSON.stringify(j).slice(0, 300)); continue; }
  writeFileSync(out, Buffer.from(part.inlineData.data, 'base64'));
  console.log('wrote', file, `(${(Buffer.from(part.inlineData.data, 'base64').length / 1024).toFixed(0)}KB)`);
}
