# Review guidelines

This is a production-critical repository, the live storytellermitch.com site. Review for real
defects, not style noise.

`.coderabbit.yaml` is what actually configures the reviewer. This file is the human-readable
statement of the same standard. If the two ever disagree, `.coderabbit.yaml` wins, because it is
the one the reviewer reads.

## Always flag, at any severity

- **Correctness.** Wrong output, unhandled edge cases, broken control flow, race conditions.
- **Security.** XSS, injection, path traversal, SSRF, secret or key exposure, unsafe
  deserialization, missing auth checks.
- **Data integrity.** Silent data loss, corruption, schema or data-contract violations.
- **Regressions** introduced by this diff.

## Do NOT flag (noise, not defects)

- Process or workflow reminders (run a script, follow a convention, update a changelog).
- Commit-message or pull-request description style.
- Restating rules from `CLAUDE.md` or `AGENTS.md`.
- Pure style and formatting already handled by linters and formatters.
- Anything that would begin with "consider", "remember to", or "per the project's workflow".

## What the deterministic gates own, not the reviewer

Presentation defects are caught by tooling, not by an LLM reviewer, so raising them here is
duplicate work. `tools/verify.mjs` is the build gate and fails on all of the following:

- Em dash characters (U+2014) anywhere in root `*.html`, `shared/*.css`,
  `assets/site-data/*.json`, `tools/*.mjs` or `assets/*.srt`. The ban is site-wide in practice.
- Unresolvable `src`, `href` or `poster` references, checked against disk. Broken asset links
  cannot reach production.
- Bake drift in `stories.html` and `work.html`, compared byte for byte against what
  `assets/site-data/*.json` produces.

Visual regression and prose lint cover CSS, spacing, colour and copy wording.

## Focus

Prioritize high and critical severity. Keep low-severity comments minimal. If a change is
correct and safe, say so briefly rather than manufacturing marginal suggestions.
