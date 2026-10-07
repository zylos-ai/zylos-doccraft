import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = resolve(repo, 'scripts/check-html-plan-vendor.mjs');

test('vendored html-plan matches its lock', () => {
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /matches lock/);
});

test('vendored html-plan rejects modified content', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'doccraft-vendor-'));
  const vendor = resolve(root, 'html-plan');
  cpSync(resolve(repo, 'vendor/html-plan'), vendor, { recursive: true });
  writeFileSync(resolve(vendor, 'SKILL.md'), 'modified upstream content\n');
  const result = spawnSync(process.execPath, [script, '--vendor-dir', vendor], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /hash mismatch: SKILL\.md/);
});
