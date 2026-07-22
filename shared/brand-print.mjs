// brand-print.mjs : the ONE print type system for every rendered artifact in
// Mitchell's brand. Light "paper" derivative of shared/theme.css (which is the
// dark screen variant). Dependency-free ESM, no build step, importable from
// both repos.
//
// Consumers:
//   - storytellermitch-site/tools/build-resumes.mjs  (resumes -> HTML + PDF)
//   - career-ops/scripts/render-brand-doc-pdf.mjs    (apply-pack prose docs)
//   - career-ops/scripts/render-cv-site-pdf.mjs      (via build-resumes.mjs)
//
// Two artifacts, one system: a CV and a cover letter rendered on the same day
// must not look like they came from two different studios. Colors here are
// exact and shared; sizes all come from ONE scale that steps by ROLE, with no
// intermediate values invented at the call site.

// ── §2 color tokens (light print variant) ───────────────────────────────────
// Oxblood is the ONLY accent and it is never used on body prose: rules,
// labels, markers, links, section numbers.
export const PRINT_COLORS = {
  bg:            '#ffffff',
  ink:           '#1b1a1d',
  inkSoft:       '#403d41',
  mute:          '#6f6a63',
  line:          'rgba(0,0,0,0.12)',
  line2:         'rgba(0,0,0,0.22)',
  blood:         '#8a3a33',
  bloodHairline: 'rgba(138,58,51,0.4)',
};

// ── §3 type scale (single source of truth) ──────────────────────────────────
// title 27 > section 16 > subsection 13 > body 11.5 > small 10.5 > micro 8.5.
// A lede is body SIZE differentiated by color and leading, not by a new size.
export const SCALE_PX = {
  h1:    27,    // document title / resume name
  h2:    16,    // section heading
  h3:    13,    // subsection / role heading
  body:  11.5,  // paragraphs, list items, lede
  small: 10.5,  // table cells, aside/caption
  micro: 8.5,   // mono labels: byline, section numbers, table headers
};

// Print CSS is authored in pt on the resume side and px on the prose side;
// both come from the same numbers so the two artifacts stay in step.
export const pxToPt = (px) => +(px * 0.75).toFixed(3);
export const SCALE_PT = Object.fromEntries(
  Object.entries(SCALE_PX).map(([k, v]) => [k, pxToPt(v)]),
);

// ── fonts (role-assigned; no new families, ever) ────────────────────────────
export const FONTS = {
  display: "'Archivo',sans-serif",       // headings: h1 800, h2/h3 700-800
  body:    "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
  mono:    "'JetBrains Mono',monospace", // utility labels only
};

// ── resume element map (spec §8) ────────────────────────────────────────────
// Which scale step each resume element takes. Two entries deliberately depart
// from the spec's suggested mapping, on the owner's ruling of 2026-07-21 after
// looking at the rendered CV:
//   - pillars: the line under the name is the resume's deck, not a micro
//     label. It reads at section size (h2), not label size. It was the single
//     loudest complaint about the old render, where a flat label size across
//     pillars / contact / section heads / dates flattened the whole hierarchy.
//   - org/date subline: takes h3, not small. On a resume the employer and the
//     dates are scanned before the bullets are read, so the line outranks body
//     copy instead of sitting under it.
// Everything else follows §8: name -> h1, section head -> h3-with-h2-weight
// treatment, body and bullets -> body, contact -> small.
export const RESUME_STEP = {
  name:     'h1',
  pillars:  'h2',
  roleHead: 'h2',
  secHead:  'h3',
  roleSub:  'h3',
  body:     'body',
  contact:  'small',
};

/**
 * Resume print sizes in pt, resolved from the shared scale.
 * @param {number} fit per-lane fit multiplier (1 = brand-exact). Nudge a lane
 *   only when its density tips the hard 2-page gate; it scales the whole
 *   system together, so the hierarchy never drifts per lane.
 */
export function resumePt(fit = 1) {
  const at = (step) => +(SCALE_PT[RESUME_STEP[step]] * fit).toFixed(3);
  return {
    name: at('name'), pillars: at('pillars'), roleHead: at('roleHead'),
    secHead: at('secHead'), roleSub: at('roleSub'), body: at('body'),
    contact: at('contact'),
  };
}

/** `:root` declarations for the prose-doc renderer (colors + px scale). */
export function printRootCSS() {
  const c = PRINT_COLORS;
  return [
    `--bg:${c.bg}`, `--ink:${c.ink}`, `--ink-soft:${c.inkSoft}`, `--mute:${c.mute}`,
    `--line:${c.line}`, `--line-2:${c.line2}`,
    `--blood:${c.blood}`, `--blood-hairline:${c.bloodHairline}`,
    ...Object.entries(SCALE_PX).map(([k, v]) => `--fs-${k}:${v}px`),
  ].join(';');
}
