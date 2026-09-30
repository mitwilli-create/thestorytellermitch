import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { LANES, TERM_LINKS, page } from './build-resumes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lane = LANES['mitchell-williams-ai-enablement'];
const targets = TERM_LINKS.map(([, url]) => url);

const resumeNaming = (text) => ({
  name: 'Mitchell Williams',
  pillars: 'Editorial systems',
  contact: ['mitwilli@example.com'],
  sections: [{
    title: 'Projects',
    blocks: [{ type: 'ul', items: [text] }],
  }],
});

const hrefs = (html) => [...html.matchAll(/<a href="([^"]+)">([^<]*)<\/a>/g)].map(m => ({ href: m[1], text: m[2] }));

test('MERIDIEM and Article to Audience deep-link to their company-neutral work tiles', () => {
  const html = page(resumeNaming('MERIDIEM, one script in seven markets, and Article to Audience, a branded audio edition.'), lane);
  const links = hrefs(html);

  assert.deepEqual(links.find(l => l.text === 'MERIDIEM'), {
    href: '../work.html#play-bundleb-meridiem-es-2026', text: 'MERIDIEM',
  });
  assert.deepEqual(links.find(l => l.text === 'Article to Audience'), {
    href: '../work.html#play-bundlec-article-to-audience-2026', text: 'Article to Audience',
  });
});

test('no resume autolink points at a page addressed to one employer', () => {
  const html = page(resumeNaming('MERIDIEM and Article to Audience, PictureLock, Voice OS, Career Ops.'), lane);
  assert.doesNotMatch(html, /href="[^"]*for-[a-z0-9-]+\.html/);

  // Covers every TERM_LINKS entry, including ones the fixture above does not name.
  assert.ok(targets.length > 10, 'TERM_LINKS is unexpectedly short');
  for (const t of targets) assert.doesNotMatch(t, /(^|\/)for-[^/]*\.html/, `employer-addressed autolink target: ${t}`);
});

test('every work.html #play- autolink target names a clip that exists on work.html', () => {
  const work = readFileSync(join(ROOT, 'work.html'), 'utf8');
  const clips = targets.map(t => t.match(/^\.\.\/work\.html#play-(.+)$/)?.[1]).filter(Boolean);
  assert.ok(clips.includes('bundleb-meridiem-es-2026'));
  assert.ok(clips.includes('bundlec-article-to-audience-2026'));
  for (const clip of clips) assert.ok(work.includes(`data-clip="${clip}"`), `work.html has no tile for #play-${clip}`);
});
