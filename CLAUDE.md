<!-- BEGIN DISTILLED: distill-session-preferences (topic: thestorytellermitch.com) -->
- Motion/animation must read as one continuous, non-looping movement — no jump cuts, no visible loop point, and it should start animating the moment the viewer reaches it (no dead delay). When Mitchell flags an animation as blurry, jumpy, or "not enough," the fix is smoother/longer continuous motion, not just a technical patch. <!-- id:6192d4f52c evidence:5 -->
- Break up any dense block of body text into smaller, scannable paragraphs — Mitchell corrects "wall of text" formatting on sight, on any page. <!-- id:3f15fb07ee evidence:3 -->
- Repeated UI elements (chips, cards, cell borders, hover states) must be visually consistent and must never overlap adjacent text or images. "Cohesion" is a recurring explicit ask — when one instance of a pattern has a treatment (e.g. a hover border), every instance should. <!-- id:88e1f410c1 evidence:4 -->
- Run a fact-check / accuracy pass on copy before treating it as final — Mitchell has caught factually incorrect timeline pop-out text and redundant/ambiguous/misleading sentences after the fact. Prefer catching this proactively over waiting for correction. <!-- id:8c471591a0 evidence:3 -->
- Don't ship a section or page with dead/empty space, or a static region whose siblings have imagery or motion — fill empty space with an image or animation and match the treatment across the set. Mitchell repeatedly flags areas that "read as empty" or lack the animation their neighbors have. <!-- id:7bd01f84ea evidence:4 -->
<!-- END DISTILLED: distill-session-preferences (topic: thestorytellermitch.com) -->

<!-- BEGIN STANDING-RULES (Mitchell global, installed 2026-07-18) -->
## Standing rules (global)

These apply to any Claude instance working in this repo, including off-machine (CI, collaborators, cloud agents):

1. **Freshness re-anchor.** Before acting on the first input of a session, and again after any gap over ~3 hours, web-search to confirm the current Pacific date/time (PST/PDT-aware) and scan the task topic for anything that changed since your knowledge cutoff, before relying on training-data recall. Re-check any pending "today/tomorrow" commitment against the confirmed date.
2. **Stack-search before building.** At the start of any new build / feature / reusable tool, first research what already exists (X, Reddit, Hacker News, Discord, dev forums, package registries) for highly-rated, peer-recommended solutions. Report BUILD-vs-ADOPT with sources; bias to ADOPT over BUILD unless there is a real, audience-worthy gap. Build for an audience, not just yourself.
<!-- END STANDING-RULES -->
