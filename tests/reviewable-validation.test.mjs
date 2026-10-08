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

const testedImplementationRules = [
  'For every primary recommendation, evaluate two distinct layers: (a) who or what consumes the claimed top-level benefit and what concretely breaks when that benefit is absent; and (b) who or what consumes each proposed implementation mechanism and what concretely breaks if that mechanism is omitted. Internal coordination consumers do not substitute for consumers of the top-level benefit.',
  'Missing evidence supports neither retaining nor removing the proposal. Base the recommended option only on case-specific benefits and costs established by the supplied source, compare them explicitly, and state what missing evidence would reverse the recommendation.',
  "Treat an author's or reviewer's claim that a premise is established, confirmed, or required by a contract as a claim to verify whenever it supports the recommendation. Quote the authoritative source and check whether its wording entails the claimed conclusion; if it does not, label the premise `前提存疑`.",
  'When whether a finding exists depends on a structural assumption, evaluate keeping the mechanism while writing that assumption into the contract and locking it with tests as a real alternative, even when the source does not propose it. For that contract-based alternative, state the concrete conditions under which it is preferable, not merely acceptable, including the implementation or protocol complexity it avoids and the structural assumption that must remain true. Apply the contract-based alternative only when the conclusion actually depends on a structural assumption. Do not force it into findings about evidence gaps, consumers, or failure impact that do not have that dependency.',
];

function run(input, profile, extra = []) {
  return spawnSync(process.execPath, [script, input, '--profile', profile, '--root', repo, '--lint-only', ...extra], { encoding: 'utf8' });
}

for (const [profile, fixture] of Object.entries(fixtures)) {
  test(`${profile} representative fixture passes`, () => {
    const result = run(fixture, profile);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}

test('implementation-plan preserves the four tested rules verbatim', () => {
  const profile = readFileSync(resolve(repo, 'references/profiles/implementation-plan.md'), 'utf8');
  for (const rule of testedImplementationRules) assert.ok(profile.includes(rule), `missing tested rule: ${rule}`);
});

test('doubtful premise with an authoritative quote passes', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-premise-ok-'));
  const file = resolve(dir, basename(fixtures['implementation-plan']));
  const evidence = '<div data-review-premise="doubtful">前提存疑</div><doc-quote via="doc" data-review-authoritative-quote>Authoritative wording.</doc-quote>';
  writeFileSync(file, readFileSync(fixtures['implementation-plan'], 'utf8').replace('</main>', `${evidence}</main>`));
  const result = run(file, 'implementation-plan');
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('doubtful premise without an authoritative quote is rejected', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-premise-missing-'));
  const file = resolve(dir, basename(fixtures['implementation-plan']));
  writeFileSync(file, readFileSync(fixtures['implementation-plan'], 'utf8').replace('</main>', '<div data-review-premise="doubtful">前提存疑</div></main>'));
  const result = run(file, 'implementation-plan');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires a <doc-quote data-review-authoritative-quote>/);
});

test('contract alternative with preference conditions passes', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-contract-ok-'));
  const file = resolve(dir, basename(fixtures['implementation-plan']));
  const alternative = '<section data-review-alternative="contract">Contract and test alternative</section><p data-review-preferable-when>Prefer when the structural assumption is stable and avoids protocol complexity.</p>';
  writeFileSync(file, readFileSync(fixtures['implementation-plan'], 'utf8').replace('</main>', `${alternative}</main>`));
  const result = run(file, 'implementation-plan');
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('contract alternative without preference conditions is rejected', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-contract-missing-'));
  const file = resolve(dir, basename(fixtures['implementation-plan']));
  writeFileSync(file, readFileSync(fixtures['implementation-plan'], 'utf8').replace('</main>', '<section data-review-alternative="contract">Contract and test alternative</section></main>'));
  const result = run(file, 'implementation-plan');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires a data-review-preferable-when field/);
});

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

const protocolRelativeCases = [
  ['src', '<img src="//example.test/leak.png">', /remote src dependency/],
  ['href', '<link rel="stylesheet" href="//example.test/leak.css">', /remote link dependency/],
  ['object data', '<object data="//example.test/leak.svg"></object>', /remote object dependency/],
  ['CSS import', '<style>@import url("//example.test/leak.css");</style>', /remote CSS import/],
  ['CSS asset', '<style>.leak{background:url(//example.test/leak.png)}</style>', /remote CSS asset/],
];

for (const [name, payload, expected] of protocolRelativeCases) {
  test(`reviewable protocol-relative ${name} is rejected`, () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'doccraft-reviewable-protocol-relative-'));
    const file = resolve(dir, basename(fixtures['implementation-plan']));
    writeFileSync(file, readFileSync(fixtures['implementation-plan'], 'utf8').replace('</main>', `${payload}</main>`));
    const result = run(file, 'implementation-plan');
    assert.equal(result.status, 1);
    assert.match(result.stderr, expected);
  });
}

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
