# broll-pipeline cost model
July 2026. Two kinds of numbers below, labeled: published rates (estimates until your run logs them) and manifest-derived figures from the logged demo run. The manifest prices every call from the published rate at call time and is built to reconcile line for line against the provider dashboards; treat provider billing as the final word.

## Published rates

| Stage | Provider | Rate | Estimate for a 60s short |
|---|---|---|---|
| Voiceover (TTS Multilingual v2) | ElevenLabs | $0.10 per 1k characters | ~$0.06 (the demo's 16 beats ran ~600 characters) |
| Music (Eleven Music v2) | ElevenLabs | $0.15 per minute | ~$0.15 |
| Sound effects | ElevenLabs | billed per generation; a handful of short cues | ~$0.07 for 5 generations |
| Dubbing, per target language | ElevenLabs | $0.33 to $0.50 per minute | ~$0.33 to $0.50 |
| Generated shots (adapter to Veo 3.1 Fast) | Google (via fal adapter) | $0.10 per second at 720p or 1080p without audio ($0.15 per second with audio; 4K higher) | ~$2.00 for 3 shots |
| Mograph beats (Playwright render) | local | $0 | $0.00 |

## The logged demo run (manifest-derived, output/run-manifest.json)

The published 53-second cut, as its manifest ledger prints it:

| Line | Estimated cost | Basis |
|---|---|---|
| Audio stack (TTS + music + SFX) | $0.28 | manifest, at published rates |
| Generated shots, retakes included | $5.36 | manifest, at published rates |
| Creative direction (council) | $3.50 | manifest (Anthropic API) |
| Clip review board | $0.37 | manifest (Anthropic API) |
| Carried by the artifacts in the cut | $9.51 | sum of the four lines above |
| All-in, with extra re-rolls, score and foley experiments, and the Spanish dub | $14.20 | full manifest ledger |

Two details worth knowing before you budget: the demo's 75-second music bed logged $0.14 against a $0.19 rate-sheet estimate (the manifest logs what the call actually recorded; when the two disagree, the manifest wins), and the logged Spanish dub came to $0.44 for the 53-second cut, inside the published range. Creative direction is an Anthropic API cost, not an ElevenLabs one; it is in the ledger because the manifest logs every call, whoever bills it.

## The math that matters for a customer

- Video generation is the cost driver. Everything else rounds to pocket change.
- Mograph beats cost nothing and regenerate deterministically, so the mograph-to-gen
  ratio in the script is your main budget dial.
- A single-beat retake (`--reroll-beat N`) re-pays for one shot, not the run.
  Content-hash caching means a full re-run only regenerates what changed.
- `--budget 25` sets a hard spend ceiling; the pipeline stops before crossing it.
- Rule of thumb at these rates: a 60 second short with 3 generated shots and the
  rest mograph lands near $3; a fully generated, creative-directed short with
  retakes lands near $15. Both numbers come with an itemized manifest that
  shows exactly how they were computed.
