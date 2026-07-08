# AGENTS.md - storytellermitch-site

Read `~/Documents/mission-control/WORKSPACE.md` first: it defines the multi-agent lane rules for this machine. Your lane here (Codex) is building; Claude Code reviews your output and owns orchestration/memory. CodeRabbit reviews commits and PRs automatically.

## What this repo is

Mitchell's public portfolio site, storytellermitch.com: plain static HTML/CSS/JS on GitHub Pages (push to `main` deploys). Narrative case studies from eight years in newsrooms (CNN, AJ+, Al Jazeera) and eight at Google, plus AI-native production work on the ElevenLabs stack. This is outward-facing professional brand: copy and visual changes need Mitchell's review before they ship.

## Hard constraints

- **Em-dash ban, CI-enforced.** Zero U+2014 characters in any `.html`/`.css`/`.json`, tools, or `.srt` file. `tools/verify.mjs` fails the build on one. Use hyphens, commas, or restructure the sentence.
- **Never hand-edit baked regions.** `stories.html` and `work.html` are generated between bake markers from `assets/site-data/stories.json` and `clips.json`. Edit the JSON, re-run the baker; CI rejects bake drift byte-for-byte.
- **Every asset reference must resolve.** All `src`/`href`/`poster` attributes are checked against disk (exemption: `media/`, the gitignored self-hosted video payloads).
- **Public repo.** No secrets, no personal data, no draft copy you wouldn't publish.
- **Visible changes get verified in a real browser** (both desktop and narrow widths) before being called done. "Looks right in source" is not verification.

## Commands

- Bake stories: `node tools/build-stories.mjs` · bake archive: `node tools/build-archive.mjs`
- Verify (the CI gate; run before every commit): `node tools/verify.mjs`
- No build step for deploy; no dev server in-repo (serve statically, e.g. `python3 -m http.server`).
- Media pipeline lives in `tools/` (transcode, posters, previews, upload); those are content-ops utilities, not part of deploy.

## Conventions

- Zero frameworks, zero runtime dependencies; `tools/verify.mjs` is deliberately dependency-free and deterministic.
- Design system is `shared/theme.css` (CSS custom properties: near-black `#0a0a0b`, bone `#ece8e1`, oxblood accent `#8a3a33`). Use the tokens; don't introduce new palette values casually.
- Every page links `shared/theme.css` and loads `shared/reveal.js` as the first script at the end of `<body>`.
- Content is data-driven: new case studies and clips go into `assets/site-data/*.json`, then bake.
