import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = resolve(repo, 'scripts/pack-reviewable.mjs');
const fixtures = {
  'implementation-plan': resolve(repo, 'examples/reviewable/implementation-plan.html'),
  'execution-plan': resolve(repo, 'examples/reviewable/execution-plan.html'),
  'code-review-guide': resolve(repo, 'examples/reviewable/code-review-guide.html'),
};

function run(input, profile, extra = []) {
  return spawnSync(process.execPath, [script, input, '--profile', profile, '--root', repo, '--lint-only', ...extra], { encoding: 'utf8' });
}

for (const [profile, fixture] of Object.entries(fixtures)) {
  test(`${profile} representative fixture passes`, () => {
    const result = run(fixture, profile);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}

test('profile mismatch is rejected before packing', () => {
  const result = run(fixtures['implementation-plan'], 'execution-plan');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /profile metadata/);
});

test('remote media is rejected', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-remote-'));
  const file = resolve(dir, basename(fixtures['implementation-plan']));
  writeFileSync(file, readFileSync(fixtures['implementation-plan'], 'utf8').replace('</main>', '<img src="https://example.test/leak.png"></main>'));
  const result = run(file, 'implementation-plan');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /remote src dependency/);
});

test('sensitive content is rejected', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-secret-'));
  const file = resolve(dir, basename(fixtures['implementation-plan']));
  writeFileSync(file, readFileSync(fixtures['implementation-plan'], 'utf8').replace('</main>', '<p>api_key="abcdefghijklmnopqrstuvwxyz123456"</p></main>'));
  const result = run(file, 'implementation-plan');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /credential assignment/);
});

test('invalid claim hierarchy is rejected', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-depth-'));
  const file = resolve(dir, basename(fixtures['implementation-plan']));
  const html = readFileSync(fixtures['implementation-plan'], 'utf8')
    .replace('<doc-code', '<doc-claim><p>A third level nests another claim.</p><doc-claim><p>A fourth level is invalid.</p><doc-code')
    .replace('</doc-code>', '</doc-code></doc-claim></doc-claim>');
  writeFileSync(file, html);
  const result = run(file, 'implementation-plan');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /exceeds three levels/);
});

test('missing required exhibit is rejected', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-exhibit-'));
  const file = resolve(dir, basename(fixtures['execution-plan']));
  writeFileSync(file, readFileSync(fixtures['execution-plan'], 'utf8').replace(/<doc-seq[\s\S]*?<\/doc-seq>/, '<doc-note>Order is not evidenced.</doc-note>'));
  const result = run(file, 'execution-plan');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires a <doc-seq>/);
});

test('code-review revisions accept content before name', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-meta-order-'));
  const file = resolve(dir, basename(fixtures['code-review-guide']));
  const html = readFileSync(fixtures['code-review-guide'], 'utf8')
    .replace(/<meta name="doccraft-base" content="([^"]+)">/, '<meta content="$1" name="doccraft-base">')
    .replace(/<meta name="doccraft-head" content="([^"]+)">/, '<meta content="$1" name="doccraft-head">');
  writeFileSync(file, html);
  const result = run(file, 'code-review-guide');
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
