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
  // Phone is stripped from the served HTML (public-page privacy); the PDF keeps it.
  const md = readFileSync(join(ROOT, 'resumes-src', `${file}.md`), 'utf8');
  const phone = (md.match(/\b\d{3}-\d{3}-\d{4}\b/) || [null])[0];
  if (phone) await page.evaluate((p) => {
    for (const el of document.querySelectorAll('.pdf-phone')) el.textContent = p + ' | ';
  }, phone);
  // PDF link annotations must be portable: rewrite relative hrefs to the live site.
  await page.evaluate(() => {
    for (const a of document.querySelectorAll('a[href]')) {
      const h = a.getAttribute('href');
      if (/^(https?:|mailto:|tel:|#)/.test(h)) continue;
      a.setAttribute('href', 'https://thestorytellermitch.com/' + h.replace(/^(\.\.\/)+/, ''));
    }
  });
  // Council-adjudicated link budget (dealbreaker-final-20260710-175432.md): the PDF
  // keeps header identity links plus the first 3 unique deep links in body order;
  // the rest unwrap to plain text. The HTML resume keeps its full link set.
  await page.evaluate(() => {
    const seen = new Set();
    for (const a of document.querySelectorAll('.rwrap section a[href]')) {
      const h = a.getAttribute('href');
      if (!seen.has(h) && seen.size < 3) { seen.add(h); continue; }
      a.replaceWith(...a.childNodes);
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
