#!/usr/bin/env node
/**
 * scripts/screenshot.mjs, visual proof for UI changes on the live site.
 *
 * AGENTS.md requires a real-browser check at desktop AND narrow widths before any
 * visible change is called done. "Looks right in source" is not verification.
 *
 * Serves over http:// rather than file:// on purpose: the Chrome extension blocks
 * file:// URLs, so a file:// shot cannot be reproduced by the browser tooling.
 *
 * Usage, from the repo root:
 *   python3 -m http.server 8931 &
 *   node scripts/screenshot.mjs resume/ai-enablement.html
 *   node scripts/screenshot.mjs projects.html --out /tmp/shots --port 8931
 *
 * Writes <out>/<slug>-desktop.png (1440 wide) and <out>/<slug>-narrow.png (900 wide),
 * both full-page. Default out dir is .shots/, which is gitignored.
 */
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * This repo has zero runtime dependencies on purpose (AGENTS.md), so playwright is not
 * installed here. Resolve it from wherever it already exists on the machine rather than
 * adding a dependency to a dependency-free repo. PLAYWRIGHT_MODULE overrides the search.
 */
async function loadChromium() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    'playwright',
    `${process.env.HOME}/Documents/career-ops/node_modules/playwright`,
  ].filter(Boolean);
  const require = createRequire(import.meta.url);
  const tried = [];
  for (const c of candidates) {
    try {
      // createRequire, not import(): a bare directory path has no ESM resolution,
      // but CJS resolution reads its package.json main. Both forms reach the same module.
      return require(c).chromium;
    } catch (e) {
      tried.push(`${c}: ${e.code || e.message}`);
    }
  }
  throw new Error(
    `playwright not found. Tried:\n  ${tried.join('\n  ')}\n` +
    `Fix: set PLAYWRIGHT_MODULE to an installed playwright, or run 'npx playwright install chromium'.`
  );
}

const WIDTHS = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'narrow', width: 900, height: 900 },
];

function parseArgs(argv) {
  const positional = [];
  const opts = { out: '.shots', port: '8931' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--out') { opts.out = argv[++i]; }
    else if (a === '--port') { opts.port = argv[++i]; }
    else if (a.startsWith('--')) { throw new Error(`unknown flag: ${a}`); }
    else { positional.push(a); }
  }
  return { page: positional[0], opts };
}

const { page: pagePath, opts } = parseArgs(process.argv.slice(2));

if (!pagePath) {
  console.error('usage: node scripts/screenshot.mjs <page.html> [--out DIR] [--port PORT]');
  console.error('note: a static server must already be serving the repo root on PORT.');
  process.exit(2);
}

const url = `http://localhost:${opts.port}/${pagePath.replace(/^\/+/, '')}`;
const slug = pagePath.replace(/\.html$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

await mkdir(opts.out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch();
try {
  for (const { label, width, height } of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height } });
    const response = await page.goto(url, { waitUntil: 'networkidle' });
    if (!response || !response.ok()) {
      throw new Error(`${url} returned ${response ? response.status() : 'no response'}. Is the static server running on port ${opts.port}?`);
    }
    const file = path.join(opts.out, `${slug}-${label}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`${label.padEnd(8)} ${width}px  ${file}`);
    await page.close();
  }
} finally {
  await browser.close();
}
