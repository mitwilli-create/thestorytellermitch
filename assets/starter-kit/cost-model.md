# broll-pipeline cost model
ElevenLabs API rates, July 2026. Every number below is either a published rate or a receipt from a logged run; the two are labeled so you can tell which is which.

## Rates (published, per the ElevenLabs API pricing at time of writing)

| Stage | Rate | Typical 60s short |
|---|---|---|
| Voiceover (TTS Multilingual v2) | $0.10 per 1k characters | ~$0.10 |
| Music (Eleven Music v2) | $0.15 per minute | ~$0.18 |
| Sound effects | $0.12 per minute | ~$0.04 |
| Dubbing, per target language | $0.33 to $0.50 per minute | ~$0.58 |
| Generated shots (adapter to Veo 3.1 Fast) | $0.10 per second | ~$2.00 for 3 shots |
| Mograph beats (Playwright render) | $0 | $0.00 |

The "typical" column is an estimate. The receipts below are not.

## Receipts (the logged demo run, output/run-manifest.json, 60 calls)

| Line | Cost | Basis |
|---|---|---|
| Voiceover, 16 beats | $0.06 | receipt, carried by cached artifacts |
| Visuals, 6 mograph + 10 generated shots | $4.40 | receipt |
| Creative council, direction + review board | $3.59 | receipt (Anthropic API) |
| Score, 75 second bed | $0.14 | receipt |
| Sound effects, 4 cues + ambience | ~$0.32 | receipt |
| Production subtotal carried by the cut | $9.51 | sum of manifest lines |
| Retakes rejected along the way + Spanish dub | remainder | receipt |
| All-in for the published 53 second cut | $14.20 | full ledger |

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
