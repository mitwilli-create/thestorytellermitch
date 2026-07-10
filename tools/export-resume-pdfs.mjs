#!/usr/bin/env node
// export-resume-pdfs.mjs : render resume/<lane>.html to assets/resumes/<file>.pdf
// via Playwright (print CSS = light bone-paper variant). HARD GATE: any PDF over
// 2 pages fails the run. Run with career-ops' playwright:
//   NODE_PATH=$HOME/Documents/career-ops/node_modules node tools/export-resume-pdfs.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const PW_ROOT = process.env.PLAYWRIGHT_PKG_ROOT || join(process.env.HOME, 'Documents/career-ops');
const require_ = createRequire(join(PW_ROOT, 'package.json'));
const { chromium } = require_('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANES = {
  'mitchell-williams-forward-deployed': 'forward-deployed',
  'mitchell-williams-ai-solutions-architect': 'ai-solutions-architect',
  'mitchell-williams-ai-enablement': 'ai-enablement',
  'mitchell-williams-ai-program-manager': 'ai-program-manager',
  'mitchell-williams-comms-manager': 'comms-manager',
  'mitchell-williams-devrel-education': 'devrel-education',
  'mitchell-williams-content-editorial': 'content-editorial',
};

const pageCount = (buf) => {
  const s = buf.toString('latin1');
  const m = s.match(/\/Type\s*\/Page[^s]/g);
  return m ? m.length : -1;
};

const browser = await chromium.launch();
const page = await browser.newPage();
mkdirSync(join(ROOT, 'assets/resumes'), { recursive: true });
let fail = 0;
for (const [file, slug] of Object.entries(LANES)) {
  const url = 'file://' + join(ROOT, 'resume', `${slug}.html`);
  await page.goto(url, { waitUntil: 'networkidle' });
  // PDF link annotations must be portable: rewrite relative hrefs to the live site.
  await page.evaluate(() => {
    for (const a of document.querySelectorAll('a[href]')) {
      const h = a.getAttribute('href');
      if (/^(https?:|mailto:|tel:|#)/.test(h)) continue;
      a.setAttribute('href', 'https://thestorytellermitch.com/' + h.replace(/^(\.\.\/)+/, ''));
    }
  });
  const pdf = await page.pdf({ format: 'Letter', printBackground: true });
  const n = pageCount(pdf);
  const out = join(ROOT, 'assets/resumes', `${file}.pdf`);
  if (n > 2 || n < 1) {
    console.error(`FAIL ${slug}: ${n} pages (gate is <=2) : NOT written`);
    fail++;
    continue;
  }
  writeFileSync(out, pdf);
  console.log(`OK ${slug}: ${n} page(s) -> assets/resumes/${file}.pdf (${(pdf.length / 1024).toFixed(0)}KB)`);
}
await browser.close();
if (fail) { console.error(`${fail} resume(s) failed the 2-page gate`); process.exit(1); }
console.log('all resume PDFs exported inside the 2-page gate');
