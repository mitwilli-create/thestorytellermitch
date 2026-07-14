# UI verification — comms-triage metric 55→60 on resume pages

**Change:** text-only. `<span class="rnum">55%</span>` → `60%` inside the
Communications-triage agent Impact bullet on 6 resume pages + comms.html.
Plus `tools/build-resumes.mjs` aria-label source fix (Open→Toggle) so the
rebuild does not revert PR #33; ai-solutions-architect.html rebuilt identical
to committed (no diff).

## Proof (Chrome MCP, localhost:8899 static serve)
- **Page:** resume/forward-deployed.html (FDC-relevant; representative of all 6)
- **1440×900 screenshot:** rendered bullet reads "Designed to auto-handle
  roughly 60% of inbound without escalation (est.)". Layout intact, no reflow
  break, no column collapse.
- **DOM proof:** find → ref_92 confirmed inner text "60%".
- **Served-HTML grep:** `auto-handle roughly <span class="rnum">60%</span> of inbound`.
- **375/600 narrow width:** window held minimum width (Chrome), no reflow forced;
  change is a two-character text swap inside an existing inline span, zero
  responsive/layout surface to regress.
- **CI:** `node tools/verify.mjs` all invariants hold (em-dash census clean across
  54 files; bake-drift clean; asset refs resolve).

Screenshots captured live via Chrome MCP this session (ss_4526j8kvv @1440).
