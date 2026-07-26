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

test('print resumes use the approved monotonic hierarchy at full size', () => {
  const html = page(parsed, LANES['mitchell-williams-ai-enablement']);

  assert.match(html, /\.rname\{font-size:22pt/);
  assert.match(html, /\.rsec-h\{font-size:12\.5pt/);
  assert.match(html, /\.rrole-h\{font-size:11pt/);
  assert.match(html, /\.rrole-s\{font-size:9\.5pt/);
  assert.match(html, /\.rp\{font-size:10pt/);
  assert.match(html, /\.rl li\{font-size:10pt/);
  assert.match(html, /\.rpillars\{font-size:10pt/);
  assert.match(html, /\.rcontact\{font-size:9\.5pt/);
});

test('inline metrics inherit the Inter body face in print', () => {
  const html = page(parsed, LANES['mitchell-williams-ai-enablement']);

  assert.match(
    html,
    /@media print\{[\s\S]*\.rnum\{font-family:inherit;/,
  );
});

test('project headings use the same print hierarchy and color as role headings', () => {
  const html = page(parsed, LANES['mitchell-williams-ai-enablement']);

  assert.match(
    html,
    /\.rinit-h\{font-family:'Archivo',sans-serif;font-size:11pt;[\s\S]*?color:#1b1a1d;/,
  );
  assert.match(html, /\.rinit\{margin:5pt 0 2pt;/);
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

test('editorial print tokens enforce readable type and restrained accents', () => {
  const html = page(parsed, LANES['mitchell-williams-ai-enablement']);

  assert.match(html, /\.rp\{font-size:10pt;line-height:1\.375/);
  assert.match(html, /\.rwrap\{padding:0 0\.58in 0\.05in/);
  assert.match(html, /\.rsec-h\{font-size:12\.5pt;/);
  assert.match(html, /\.rsec-h\{font-family:'Archivo'[\s\S]*?text-transform:uppercase;color:#8a3a33/);
  assert.doesNotMatch(html, /color:#8a3a33 !important/);
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
