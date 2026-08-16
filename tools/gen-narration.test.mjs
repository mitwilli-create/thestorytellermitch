import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

const SITE = resolve(import.meta.dirname, '..');

test('Throughline narration dry run reads throughline.html and keeps its published asset identifier', () => {
  const result = spawnSync(process.execPath, ['tools/gen-narration.mjs', '--dry-run', '--only', 'throughline'], {
    cwd: SITE,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /(?:skip|renorm|hold|render)\s+Throughline\s/);
  assert.doesNotMatch(result.stderr, /content-ops\.html/);
});
