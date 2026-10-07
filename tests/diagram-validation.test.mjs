import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = resolve(repo, 'scripts/pack-diagrams.mjs');
const fixture = resolve(repo, 'examples/diagrams/chinese-diagrams.html');

function run(input, extra = ['--lint-only']) {
  return spawnSync(process.execPath, [script, input, '--root', repo, ...extra], { encoding: 'utf8' });
}

test('Chinese flow, sequence, and lifecycle example passes', () => {
  const result = run(fixture);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('packed diagram example is self-contained and keeps Chinese text', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-diagram-pack-'));
  const output = resolve(dir, 'diagrams.html');
  const result = run(fixture, ['--out', output]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const packed = readFileSync(output, 'utf8');
  assert.match(packed, /data-htmlplan-packed/);
  assert.match(packed, /订单先校验/);
  assert.doesNotMatch(packed, /<(?:link|script)\b[^>]*(?:href|src)=["'][^"']*htmlplan\.(?:css|js)/i);
});

test('page without a native diagram is rejected', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-diagram-missing-'));
  const file = resolve(dir, 'missing.html');
  writeFileSync(file, '<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width"><body><p>无图</p></body></html>');
  const result = run(file);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected at least one/);
});

test('diagram without a text source block is rejected', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-diagram-empty-'));
  const file = resolve(dir, 'empty.html');
  const html = readFileSync(fixture, 'utf8').replace(/<doc-flow[\s\S]*?<\/doc-flow>/, '<doc-flow caption="空图"></doc-flow>');
  writeFileSync(file, html);
  const result = run(file);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires a non-empty/);
});

test('malformed native diagram source is rejected by the pinned parser', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-diagram-malformed-'));
  const file = resolve(dir, 'malformed.html');
  const html = readFileSync(fixture, 'utf8').replace('api -> check : 提交', '这不是合法的图表语法');
  writeFileSync(file, html);
  const result = run(file);
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /couldn.t parse/);
});

test('remote resource is rejected before packing', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-diagram-remote-'));
  const file = resolve(dir, 'remote.html');
  writeFileSync(file, readFileSync(fixture, 'utf8').replace('</main>', '<img src="https://example.test/leak.png"></main>'));
  const result = run(file);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /remote src dependency/);
});
