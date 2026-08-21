# UI verification: bin Laden launch-timing correction
Date: 2026-08-20, ~21:40 PDT
Branch: fix/bin-laden-launch-timing (branched from origin/main)

## What changed
Site copy said The Stream's global launch broadcast happened "at night" / on
"launch night". The raid happened at night; the launch aired the following
afternoon, under 24 hours later. Corrected across 15 files.

Retained deliberately: clip titles reading "The night bin Laden's death broke"
describe when the NEWS broke, which is accurate. The #stream-launch-night anchor
slug and asset filenames are unchanged so inbound links keep resolving.

## Verification performed
Served the branch at http://localhost:8791 and inspected the rendered DOM,
not the source.

| Check | Result |
|---|---|
| index.html @ 1440x900 | "Bin Laden launch coverage", sub "250M-household launch - RTS Innovative News Award". Layout intact. |
| index.html @ 375x812 | Same text, wraps to two lines, no horizontal overflow (scrollWidth == innerWidth). |
| stories.html @ 1440x900 | Sidebar nav and section H2 both read "The bin Laden launch". |
| stories.html @ 375x812 | No horizontal overflow. |
| agent.js script tag | Still present on stories.html; confirmed not dropped by the branch. |
| node tools/verify.mjs | all invariants hold; em-dash census clean across 145 files; 2406 asset refs resolve; bake-drift ok. |

## Screenshots
- index-1440x900.png
- index-375x812.png
- stories-1440x900.png
- stories-375x812.png

## Follow-up pass (same night, after independent site audit)
An independent read of the live site surfaced three residual "night" strings the
first pass missed. All three fixed and re-verified:

| Item | Before | After | Where |
|---|---|---|---|
| Story prose | "What I carry from that night is more specific." | "What I carry from that rebuild is more specific." | stories.json, rebaked into stories.html |
| Image alt | "The Stream launch-night broadcast frame" | "The Stream launch broadcast frame" | stories.json, rebaked |
| Clip label | "Bin Laden night - 45m" | "Bin Laden coverage - 45m" | timeline.html |

The prose one mattered most: it sat inside the section we had just corrected away
from "night," so the page contradicted itself.

Re-verified: node tools/build-stories.mjs rebaked cleanly (17 stories);
node tools/verify.mjs all invariants hold, bake-drift ok. Live DOM at 1440x900
confirms label "Bin Laden coverage - 45m" (238px, visible) and the era paragraph
opening "Launch day, May 2, 2011". No horizontal overflow.
Screenshot: timeline-1440x900.png
