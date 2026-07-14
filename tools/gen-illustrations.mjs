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

// BOLD variant: learned from the digital-twin redo. Thin sparse compositions
// disappear into the dark card background. Projects-page illustrations use
// thick strokes, large central mechanism, high fill contrast.
const BOLD = 'Bold brutalist technical editorial illustration on a near-black background (hex 0a0a0b). THICK heavy bone-white (hex ece8e1) diagram strokes with some solid filled shapes, one strong oxblood red (hex 8a3a33) accent element. The central mechanism is LARGE and dominates the frame, high contrast, flat 2D diagram aesthetic, no photorealism, absolutely no text, letters, numbers, or logos anywhere in the image. Wide 16:9 composition.';

const JOBS = [
  ['illo-triage-agent.jpg', `${STYLE} Subject: an automated communications triage machine seen in cross-section: many small incoming message envelopes flowing as a stream into a sorting mechanism with three gates; most envelopes routed onward automatically along clean paths, a few diverted upward to a small human silhouette at a desk; one oxblood envelope highlighted mid-sort.`],
  ['illo-digital-twin.jpg', `${STYLE} Subject: a voice made of a single elegant audio waveform passing left to right through a row of six measuring gates or calipers, each gate slightly adjusting the wave; rejected fragments falling away below as faint dust; the final wave exiting clean and continuous with one oxblood pulse.`],
  ['illo-agent-fleet.jpg', `${STYLE} Subject: a constellation-style fleet map of about fifty small autonomous agent nodes arranged in orbital schedules around one central orchestrator node, thin connection lines, a few nodes emitting tiny heartbeat pulse rings, one node highlighted oxblood; feels like an air-traffic control diagram for software.`],
  // Projects-page set (BOLD style: mechanism-forward, thick, high-contrast)
  ['illo-picture-lock.jpg', `${BOLD} Subject: an assembly line seen side-on: a flat document sheet enters at the left, passes through seven large connected machine chambers in a row, and exits at the right transformed into a framed video screen with a thick caption bar underneath it; inside the chambers the material visibly changes stage by stage from lines of a page, to a large audio waveform, to picture frames, to a film strip; the caption-bar chamber glows oxblood.`],
  ['illo-voice-radar.jpg', `${BOLD} Subject: one complete hexagonal radar chart instrument, fully visible in frame with dark margin around it: six thick spokes from a center hub ending in six small node caps, concentric hexagonal calibration rings, and a bold solid filled irregular hexagon plotted across the six axes showing a measurement; the plotted hexagon is bone-white and one of its six vertices falls short of an oxblood threshold ring, that failing vertex marked with a heavy oxblood dot. A precision gauge, not a target reticle.`],
  ['illo-citation-gate.jpg', `${BOLD} Subject: a massive closed vault gate blocking a path, and a vertical chain of four heavy stacked source blocks feeding upward like a chain of custody into the gate lock mechanism; the chain is complete and the lock is turning, gate cracked open with light; the lock and the final chain link are oxblood; conveys that no answer passes until every link of evidence is connected.`],
  ['illo-three-gates.jpg', `${BOLD} Subject: three enormous sequential gate frames in a row, each gate a different heavy filter silhouette, with a stream of small product shapes flowing through; most shapes are deflected and fall away at each gate, a single shape passes all three and is stamped with a bold oxblood seal on the far right; strict pass-or-reject machine.`],
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
