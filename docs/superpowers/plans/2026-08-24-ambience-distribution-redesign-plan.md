# Ambience Distribution Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Ambience distribution section readable, tangible, and visually structured around a release sequence and four distinct distribution jobs.

**Architecture:** Keep the existing static HTML page and house style. Replace dense paragraph rows with a labeled schedule header and four distribution cards, each separating surface, action, rationale, and signal. Use CSS grid on desktop, a vertical stack on smaller screens, and existing reveal behavior without adding a dependency.

**Tech Stack:** Static HTML, local CSS, existing site verification scripts, Cloudflare Workers Static Assets deployment.

## Global Constraints

- No em dashes in outward copy.
- Preserve attribution and evidence boundaries.
- Keep the page accessible with semantic headings, links, and keyboard focus states.
- Verify visible UI at 1440px and 800px before deployment.

### Task 1: Copy and structure

**Files:**
- Modify: `private/for-ambience.html`

- [ ] Add the release schedule heading above the dated sequence.
- [ ] Replace the existing four distribution rows with four semantic cards containing surface, action, rationale, and signal.
- [ ] Keep outlet names and their audience rationale explicit.
- [ ] Preserve the implementation-checklist conversion path and authorship guardrails.

### Task 2: Visual system

**Files:**
- Modify: `private/ambience-review.css`

- [ ] Add desktop card-grid and connected-sequence styling.
- [ ] Add mobile stacking and spacing rules.
- [ ] Keep the selected pitch headline on one line with white and oxblood spans.
- [ ] Keep the draft connector above its title and make the voice bridge visually distinct.

### Task 3: Verification and deployment

**Files:**
- Verify: `private/for-ambience.html`
- Verify: `private/ambience-review.css`

- [ ] Run `node tools/verify.mjs` and diagnose any write-permission failure.
- [ ] Check the live page at 1440px and 800px for overflow, clipping, and card geometry.
- [ ] Commit only the intended site files and deploy with `tools/deploy.sh`.
- [ ] Recheck the deployed URL after cache refresh.
