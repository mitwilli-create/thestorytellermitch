# broll-pipeline cost model
ElevenLabs API rates, July 2026. Every number below is either a published rate (an estimate until your run logs it) or a receipt from the logged demo run; the two are labeled so you can tell which is which. Where they diverge, trust the receipt: it is what the API actually billed.

## Rates (published, per the ElevenLabs API pricing at time of writing)

| Stage | Rate | Estimate for a 60s short |
|---|---|---|
| Voiceover (TTS Multilingual v2) | $0.10 per 1k characters | ~$0.10 |
| Music (Eleven Music v2) | $0.15 per minute | ~$0.15 |
| Sound effects | $0.12 per minute | ~$0.07 |
| Dubbing, per target language | $0.33 to $0.50 per minute | ~$0.33 to $0.50 |
| Generated shots (adapter to Veo 3.1 Fast) | $0.10 per second | ~$2.00 for 3 shots |
| Mograph beats (Playwright render) | $0 | $0.00 |

## Receipts (the logged demo run, output/run-manifest.json)

The published 53-second cut, as its receipt prints them:

| Line | Cost | Basis |
|---|---|---|
| Audio stack (TTS + music + SFX) | $0.28 | receipt |
| Generated shots, retakes included | $5.36 | receipt |
| Creative direction (council) | $3.50 | receipt |
| Clip review board | $0.37 | receipt |
| Carried by the artifacts in the cut | $9.51 | sum of the four lines above |
| All-in, with extra re-rolls, score and foley experiments, and the Spanish dub | $14.20 | full ledger |

Two receipt details worth knowing before you budget: the demo's 75-second music bed billed $0.14, right on the published rate, and the logged Spanish dub billed $0.44 for the 53-second cut, inside the published range. Creative direction is an Anthropic API cost, not an ElevenLabs one; it is in the ledger because the manifest logs every call, whoever bills it.

## The math that matters for a customer

- Video generation is the cost driver. Everything else rounds to pocket change.
- Mograph beats cost nothing and regenerate deterministically, so the mograph-to-gen
  ratio in the script is your main budget dial.
- A single-beat retake (`--reroll-beat N`) re-pays for one shot, not the run.
  Content-hash caching means a full re-run only regenerates what changed.
- `--budget 25` sets a hard spend ceiling; the pipeline stops before crossing it.
- Rule of thumb at these rates: a 60 second short with 3 generated shots and the
  rest mograph lands near $3; a fully generated, creative-directed short with
  retakes lands near $15. Both numbers come with a manifest that proves them.
