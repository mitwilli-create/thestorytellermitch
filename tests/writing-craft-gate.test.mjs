import assert from 'node:assert/strict';
import test from 'node:test';

import {
  gatePortfolioWriting,
  isPortfolioNarrative,
} from '../tools/writing-craft-gate.mjs';

test('portfolio narrative is eligible while code and generated pages bypass', () => {
  assert.equal(isPortfolioNarrative('about.html'), true);
  assert.equal(isPortfolioNarrative('assets/site-data/stories.json'), true);
  assert.equal(isPortfolioNarrative('shared/theme.css'), false);
  assert.equal(isPortfolioNarrative('stories.html'), false);
});

test('portfolio gate uses publish-blocking mode', () => {
  let request;
  const result = gatePortfolioWriting({
    text: 'The portfolio draft.',
    artifactId: 'about-html',
    projectRoot: '/tmp/site',
    run: (_command, _args, options) => {
      request = JSON.parse(options.input);
      return {
        status: 0,
        stdout: JSON.stringify({
          decision: 'no-safe-improvement',
          revisedText: 'The portfolio draft.',
          lessonPath: '/tmp/site/.writing-coach/inbox/lesson.md',
        }),
        stderr: '',
      };
    },
  });

  assert.equal(request.sourceSystem, 'storytellermitch-site');
  assert.equal(request.enforcementMode, 'publish-blocking');
  assert.equal(result.decision, 'no-safe-improvement');
});

test('portfolio gate fails closed', () => {
  assert.throws(
    () => gatePortfolioWriting({
      text: 'The draft.',
      artifactId: 'about-html',
      projectRoot: '/tmp/site',
      run: () => ({
        status: 2,
        stdout: '',
        stderr: 'dependency unavailable',
      }),
    }),
    /writing craft failed/,
  );
});

test('portfolio gate handles spawn failure with null output', () => {
  assert.throws(
    () => gatePortfolioWriting({
      text: 'The draft.',
      artifactId: 'about-html',
      projectRoot: '/tmp/site',
      run: () => ({
        status: null,
        stdout: null,
        stderr: 'command unavailable',
      }),
    }),
    /writing craft failed/,
  );
});

test('portfolio gate rejects an unknown success state', () => {
  assert.throws(
    () => gatePortfolioWriting({
      text: 'The draft.',
      artifactId: 'about-html',
      projectRoot: '/tmp/site',
      run: () => ({
        status: 0,
        stdout: JSON.stringify({ decision: 'partial', revisedText: 'The draft.' }),
        stderr: '',
      }),
    }),
    /writing craft blocked/,
  );
});
