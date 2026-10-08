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
const template = resolve(repo, 'assets/template.html');

function run(input, extra = ['--lint-only']) {
  return spawnSync(process.execPath, [script, input, '--root', repo, ...extra], { encoding: 'utf8' });
}

function ordinaryTemplateSource() {
  const diagrams = readFileSync(fixture, 'utf8').match(/<doc-(?:flow|seq|machine)\b[\s\S]*?<\/doc-(?:flow|seq|machine)>/gi).join('\n');
  return readFileSync(template, 'utf8')
    .replace('<title><!-- 文档标题 --></title>', '<title>普通文档图表回归</title>')
    .replace('<h1><!-- 文档标题 --></h1>', '<h1>普通文档图表回归</h1>')
    .replace('</head>', '<link rel="stylesheet" href="../runtime/diagrams.css"><script src="../runtime/diagrams.js" defer></script></head>')
    .replace('<footer>', `${diagrams}\n<footer>`);
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
  assert.match(packed, /data-doccraft-diagrams-packed/);
  assert.match(packed, /<style data-doccraft-diagrams>/);
  assert.match(packed, /<script data-doccraft-diagrams>/);
  assert.match(packed, /订单先校验/);
  assert.doesNotMatch(packed, /data-htmlplan|class=["'][^"']*nw-bar|localStorage/);
  assert.doesNotMatch(packed, /<(?:link|script)\b[^>]*(?:href|src)=["'][^"']*(?:htmlplan|diagrams)\.(?:css|js)/i);
});

test('ordinary template with all three diagrams packs without the review runtime', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-template-diagrams-'));
  const source = resolve(dir, 'ordinary.html');
  const output = resolve(dir, 'ordinary.packed.html');
  writeFileSync(source, ordinaryTemplateSource());
  const result = run(source, ['--out', output]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const packed = readFileSync(output, 'utf8');
  assert.match(packed, /--accent:\s*#0E7C72/);
  assert.match(packed, /--maxw:\s*880px/);
  assert.match(packed, /\.tldr\s*\{[^}]*border-left:\s*4px solid var\(--accent\)/s);
  assert.doesNotMatch(packed, /class=["'][^"']*nw-bar|localStorage|body\s*\{[^}]*padding-left:\s*260px/s);
});

test('--artifact output also replaces the full review runtime', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-diagram-artifact-'));
  const output = resolve(dir, 'diagrams.html');
  const result = run(fixture, ['--out', output, '--artifact']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const path of [output, resolve(dir, 'diagrams.artifact.html')]) {
    const packed = readFileSync(path, 'utf8');
    assert.match(packed, /data-doccraft-diagrams/);
    assert.doesNotMatch(packed, /data-htmlplan|class=["'][^"']*nw-bar|localStorage/);
  }
});

test('local assets still resolve relative to the authoring file', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-diagram-local-asset-'));
  const source = resolve(dir, 'diagrams.html');
  const output = resolve(dir, 'diagrams.packed.html');
  writeFileSync(resolve(dir, 'pixel.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  writeFileSync(source, readFileSync(fixture, 'utf8').replace('</main>', '<img src="./pixel.png"></main>'));
  const result = run(source, ['--out', output]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(readFileSync(output, 'utf8'), /src="data:image\/png;base64,/);
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

const protocolRelativeCases = [
  ['src', '<img src="//example.test/leak.png">', /remote src dependency/],
  ['href', '<link rel="stylesheet" href="//example.test/leak.css">', /remote link dependency/],
  ['object data', '<object data="//example.test/leak.svg"></object>', /remote object dependency/],
  ['CSS import', '<style>@import url("//example.test/leak.css");</style>', /remote CSS import/],
  ['CSS asset', '<style>.leak{background:url(//example.test/leak.png)}</style>', /remote CSS asset/],
];

for (const [name, payload, expected] of protocolRelativeCases) {
  test(`protocol-relative ${name} is rejected`, () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-diagram-protocol-relative-'));
    const file = resolve(dir, 'remote.html');
    writeFileSync(file, readFileSync(fixture, 'utf8').replace('</main>', `${payload}</main>`));
    const result = run(file);
    assert.equal(result.status, 1);
    assert.match(result.stderr, expected);
  });
}
