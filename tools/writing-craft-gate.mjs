#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SITE = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_CRAFT_ROOT = '/Users/mitchellwilliams/Documents/writing-craft';
const GENERATED_HTML = new Set(['stories.html', 'work.html', 'writing.html']);

export function isPortfolioNarrative(path) {
  const normalized = path.replaceAll('\\', '/');
  if (normalized.startsWith('assets/site-data/')) {
    return normalized.endsWith('.json');
  }
  return !normalized.includes('/')
    && normalized.endsWith('.html')
    && !GENERATED_HTML.has(normalized);
}

export function gatePortfolioWriting({
  text,
  artifactId,
  projectRoot = SITE,
  run = spawnSync,
  writingCraftRoot = process.env.WRITING_CRAFT_ROOT || DEFAULT_CRAFT_ROOT,
}) {
  const request = {
    sourceSystem: 'storytellermitch-site',
    projectRoot,
    artifactType: 'portfolio-copy',
    artifactId,
    audience: 'hiring-manager',
    stakes: 'high',
    enforcementMode: 'publish-blocking',
    text,
    outputPath: null,
  };
  const result = run(
    process.execPath,
    [join(writingCraftRoot, 'bin', 'writing-craft.mjs'), 'revise'],
    {
      cwd: projectRoot,
      input: JSON.stringify(request),
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    throw new Error(`writing craft failed: ${result.stderr?.trim() || 'invalid response'}`);
  }
  if (result.status !== 0 || payload.decision === 'failed') {
    throw new Error(`writing craft blocked ${artifactId}: ${payload.failure?.message || result.stderr?.trim() || 'gate failure'}`);
  }
  return payload;
}

function collectJsonStrings(value, strings = []) {
  if (typeof value === 'string') {
    if (!/^(?:https?:|\/|assets\/|media\/)/.test(value) && value.split(/\s+/).length >= 3) {
      strings.push(value);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) collectJsonStrings(item, strings);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectJsonStrings(item, strings);
  }
  return strings;
}

export function extractNarrative(path, source) {
  if (path.endsWith('.json')) {
    return collectJsonStrings(JSON.parse(source)).join('\n\n');
  }
  return source
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|amp|quot|#39);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function changedFiles(commit) {
  const result = spawnSync(
    'git',
    ['diff-tree', '--no-commit-id', '--name-only', '-r', commit],
    { cwd: SITE, encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(result.stderr.trim());
  return result.stdout.split('\n').filter(Boolean);
}

async function main() {
  const commit = process.argv[2] === '--commit' ? process.argv[3] : 'HEAD';
  const eligible = changedFiles(commit).filter(isPortfolioNarrative);
  for (const path of eligible) {
    const text = extractNarrative(path, readFileSync(join(SITE, path), 'utf8'));
    if (!text) continue;
    const result = gatePortfolioWriting({
      text,
      artifactId: path.replace(/[^a-z0-9]+/gi, '-'),
    });
    process.stdout.write('Writing Coach: 1 new lesson in .writing-coach/inbox/\n');
    if (result.decision === 'pass') {
      throw new Error(`${path} has a safe craft revision; apply it, review it, and commit before deploy`);
    }
  }
  process.stdout.write(`writing-craft: checked ${eligible.length} changed narrative artifact(s)\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`writing-craft: ${error.message}\n`);
    process.exitCode = 1;
  });
}
