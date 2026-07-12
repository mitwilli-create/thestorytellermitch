#!/usr/bin/env node
// hd-audit.mjs - sitewide highest-definition gate (standing, per round + capstone).
// Walks every page at 1440x900 (2x DPR assumed) and 390x844, compares each rendered
// visual element's intrinsic pixel size against its rendered CSS size, and flags
// anything served under RATIO_MIN x its rendered size (visible softness threshold).
// Usage: node tools/hd-audit.mjs [--base http://127.0.0.1:8990] [--json out.json] [--page timeline]
// Exit 1 if any un-allowlisted flag; allowlist: tools/hd-audit-allow.json
// (entries: {page, viewport, src, reason} - src substring match; reason = known ceiling).
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RATIO_MIN = 1.6;
const MIN_RENDER_PX = 40; // ignore icons/tiny chrome
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const BASE = opt('--base', 'http://127.0.0.1:8990');
const ONLY = opt('--page', null);
const JSON_OUT = opt('--json', null);

const pages = readdirSync(root).filter(f => f.endsWith('.html'))
  .concat(readdirSync(join(root, 'resume')).filter(f => f.endsWith('.html')).map(f => 'resume/' + f))
  .filter(p => !ONLY || p.includes(ONLY));

const allowPath = join(root, 'tools', 'hd-audit-allow.json');
const allow = existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, 'utf8')) : [];
const allowed = (page, viewport, src) => allow.find(a =>
  (!a.page || page.includes(a.page)) &&
  (!a.viewport || a.viewport === viewport) &&
  src.includes(a.src));

const { chromium } = await import('playwright');
const browser = await chromium.launch();
const flags = [];
let audited = 0;

for (const vp of [
  { name: '1440', width: 1440, height: 900, dpr: 2 },
  { name: '390', width: 390, height: 844, dpr: 3 },
]) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
  });
  for (const page of pages) {
    const p = await ctx.newPage();
    try {
      await p.goto(`${BASE}/${page}`, { waitUntil: 'load', timeout: 30000 });
    } catch (e) {
      flags.push({ page, viewport: vp.name, src: '(page load)', problem: String(e).slice(0, 120) });
      await p.close();
      continue;
    }
    // Force reveal-ins and defeat lazy loading, then walk the page.
    try {
    await p.evaluate(async () => {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
      document.querySelectorAll('img[loading="lazy"]').forEach(el => (el.loading = 'eager'));
      const step = window.innerHeight;
      for (let y = 0; y <= document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 400));
    });
    const results = await p.evaluate(async (MIN_RENDER_PX) => {
      const out = [];
      const probeImage = src => new Promise(res => {
        const im = new Image();
        im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
        im.onerror = () => res(null);
        im.src = src;
      });
      const visible = el => {
        const r = el.getBoundingClientRect();
        return r.width >= MIN_RENDER_PX && r.height >= MIN_RENDER_PX;
      };
      for (const img of document.querySelectorAll('img')) {
        if (!visible(img)) continue;
        const r = img.getBoundingClientRect();
        if (!img.complete || !img.naturalWidth) { await new Promise(res => setTimeout(res, 300)); }
        out.push({ kind: 'img', src: img.currentSrc || img.src, iw: img.naturalWidth, ih: img.naturalHeight, rw: r.width, rh: r.height });
      }
      for (const v of document.querySelectorAll('video')) {
        if (!visible(v)) continue;
        const r = v.getBoundingClientRect();
        if (!v.videoWidth) {
          v.preload = 'metadata';
          try { v.load(); } catch {}
          await new Promise(res => {
            if (v.videoWidth) return res();
            v.addEventListener('loadedmetadata', res, { once: true });
            setTimeout(res, 4000);
          });
        }
        const src = v.currentSrc || (v.querySelector('source') || {}).src || '(video)';
        out.push({ kind: 'video', src, iw: v.videoWidth, ih: v.videoHeight, rw: r.width, rh: r.height });
        if (v.poster) {
          const dim = await probeImage(v.poster);
          if (dim) out.push({ kind: 'poster', src: v.poster, iw: dim.w, ih: dim.h, rw: r.width, rh: r.height });
        }
      }
      for (const el of document.querySelectorAll('*')) {
        const bg = getComputedStyle(el).backgroundImage;
        if (!bg || !bg.includes('url(')) continue;
        if (!visible(el)) continue;
        const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
        if (!m || m[1].startsWith('data:')) continue;
        const r = el.getBoundingClientRect();
        const dim = await probeImage(m[1]);
        if (dim) out.push({ kind: 'bg', src: m[1], iw: dim.w, ih: dim.h, rw: r.width, rh: r.height });
      }
      return out;
    }, MIN_RENDER_PX);
    for (const e of results) {
      audited++;
      if (!e.iw || !e.rw) continue;
      const ratio = Math.min(e.iw / e.rw, e.ih / e.rh);
      if (ratio < RATIO_MIN) {
        const src = e.src.replace(/^https?:\/\/[^/]+\//, '');
        const entry = { page, viewport: vp.name, kind: e.kind, src, intrinsic: `${e.iw}x${e.ih}`, rendered: `${Math.round(e.rw)}x${Math.round(e.rh)}`, ratio: +ratio.toFixed(2) };
        const a = allowed(page, vp.name, src);
        if (a) entry.allowed = a.reason;
        flags.push(entry);
      }
    }
    } catch (e) {
      flags.push({ page, viewport: vp.name, src: '(audit walk)', problem: String(e).split('\n')[0].slice(0, 160) });
    }
    await p.close();
  }
  await ctx.close();
}
await browser.close();

const hard = flags.filter(f => !f.allowed);
console.log(`hd-audit: ${audited} elements audited across ${pages.length} pages x 2 viewports`);
for (const f of flags) {
  console.log(`${f.allowed ? 'ALLOW' : 'FLAG '} [${f.viewport}] ${f.page} ${f.kind || ''} ${f.src} ${f.intrinsic || ''} @ ${f.rendered || ''} = ${f.ratio ?? ''}x${f.allowed ? ` (${f.allowed})` : ''}${f.problem ? ' ' + f.problem : ''}`);
}
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(flags, null, 2));
console.log(hard.length ? `hd-audit: ${hard.length} flag(s) below ${RATIO_MIN}x` : 'hd-audit: clean');
process.exit(hard.length ? 1 : 0);
