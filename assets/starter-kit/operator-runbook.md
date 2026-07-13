# broll-pipeline operator runbook
Written for a producer, not an engineer. If you can write a script and read a folder, you can run this. The engineer who built the pipeline should not need to be in the room.

Repo: https://github.com/mitwilli-create/broll-pipeline

## What you are operating
One plain-text script goes in. A finished, captioned vertical short comes out, with narration, score, sound effects, and visuals generated and assembled automatically. Every API call is logged to `output/run-manifest.json` with its cost, so you always know what a run spent and why.

## One-time setup (10 minutes, or hand this part to IT)
1. Install Node 20+ and ffmpeg.
2. `git clone https://github.com/mitwilli-create/broll-pipeline && cd broll-pipeline && npm install`
3. `cp .env.example .env` and fill in the keys (see config.example.env in this kit).
4. Dry-check before spending: `node pipeline.mjs --skip-gen` renders a $0 draft cut, which proves keys, tools, and the edit path end to end without paying for visuals.

## The happy path
1. Copy `script.example.md` to `input/script.md` and rewrite it. One `##` block per beat: a narration line (VO), a visual direction (VISUAL), a length (SECONDS).
2. Run: `node pipeline.mjs --script input/script.md --budget 25`
   The budget flag is a hard ceiling. The run stops before crossing it.
3. Watch `output/short.mp4`. Captions are burned from the pipeline's own timing.
4. Read the last lines of `output/run-manifest.json` for what it cost.

## The retake path (this is where the pipeline earns its keep)
- One shot is wrong: `node pipeline.mjs --reroll-beat 4` retakes beat index 4, which is the FIFTH `##` block in your script because the index counts from zero. Everything else is kept; you pay for one shot, not a run.
- The narration changed: edit the beat's VO line and re-run. Content-hash caching regenerates only what changed.
- You want a free draft first: `node pipeline.mjs --skip-gen` renders motion-graphics fallbacks for every generated shot at $0, so you can check the cut's rhythm before spending on visuals.

## The localization path
`node pipeline.mjs --script input/script.md --dub es` produces `output/short.es.mp4` through the Dubbing API. Swap `es` for any supported language code. Budget roughly $0.33 to $0.50 per minute per language.

## Quality checks before you ship
- Watch the full cut once with sound and once muted. The mute pass catches visual problems the narration was papering over.
- Check the captions against the narration. The pipeline times them from its own beats, so a mismatch means a beat edit did not re-run.
- Loudness ships normalized to -16 LUFS. If your platform wants different, say so before the mix, not after.
- If a generated shot invents something the brief did not ask for, reroll it. Do not ship a shot you would not have accepted from a human editor.

## When something fails
- The run stops with a stage name and an error. Re-running is safe: caching means completed stages do not re-spend.
- A key error means the .env entry for that stage is missing or expired.
- A budget stop means the ceiling did its job. Raise `--budget` deliberately or cut generated beats.
- If the same stage fails twice with the same error, that is the moment to call the engineer, with the manifest and the error line in hand.

## What to send back to the team
The finished mp4, the run manifest, and one sentence on what you would change next run. The manifest is the receipt; the sentence is the direction.
