# AGENTS.md - storytellermitch-site

Read `~/Documents/mission-control/WORKSPACE.md` first: it defines the multi-agent lane rules for this machine (machine-local doc for the owner's agent fleet; external readers can skip this paragraph). Your lane here (Codex) is building; Claude Code reviews your output and owns orchestration/memory. CodeRabbit reviews commits and PRs automatically.

## What this repo is

Mitchell's public portfolio site, thestorytellermitch.com: plain static HTML/CSS/JS served as Cloudflare Workers Static Assets (the "thestorytellermitch" Worker; migrated off Cloudflare Pages 2026-07-10). Deploys are manual via `tools/deploy.sh` (push to `main` does NOT auto-deploy; see Commands). Narrative case studies from a decade in newsrooms (CNN, AJ+, Al Jazeera) and eight at Google, plus AI-native production work on the ElevenLabs stack. This is outward-facing professional brand: copy and visual changes need Mitchell's review before they ship.

## Hard constraints

- **Em-dash ban, CI-enforced.** Zero U+2014 characters in root `*.html`, `shared/*.css`, `assets/site-data/*.json`, `tools/*.mjs`, and `assets/*.srt`; `tools/verify.mjs` fails the build on one. Treat the ban as site-wide anyway: use hyphens, commas, or restructure the sentence.
- **Never hand-edit baked regions.** `stories.html` and `work.html` are generated between bake markers from `assets/site-data/stories.json` and `clips.json`. Edit the JSON, re-run the baker; CI rejects bake drift byte-for-byte.
- **Every HTML asset reference must resolve.** `src`/`href`/`poster` attributes in `*.html` are checked against disk (exemption: `media/`, the gitignored self-hosted video payloads).
- **Public repo.** No secrets, no personal data, no draft copy you wouldn't publish.
- **Image licensing.** Third-party images need verified PD/CC licensing from the source file page, with author and license in the caption; wire-service photos (AP/Getty/Reuters) never. Carve-out (Mitchell-approved 2026-07-08): cover art of a published work may appear at modest size solely to identify the work under discussion, captioned "cover shown for identification".
- **Visible changes get verified in a real browser** (both desktop and narrow widths) before being called done. "Looks right in source" is not verification.

## Commands

- Bake stories: `node tools/build-stories.mjs` · bake archive: `node tools/build-archive.mjs`
- Verify (the CI gate; run before every commit): `node tools/verify.mjs`
- Deploy (manual; push to `main` does NOT auto-deploy): commit first, then run `tools/deploy.sh`. It deploys `HEAD` to the "thestorytellermitch" Worker via `wrangler deploy` (uncommitted edits silently stay behind; the script warns), stages a tracked-only export via `git archive` so the gitignored multi-GB `media/` and untracked scratch never reach the upload, and unsets the Cloudflare env tokens so the `wrangler login` OAuth session wins (the `CLOUDFLARE_API_TOKEN` in `.env` lacks deploy permission, API error code 10000). Never run `wrangler deploy` from the repo root with `.env` present. `.assetsignore` controls what is uploaded/served; anything uploaded is public.
- No build step; no dev server in-repo (serve statically, e.g. `python3 -m http.server`).
- Media pipeline lives in `tools/` (transcode, posters, previews, upload); those are content-ops utilities. `tools/deploy.sh` is the one deploy entry point.

## Conventions

- Zero frameworks, zero runtime dependencies; `tools/verify.mjs` is deliberately dependency-free and deterministic.
- Design system is `shared/theme.css` (CSS custom properties: near-black `#0a0a0b`, bone `#ece8e1`, oxblood accent `#8a3a33`). Use the tokens; don't introduce new palette values casually.
- Every page links `shared/theme.css` and loads `shared/reveal.js` as the first script at the end of `<body>`.
- Content is data-driven: new case studies and clips go into `assets/site-data/*.json`, then bake.
