# PictureLock cost model
July 2026. Two kinds of numbers below, labeled: published rates (estimates until your run logs them) and manifest-derived figures from the logged demo run. The manifest prices every call from the published rate at call time and is built to reconcile line for line against the provider dashboards; treat provider billing as the final word.

## Published rates

| Stage | Provider | Rate | Estimate for a 60s short |
|---|---|---|---|
| Voiceover (TTS Multilingual v2) | ElevenLabs | $0.10 per 1k characters | ~$0.06 (the demo's 16 beats ran ~600 characters) |
| Music (Eleven Music v2) | ElevenLabs | $0.15 per minute | ~$0.15 |
| Sound effects | ElevenLabs | billed per generation (as of July 2026; short cues run about a cent and a half each) | ~$0.07, the demo's 5 logged generations |
| Dubbing, per target language | ElevenLabs | $0.33 to $0.50 per minute | ~$0.33 to $0.50 |
| Generated shots (adapter to Veo 3.1 Fast) | Google (via fal adapter) | $0.10 per second at 720p or 1080p without audio ($0.15 per second with audio; 4K higher) | ~$2.00 for 3 shots totaling ~20 generated seconds |
| Mograph beats (Playwright render) | local | $0 | $0.00 |

## The logged demo run (manifest-derived, output/run-manifest.json)

The published 53-second cut, as its manifest ledger prints it:

| Line | Estimated cost | Basis |
|---|---|---|
| Audio stack (TTS + music + SFX) | $0.28 | committed manifest, at published rates |
| Generated shots (10) | $4.40 | committed manifest, at published rates |
| Creative direction (council) | $3.50 | committed manifest (Anthropic API) |
| Clip review board | $0.08 | committed manifest (Anthropic API) |
| Carried by the artifacts in the cut | $8.26 | sum of the four lines above; summing the committed manifest reproduces it |
| At-build ledger, with the discarded re-rolls, score and foley experiments, and the Spanish dub renders | ~$14 | logged at build time; not carried by the committed manifest |

Two details worth knowing before you budget: the demo's 75-second music bed logged $0.14 against a $0.19 rate-sheet estimate (the manifest logs what the call actually recorded; when the two disagree, the manifest wins), and the logged Spanish dub came to $0.42 for the 53-second cut, inside the published range and against a ~$0.44 estimate. The dub is not part of the $8.26 above: it rendered on its own earlier run and the final cut reused the artifact, so it carries a separate receipt. Creative direction is an Anthropic API cost, not an ElevenLabs one; it is in the ledger because the manifest logs every call, whoever bills it.

## The math that matters for a customer

- Two lines drive the budget: video generation ($4.40 carried on the demo run,
  more with discarded retakes) and the creative-direction layer if you run one
  ($3.59 for the demo's council plus review board). The audio stack rounds to
  pocket change.
- Mograph beats cost nothing and regenerate deterministically, so the mograph-to-gen
  ratio in the script is your main budget dial.
- A single-beat retake (`--reroll-beat N`) re-pays for one shot, not the run.
  Content-hash caching means a full re-run only regenerates what changed.
- `--budget 25` sets a hard spend ceiling; the pipeline stops before crossing it.
- Two worked scenarios at these rates, both from the tables above: a lean
  60-second short (3 generated shots, ~20 generated seconds, rest mograph, no
  direction layer) lands near $2.30 all-in; the demo's fully directed, dubbed
  cut carries $8.26 in the committed manifest and ran to about $14 at build
  time once the discarded re-rolls, sound experiments, and dub renders are
  counted. Budget to the at-build number; the manifest shows which scenario
  you actually got, itemized per call.
