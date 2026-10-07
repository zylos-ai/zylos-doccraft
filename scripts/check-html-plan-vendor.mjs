#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valueAfter = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : '';
};
const lock = JSON.parse(readFileSync(resolve(repo, 'vendor/html-plan.lock.json'), 'utf8'));
const vendorDir = resolve(valueAfter('--vendor-dir') || resolve(repo, 'vendor/html-plan'));
const sourceRepo = valueAfter('--source') ? resolve(valueAfter('--source')) : '';

const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const filesBelow = (root, current = root) => readdirSync(current, { withFileTypes: true })
  .flatMap((entry) => {
    const path = resolve(current, entry.name);
    return entry.isDirectory() ? filesBelow(root, path) : [relative(root, path).replaceAll('\\', '/')];
  })
  .sort();

const expected = new Map([
  ['LICENSE', lock.license_sha256],
  ...Object.entries(lock.files),
]);
const errors = [];
for (const [path, digest] of expected) {
  const fullPath = resolve(vendorDir, path);
  if (!statSafe(fullPath)?.isFile()) errors.push(`missing vendored file: ${path}`);
  else if (hash(fullPath) !== digest) errors.push(`hash mismatch: ${path}`);
}
for (const path of filesBelow(vendorDir)) {
  if (!expected.has(path)) errors.push(`unlocked vendored file: ${path}`);
}

if (errors.length) {
  for (const error of errors) console.error(`html-plan vendor: ${error}`);
  process.exit(1);
}

console.log(`html-plan vendor matches lock at ${lock.commit}`);

if (sourceRepo) {
  const sourceDir = resolve(sourceRepo, lock.source_path);
  const candidate = new Map([
    ['LICENSE', resolve(sourceRepo, 'LICENSE')],
    ...filesBelow(sourceDir).map((path) => [path, resolve(sourceDir, path)]),
  ]);
  const revision = spawnSync('git', ['-C', sourceRepo, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (revision.status !== 0) throw new Error(`cannot resolve source revision: ${revision.stderr.trim()}`);
  console.log(`candidate source revision: ${revision.stdout.trim()}`);

  const paths = [...new Set([...expected.keys(), ...candidate.keys()])].sort();
  const changes = paths.flatMap((path) => {
    if (!expected.has(path)) return [`A ${path}`];
    if (!candidate.has(path)) return [`D ${path}`];
    return hash(resolve(vendorDir, path)) === hash(candidate.get(path)) ? [] : [`M ${path}`];
  });
  if (!changes.length) console.log('candidate source matches the current vendored files');
  else {
    console.log('candidate changes relative to the current vendor:');
    changes.forEach((change) => console.log(change));
  }
}

function statSafe(path) {
  try { return statSync(path); } catch { return undefined; }
}
