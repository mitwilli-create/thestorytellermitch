#!/usr/bin/env node
// Upload published clips' web MP4s to Cloudflare Stream via TUS (resumable),
// writing each returned uid back into clips.json (media.streamId). Idempotent:
// clips that already have a streamId are skipped.
//
// Usage:
//   CF_ACCOUNT_ID=... CF_STREAM_TOKEN=... node tools/stream-upload.mjs [--only <slug>] [--dry-run]
//
// After all uploads: set "playback": "stream" + "streamCustomerCode" in clips.json,
// run `node tools/build-archive.mjs`, commit. Player code never changes.
import { readFileSync, writeFileSync, existsSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = resolve(SITE, 'assets/site-data/clips.json');

const ACCOUNT = process.env.CF_ACCOUNT_ID;
const TOKEN = process.env.CF_STREAM_TOKEN;
const DRY = process.argv.includes('--dry-run');
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
if (!DRY && (!ACCOUNT || !TOKEN)) {
  console.error('Set CF_ACCOUNT_ID and CF_STREAM_TOKEN (API token with Stream:Edit).');
  process.exit(2);
}

const CHUNK = 50 * 1024 * 1024; // 50MB, a multiple of 256KiB per TUS spec for Stream
const TUS_ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/stream`;

function b64(s) { return Buffer.from(s).toString('base64'); }

async function tusUpload(filePath, name) {
  const size = statSync(filePath).size;
  // 1. creation
  const create = await fetch(TUS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(size),
      'Upload-Metadata': `name ${b64(name)}`,
    },
  });
  if (create.status !== 201) throw new Error(`TUS create failed: ${create.status} ${await create.text()}`);
  const location = create.headers.get('location');
  const uid = create.headers.get('stream-media-id');
  if (!location) throw new Error('TUS create returned no Location header');

  // 2. PATCH chunks
  const fd = openSync(filePath, 'r');
  try {
    let offset = 0;
    while (offset < size) {
      const len = Math.min(CHUNK, size - offset);
      const buf = Buffer.alloc(len);
      readSync(fd, buf, 0, len, offset);
      const res = await fetch(location, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        },
        body: buf,
      });
      if (res.status !== 204) throw new Error(`TUS PATCH failed at offset ${offset}: ${res.status} ${await res.text()}`);
      offset = Number(res.headers.get('upload-offset') ?? offset + len);
      process.stdout.write(`\r  ${name}: ${((offset / size) * 100).toFixed(0)}%   `);
    }
  } finally { closeSync(fd); }
  process.stdout.write('\n');
  return uid;
}

const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const jobs = m.clips.filter((c) =>
  c.published && c.media?.local?.startsWith('media/') && !c.media.streamId && !c.media.youtubeId && (!only || c.slug === only));

let done = 0, skippedMissing = 0;
for (const clip of jobs) {
  const file = resolve(SITE, clip.media.local);
  if (!existsSync(file)) { skippedMissing++; console.warn(`missing local media, skip: ${clip.slug}`); continue; }
  if (DRY) { console.log(`would upload ${clip.slug} (${(statSync(file).size / 1048576).toFixed(0)}MB)`); continue; }
  try {
    const uid = await tusUpload(file, clip.slug);
    clip.media.streamId = uid;
    writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n'); // persist after EVERY upload
    done++;
    console.log(`${clip.slug} -> ${uid}`);
  } catch (err) {
    console.error(`FAIL ${clip.slug}: ${err.message}`);
  }
}
const remaining = m.clips.filter((c) => c.published && c.media?.local?.startsWith('media/') && !c.media.streamId && !c.media.youtubeId).length;
console.log(`\nstream-upload: ${done} uploaded, ${skippedMissing} missing local files, ${remaining} still without streamId`);
