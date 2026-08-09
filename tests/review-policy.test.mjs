import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('hosted review stays manual and bounded', () => {
  const config = readFileSync(new URL('../.coderabbit.yaml', import.meta.url), 'utf8');

  assert.match(config, /auto_review:\n\s+enabled: false\n/);
});
