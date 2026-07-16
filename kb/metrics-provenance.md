---
kb_id: metrics-provenance
type: reference
topics: [adoption-metrics, real-users, roi, metric-labeling, claims-discipline, behavior-change-measurement, tutorial-effectiveness, highest-signal-work]
policy: Every number carries a provenance label. Canonical cost anchor is $8.26; never $14.20 or $9.51 outside acknowledging them as disclosed build-history artifacts.
answers_clusters: [15, 60, 61, "AN10", "OAI5"]
---

# What the numbers actually mean: provenance labels

Mitchell's site is deliberately explicit about which numbers are verified externally, which are logged by his own systems, and which are estimates or design targets. The assistant must preserve these labels rather than flatten everything into equally-certain facts.

**Third-party verified:**
- RTS 2012 Innovative News Award; HuffPost Webby 2013; Mashable 2012 recognition.
- Fusion's 179% primetime growth and ~40M households, cited to Adweek.
- AJ+ reaching 50M views on a single piece, Top-5 Facebook publisher in 2017, cited to Tubular.
- Hurricane Maria coverage referenced in PBS-covered FEMA hearings.
- #FreeAhmed 2026 campaign outcome, cited to CPJ.

**Logged by his own systems (measured, not estimated):**
- The picture-lock short film's cost: **$8.26**, from a committed run manifest logging every API call. This is the number to use when asked what a piece cost to produce. (Two other figures, about $14 and $9.51, appear in disclosed build-history notes as pre-consolidation or in-progress figures; they are not the answer to "what did it cost" and should not be quoted as such.)
- Google Corp Eng self-help article: 9.03% solvability lift, measured against ticket volume.

## How does he measure whether content changed behavior, not just got views?

The cleanest example is measured, not estimated: a security-key self-help article he wrote at Google lifted ticket solvability by 9.03%, measured against ticket volume, which works out to roughly 10,670 fewer support tickets a year. Views weren't the metric; whether readers could fix the problem themselves was. That's his standard for tutorial and enablement content generally: define the behavior the content should change, then measure that behavior, not the traffic.

## What's the highest-signal thing he's shipped, by traffic or citation?

By raw traffic: a single AJ+ policy-journalism piece reached 50 million views (AJ+ was a Top-5 Facebook publisher in 2017, per Tubular). By third-party recognition: an RTS Innovative News Award (2012), a Webby (HuffPost Live, 2013), Fusion's growth covered in Adweek, Hurricane Maria coverage referenced in PBS-covered FEMA hearings. The full sourced list, with a citation for every claim, lives on the site's impact page.

**Explicitly self-labeled estimates or design targets:**
- comms-triage agent figures (roughly 1,000 senior engineers served, ~160 hours/year projected time recapture, ~60% auto-handle rate) are design targets and estimates, not audited outcomes; the system's own page and every surface that cites them label them as such.
- The ~70% reduction in executive review cycles is a self-reported observation, not a third-party audit.

**For the assistant:** when citing any number, carry its label: "measured," "logged," "third-party cited," or "a self-reported estimate." Never present a design target as an audited result. If asked directly whether a number is verified, answer honestly using this classification.
