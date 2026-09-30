import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { LANES, page } from './build-resumes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lane = LANES['mitchell-williams-ai-enablement'];

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

  // Source guard: covers every TERM_LINKS entry, including ones this fixture does not name.
  const src = readFileSync(join(ROOT, 'tools/build-resumes.mjs'), 'utf8');
  const table = src.slice(src.indexOf('const TERM_LINKS = ['), src.indexOf('];', src.indexOf('const TERM_LINKS = [')));
  assert.ok(table.length > 0, 'TERM_LINKS table not found');
  const targets = [...table.matchAll(/\[\s*'[^']+',\s*'([^']+)'\s*\]/g)].map(m => m[1]);
  assert.ok(targets.length > 10, 'TERM_LINKS entries not parsed');
  for (const t of targets) assert.doesNotMatch(t, /(^|\/)for-[^/]*\.html/, `employer-addressed autolink target: ${t}`);
});

test('every work.html #play- autolink target names a clip that exists on work.html', () => {
  const src = readFileSync(join(ROOT, 'tools/build-resumes.mjs'), 'utf8');
  const work = readFileSync(join(ROOT, 'work.html'), 'utf8');
  const clips = [...src.matchAll(/'\.\.\/work\.html#play-([^']+)'/g)].map(m => m[1]);
  assert.ok(clips.includes('bundleb-meridiem-es-2026'));
  assert.ok(clips.includes('bundlec-article-to-audience-2026'));
  for (const clip of clips) assert.ok(work.includes(`data-clip="${clip}"`), `work.html has no tile for #play-${clip}`);
});
