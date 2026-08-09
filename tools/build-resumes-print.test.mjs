import assert from 'node:assert/strict';
import test from 'node:test';

import { LANES, page, parse } from './build-resumes.mjs';

const parsed = {
  name: 'Mitchell Williams',
  pillars: 'Editorial systems · AI enablement',
  contact: ['mitwilli@example.com'],
  sections: [{
    title: 'Experience',
    blocks: [{
      type: 'role',
      head: 'Program Lead',
      sub: 'Example · 2024-present',
      body: [{ type: 'ul', items: ['Improved a metric by `40%`.'] }],
    }],
  }],
};

test('print resumes preserve the approved font roles and monotonic hierarchy', () => {
  const html = page(parsed, LANES['mitchell-williams-ai-enablement']);

  assert.match(html, /\.rname\{font-family:'Archivo Print','Archivo',sans-serif;[^}]*font-size:34pt/);
  assert.match(html, /\.kicker,.rpillars,.rcontact,.rrole-s\{font-family:'Martian Grotesk',sans-serif/);
  assert.match(html, /\.rpillars\{font-size:12\.48pt;/);
  assert.match(html, /\.rsec-h\{font-family:'Martian Grotesk',sans-serif;font-size:12\.01pt/);
  assert.match(html, /\.rrole-h\{font-family:'Martian Grotesk',sans-serif;font-size:11\.07pt/);
  assert.match(html, /\.rrole-s\{font-family:'Martian Grotesk',sans-serif;font-size:10\.27pt/);
  assert.match(html, /\.rp\{font-size:9\.75pt;[^}]*font-family:'Martian Grotesk'/);
  assert.match(html, /\.rl li\{font-size:9\.75pt;[^}]*font-family:'Martian Grotesk'/);
  assert.match(html, /\.rcontact\{font-size:9\.42pt/);
});

test('inline metrics use the approved Martian body face in print', () => {
  const html = page(parsed, LANES['mitchell-williams-ai-enablement']);

  assert.match(
    html,
    /@media print\{[\s\S]*\.rnum\{font-family:'Martian Grotesk',sans-serif;/,
  );
});

test('project headings use the approved Martian print hierarchy', () => {
  const html = page(parsed, LANES['mitchell-williams-ai-enablement']);

  assert.match(
    html,
    /\.rproject-h\{font-family:'Martian Grotesk',sans-serif;font-size:11\.07pt;/,
  );
  assert.match(html, /\.rproject\{margin:5pt 0 2pt;/);
});

test('projects parse and render as one semantic evidence block', () => {
  const projectResume = parse(`# Mitchell Williams

## Communications Leader

mitwilli@example.com

## Projects

### picture-lock

Shipped an editorial review system for video teams.

- Preserved frame-accurate feedback.
- Cut handoff ambiguity.
`, 'project-fixture');
  const project = projectResume.sections[0].blocks[0];

  assert.equal(project.type, 'project');
  assert.equal(project.head, 'picture-lock');
  assert.deepEqual(project.body, [
    { type: 'p', text: 'Shipped an editorial review system for video teams.' },
    { type: 'ul', items: ['Preserved frame-accurate feedback.', 'Cut handoff ambiguity.'] },
  ]);

  const html = page(projectResume, LANES['mitchell-williams-ai-enablement']);
  assert.match(html, /class="rproject"/);
  assert.match(html, /class="rproject-h"><a[^>]+>picture-lock<\/a><\/div>/);
  assert.match(html, /class="rproject-proof">Shipped an editorial review system/);
  assert.doesNotMatch(html, /class="rrole-h">picture-lock/);
});

test('editorial print tokens enforce the approved readable floor and accent', () => {
  const html = page(parsed, LANES['mitchell-williams-ai-enablement']);

  assert.match(html, /\.rp\{font-size:9\.75pt;line-height:1\.26/);
  assert.match(html, /\.rwrap\{padding:0 0\.42in 0\.05in/);
  assert.match(html, /\.rsec-h\{font-family:'Martian Grotesk',sans-serif;font-size:12\.01pt;/);
  assert.match(html, /\.rwrap section a,.rwrap \.rcontact a\{color:#8a3a33 !important/);
});

test('resume parser omits horizontal rules and provenance comments', () => {
  const parsedResume = parse(`# Mitchell Williams

## Applied AI Builder

mitwilli@example.com

---

## Summary

Built <!-- internal --> production systems.

<!--
AUTO-ASSEMBLED. DO NOT EDIT BY HAND.
-->
`, 'fixture');
  const html = page(parsedResume, LANES['mitchell-williams-ai-enablement']);

  assert.doesNotMatch(html, />---</);
  assert.doesNotMatch(html, /AUTO-ASSEMBLED/);
  assert.doesNotMatch(html, /DO NOT EDIT BY HAND/);
  assert.match(html, /Built\s+production systems/);
});
