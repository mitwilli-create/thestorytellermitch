# Editorial Field Dossier CV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every active Career Ops CV render through one ATS-safe, visually coherent system that carries the editorial identity of thestorytellermitch.com.

**Architecture:** Keep `apply-pack/<slug>/tailored-cv.md` as the only renderable full-CV source. Parse project entries into semantic project blocks before HTML generation, then apply one shared print token system and one Playwright PDF path. Typed tailoring ledgers remain sidecars and never become direct renderer inputs.

**Tech Stack:** Dependency-free Node.js ESM, semantic Markdown, generated HTML/CSS, Playwright PDF, Node test runner, Poppler PDF inspection.

## Global Constraints

- Preserve a single-column, vector, extractable, ATS-safe PDF.
- Use Archivo for display hierarchy, Inter for body and metadata, and JetBrains Mono only for the kicker.
- Use oxblood only for the opening rule, section labels, bullet markers, and literal URL text.
- Keep visible body text at or above 9.5pt.
- Target two pages for CVs and one page for cover letters.
- Never commit Career Ops personal files under `apply-pack/`.
- Use no em dashes in outward-facing content or code comments.
- Verify visible changes in rendered PDFs, not only in source.

---

### Task 1: Semantic project blocks

**Files:**
- Modify: `tools/build-resumes.mjs`
- Modify: `tools/build-resumes-print.test.mjs`

**Interfaces:**
- Consumes: Markdown sections containing `###` role or project headings, paragraphs, and bullets.
- Produces: parsed `project` blocks whose heading, descriptor, proof, bullets, and URL render inside one `.rproject` container.

- [ ] **Step 1: Write failing parser and HTML tests**

Add fixtures proving that a Projects section produces a semantic project block, linked project names remain ink, descriptions stay inside the block, and literal URLs alone receive the accent class.

- [ ] **Step 2: Run the focused test**

Run: `node --test tools/build-resumes-print.test.mjs`

Expected: FAIL because the parser currently emits project headings as generic roles and descriptions as unrelated paragraphs.

- [ ] **Step 3: Implement section-aware project parsing**

Teach `parse()` to classify `###` entries under a Projects section as `project` blocks. Attach following prose and bullets to that project until the next heading or section. Keep Experience headings as roles.

- [ ] **Step 4: Render the project component**

Render one `.rproject` wrapper with `.rproject-h`, optional `.rproject-meta`, `.rproject-proof`, `.rproject-list`, and `.rproject-url`. Do not allow the global link rule to color linked title fragments.

- [ ] **Step 5: Run the focused test**

Run: `node --test tools/build-resumes-print.test.mjs`

Expected: PASS.

### Task 2: Editorial print system

**Files:**
- Modify: `shared/brand-print.mjs`
- Modify: `tools/build-resumes.mjs`
- Modify: `tools/build-resumes-print.test.mjs`

**Interfaces:**
- Consumes: shared print colors and a minimum body size.
- Produces: a monotonic CV scale and layout tokens shared by every application render.

- [ ] **Step 1: Write failing token assertions**

Assert paper `#ffffff`, ink `#1b1a1d`, secondary `#504b47`, oxblood `#8a3a33`, rule `#d5d0ca`, name `21pt`, section `12.25pt`, role/project `10.9pt`, metadata `9.35pt`, and body `9.75pt`.

- [ ] **Step 2: Run the focused test**

Run: `node --test tools/build-resumes-print.test.mjs`

Expected: FAIL against the old compressed scale.

- [ ] **Step 3: Implement typography and spacing**

Set 0.55in side padding, 11pt section rhythm, 8pt role/project rhythm, 1.30 body leading, 2.5pt bullet gaps, ink headings, secondary metadata/body, and restrained oxblood accents. Remove the print `!important` rule that colors every section link.

- [ ] **Step 4: Balance page geometry**

Use 0.40in top and bottom Playwright margins and prevent headings from separating from the next two lines. Preserve a small page-one foot reserve through break controls, not arbitrary blank elements.

- [ ] **Step 5: Run focused and full site verification**

Run: `node --test tools/build-resumes-print.test.mjs`

Run: `node tools/verify.mjs`

Expected: all checks pass.

### Task 3: Canonical source and renderer validation

**Files:**
- Modify: `<career-ops>/scripts/render-cv-site-pdf.mjs`
- Modify: `<career-ops>/scripts/agents/apply-pack-polish.mjs`
- Test: relevant Career Ops tests discovered by `rg "render-cv-site|apply-pack-polish" scripts test*`

**Interfaces:**
- Consumes: `apply-pack/<slug>/tailored-cv.md`.
- Produces: a two-page-or-shorter branded PDF or an explicit hard failure.

- [ ] **Step 1: Add source-path regression tests**

Prove the current pipeline never treats `cv-tailored.json`, legacy `data/apply-packs/*/cv-tailored.md`, or a Typst fallback as the canonical full CV.

- [ ] **Step 2: Run the focused tests**

Expected: FAIL where polish still maps the sidecar to `cv-tailored.md`.

- [ ] **Step 3: Normalize the path contract**

Make polish and rendering name `tailored-cv.md` consistently. Keep ledger inputs explicitly labeled as ledgers. Fail with a diagnostic if the full source is absent.

- [ ] **Step 4: Set balanced PDF margins**

Use the approved fixed print geometry while leaving horizontal geometry to the shared resume wrapper.

- [ ] **Step 5: Run Career Ops verification**

Run: `npm run test-all`

Expected: all checks pass.

### Task 4: Normalize and rerender the active queue

**Files:**
- Local only: `<career-ops>/apply-pack/*/tailored-cv.md`
- Local only: `<career-ops>/apply-pack/*/tailored-cv.pdf`
- Local only: `<career-ops>/apply-pack/*/cover-letter.pdf`

**Interfaces:**
- Consumes: the reconciled private active-application set.
- Produces: one canonical CV source, a two-page-or-shorter CV PDF, and a one-page cover-letter PDF for every active application.

- [ ] **Step 1: Reconcile the working set**

Use the live-form result set as the authority. Record closed roles separately and do not generate new materials for them.

- [ ] **Step 2: Normalize stale sources**

Move any legacy full source into `tailored-cv.md`, preserve its content, and rewrite combined terminal sections into the canonical heading grammar. Confirm all live sources pass `parse()`.

- [ ] **Step 3: Rerender every CV**

Run the batch CV renderer against every active slug. Require a PDF for every reconciled role.

- [ ] **Step 4: Rerender every cover letter**

Run the cover-letter renderer and fail when any letter spills to a second page.

- [ ] **Step 5: Inspect page counts and extractability**

Use `pdfinfo` and `pdftotext` to confirm Letter size, expected page counts, linear text extraction, and absence of Markdown markers, code, comments, em dashes, and retired distribution claims.

### Task 5: Visual and writing QA

**Files:**
- Create locally: `/private/tmp/editorial-field-dossier-qa/`
- Create locally: `<career-ops>/.writing-coach/inbox/<dated-cv-redesign-lesson>.md`

**Interfaces:**
- Consumes: final PDFs and before/after sources.
- Produces: visual proof and a local craft lesson Mitchell can reuse.

- [ ] **Step 1: Rasterize representative PDFs**

Capture both pages for a dense leadership CV, an editorial CV, a technical CV, and the repaired Projects section.

- [ ] **Step 2: Inspect representative pages**

Check hierarchy, margins, baseline rhythm, color restraint, project grouping, page balance, and minimum readable type.

- [ ] **Step 3: Write the coach lesson**

Explain the highest-value changes with real before/after examples: exact application questions, concrete proof before transfer, projections labeled as projections, vanity metrics removed, artifact offers instead of meeting asks, relevance trimming, and truthful ATS target language.

- [ ] **Step 4: Run final gates**

Run: `node --test tools/build-resumes-print.test.mjs`

Run: `node tools/verify.mjs`

Run: `npm run test-all` in Career Ops.

Expected: all green.

- [ ] **Step 5: Review, commit, push, and deploy**

Stage only public system files. Confirm no `apply-pack/` data is staged. Run local QA and local review skills, push the named branch, open the repository-specific PR, resolve local findings, merge after checks, deploy with the explicit Writing Craft root, and verify the live surface. Hosted review is not automatic or required.
