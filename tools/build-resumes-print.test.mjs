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

  assert.match(html, /\.rname\{font-size:20pt/);
  assert.match(html, /\.rsec-h\{font-size:12\.3pt/);
  assert.match(html, /\.rrole-h\{font-size:11\.6pt/);
  assert.match(html, /\.rrole-s\{font-size:9\.8pt/);
  assert.match(html, /\.rp\{font-size:9\.8pt/);
  assert.match(html, /\.rl li\{font-size:9\.8pt/);
  assert.match(html, /\.rpillars\{font-size:9\.8pt/);
  assert.match(html, /\.rcontact\{font-size:9\.8pt/);
});

test('inline metrics inherit the Inter body face in print', () => {
  const html = page(parsed, LANES['mitchell-williams-ai-enablement']);

  assert.match(
    html,
    /@media print\{[\s\S]*\.rnum\{font-family:inherit;/,
  );
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
