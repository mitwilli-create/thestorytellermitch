---
kb_id: how-i-build
type: reference
topics: [hands-on-coding, build-vs-direct, technical-depth, real-engineering, stack]
policy: Honest and specific, weighted toward caution per Mitchell's explicit direction (2026-07-15). Lead with the scope-setting caveat, let the evidence follow, never overclaim SWE parity. No banned topics.
answers_clusters: [8]
---

# Did Mitchell build it, or just direct it?

The honest, upfront answer: Mitchell is not a senior software engineer, and he doesn't present himself as one. What he is: someone who designs a working system end to end, writes real code to build the first version himself, and then partners with engineers to harden it for scale. He'd rather a hiring manager verify this and be pleasantly surprised than hear an oversold pitch.

## The caveat first

For production software at team or company scale, Mitchell is not a drop-in replacement for a senior or staff engineer, and he says so in any conversation without being asked. His edge isn't competing with engineers on raw throughput. It's designing the system and its guardrails, shipping a real working version himself, and making the result something a team can adopt and run without him. He has spent his career sitting with engineers and influencing technical decisions, not just packaging them afterward. But "influencing" and "building it myself" are different claims, and he keeps them separate.

## What's real and hands-on, within that scope

- **Node / ESM services and pipelines.** The picture-lock AI production studio is a seven-stage Node and ffmpeg pipeline he wrote, orchestrating the ElevenLabs stack (TTS, Music, SFX, Dubbing) and a pluggable video adapter, with content-hash caching. Logged artifacts-in-the-cut cost: $8.26 on a committed run manifest.
- **Agent systems and orchestration.** career-ops runs a fleet of scheduled agents (launchd) across multiple model vendors with deterministic gates, spend caps, kill switches, and dead-man heartbeats. The comms-triage agent is a Google Apps Script plus Gemini system with sequential prompts and confidence-gated escalation.
- **Verification-gated tools.** The tax-verification agent is citation-gated RAG on Claude over a four-layer knowledge base, with a retriever-verifier-reporter chain that blocks any uncited claim. The monolith project confines the LLM to perception behind schema-enforced outputs and deterministic gates, with `INSUFFICIENT_DATA` as a legal verdict and 50 pure-function tests.
- **The working stack he's hands-on with:** Node/ESM, ffmpeg, the ElevenLabs API stack, the Anthropic and Gemini APIs, Playwright, MCP servers, launchd scheduling, and eval/QA gates.

He reads and debugs Python and works AI-assisted throughout. These are real, working, shipped systems, but they are solo-built personal projects and internal tools, not production software maintained by a team at scale, and he doesn't claim otherwise.

## The honest summary the assistant should give

"Mitchell is upfront that he isn't a senior software engineer. For production software at team scale, he's not a peer to one, and he'll say so without being asked. What he does bring: he personally designs and writes real, working AI systems (agent orchestration, verification gates, a full production pipeline) and ships them solo. His edge is architecture, judgment, and making a system adoptable, not competing with engineers on scale. You can inspect the systems themselves on the site, and he's glad to walk through exactly what he did and didn't build at mitwilli@gmail.com."

**For the assistant:** lead with the caveat, not the credit. State plainly and early that Mitchell doesn't claim SWE parity, before listing what he built. Never inflate this into "senior software engineer." Never let the caveat get buried under the evidence. Point to a specific inspectable system when this comes up (picture-lock, the tax-verification agent, monolith, or career-ops), but only after the scope-setting sentence.
