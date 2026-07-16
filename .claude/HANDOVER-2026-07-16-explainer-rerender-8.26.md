# Handover: re-render the explainer videos from $14.20 to the canonical $8.26

> **CHECKPOINT UPDATE (2026-07-16, execution session):** RENDER + LOCKSTEP BATCH DONE.
> Both cuts re-rendered live (fresh IVC takes 826a/826b, $0.70 total, spend-logged),
> all ~13 surfaces staged and committed as c549b70 on claude/eager-chandrasekhar-26e644,
> PR #137 open, CodeRabbit CLI clean (2 findings fixed: archive re-bake + srt clamp).
> All gates below PASS except the two deliberately remaining:
> 1. OWNER visual glance (posters/preview/both cuts) — preview server entry
>    `explainer-826-worktree-static` (port 8792) serves this worktree.
> 2. KB runbook (wipe → re-index → eval → guard --update) — deferred to
>    post-glance/pre-merge on purpose (punch-list changes would re-drift the corpus);
>    CI "KB index freshness" is red until it runs. Recipe: memory kb-ops-runbook.
> Pipeline scripts for any retake: broll-pipeline scripts/_rerender-826-audio.mjs,
> _build-826.mjs, _normalize-money-826.mjs, _srt-to-vtt-clamped.mjs (SET=826a|826b).
> Extra honesty fixes shipped beyond this spec (chips, ledger, receipt rows, systems
> m-stat + 92s tags, durations 91s/85s) — flagged in the PR body for the glance.

**Ruling (owner, 2026-07-16):** the explainer's $14.20 is STALE, not intentional
history. Re-render to the canonical **$8.26** cost anchor.

**Why stale, not history:** the narration itself asserts $14.20 twice as bare,
undisclosed fact ("cost $14.20 to produce, start to finish, all in, and I can
document every cent" / "that's how a 53-second film lands at $14.20"). Unlike
picture-lock.html:406 (beat-12's baked $9.51, disclosed in an honesty note) and
voice-os.html (approved frozen worked-run traces), the explainer discloses
nothing. It is a pre-consolidation artifact from PR #46, predating the $8.26
committed manifest. Canonical anchor: kb/metrics-provenance.md:21; the committed
manifest reconciles line-for-line to $8.26 (assets/site-data/picture-lock-run.json).

**Why this can't be a text-only patch:** captions and alt text are locked to the
baked audio and poster frame. Editing them to $8.26 while the mp4 still says
$14.20 just inverts the error and desyncs the captions from the voice (a caption
QA failure). All surfaces below must ship in one lockstep batch, after the render.

---

## Scope surprise (flagged): this is TWO videos on THREE pages, not one

The two explainers share the same script but are separate renders (identical
caption text, different audio timing).

### Video A — `picture-lock-explainer` (94.5s) — wired on index.html + work.html
| Surface | State | Action |
|---|---|---|
| `assets/picture-lock-explainer.mp4` | narration says $14.20 x2 | RE-RENDER audio |
| `assets/picture-lock-explainer-poster.jpg` | receipt frame = $14.20 (per CSS comment index.html:227) | RE-RENDER frame |
| `assets/previews/picture-lock-explainer.mp4` | 9.5s muted hover-loop | visual-check for the $14.20 receipt frame; re-render if visible |
| `assets/picture-lock-explainer.vtt` | captions $14.20 x2 | re-author against new audio |
| index.html:488 | alt asserts "$14.20" | reword (see below) |
| index.html:228 | CSS comment "the $14.20 receipt" | reword (see below) |
| work.html:232 | alt = "Every claim links to a source" (no number) | no text edit; asset swap covers it |

### Video B — `site-teardown-explainer` (92.4s, separate render) — wired on systems.html
| Surface | State | Action |
|---|---|---|
| `assets/video/site-teardown-explainer.mp4` | narration says $14.20 x2 | RE-RENDER audio |
| `assets/posters/site-teardown-explainer.jpg` | poster (25KB) | visual-check for $14.20; re-render if present |
| `assets/captions/site-teardown-explainer.vtt` | captions $14.20 x2 | re-author against new audio |
| `assets/captions/site-teardown-explainer.srt` | captions $14.20 x2 | re-author against new audio |
| systems.html:89 | alt = "The site teardown explainer…" (no number) | no text edit; asset swap covers it |

### DO NOT TOUCH (confirmed clean / deliberately disclosed)
- `assets/site-data/picture-lock-run.json` — already $8.26; mentions $14/$9.51
  correctly as disclosed history; live source for picture-lock.html's receipt.
- picture-lock.html beat-12 baked $9.51 — disclosed honesty note (picture-lock.html:406).
- voice-os.html:233,237 — approved frozen worked-run traces (separate workstream).
- `assets/bundlec-article-to-audience.vtt` — false positive (timestamp, no cost).

---

## The re-scripted narration (FINAL — owner ruled single-number, 2026-07-16)

Single-number framing, ruled. NOT the disclosed-arc option. Only the two cost
lines change; this wording makes the claim MORE accurate ($8.26 reconciles
line-for-line; $14 was only "about $14"):

- Opening (was cues 1-3): **"The film on this site's front page cost $8.26 to
  produce, logged line for line, and I can document every cent."**
  (drops "start to finish, all in", which implied the ~$14 at-build total; $8.26
  is the committed-manifest figure the site canonically uses.)
- Closing (was ~00:59): **"That's how a 53-second film lands at $8.26."**

Everything else in the script is unchanged. Both cuts (Video A and Video B) use
this same wording.

---

## Exact HTML text edits (stage until render lands)

- **index.html:488** alt, from:
  `The site explainer opens on its receipt: the film on this page cost $14.20`
  to:
  `The site explainer opens on its receipt: the committed manifest for the film on this page, $8.26`
- **index.html:228** CSS comment, from `the $14.20 receipt` to `the $8.26 receipt`.

## Corrected caption text (re-time against the new audio; do not ship old timings)
- Video A `.vtt`: both `$14.20` -> `$8.26`; opening cue text per re-script above.
- Video B `.vtt` + `.srt`: same two swaps.

---

## Render steps (external — picture-lock explainer pipeline)
Tooling is NOT in this repo (baked artifacts shipped in PR #46, 87e65f9). Needs
the picture-lock explainer pipeline + the cloned-voice ElevenLabs TTS:
1. Re-script the two cost lines (above), regenerate narration audio for BOTH cuts.
2. Re-render both receipt/poster frames to $8.26 (and Video A's 9.5s preview if it shows the receipt).
3. Re-derive caption timings (.vtt for A; .vtt + .srt for B) from the new audio.
4. Drop the new assets in at the same paths.

## Verification gates before merge
- [ ] Cost fact-check: `grep -rn "14\.20\|9\.51" assets/ *.html` returns only the
      sanctioned disclosed-history spots (run-json reconciliation, picture-lock
      beat-12, voice-os traces). No stray $14.20 on any explainer surface.
- [ ] Caption QA: captions match the new spoken audio word-for-word and in time (both cuts).
- [ ] Visual glance (owner, foreground): both posters + Video A preview show $8.26,
      not $14.20 (baked frames can't be frame-captured from a backgrounded tab).
- [ ] index.html alt + comment landed in the SAME commit as the new poster.
- [ ] Deploy + edge-verify both hosts (edge serves stale for minutes; poll).
