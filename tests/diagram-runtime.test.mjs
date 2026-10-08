import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { spawnSync } from 'node:child_process';

const upstream = readFileSync('vendor/html-plan/runtime/htmlplan.js', 'utf8');
const generated = readFileSync('runtime/diagrams.js', 'utf8');
const original = {}; runInNewContext(upstream, original);
const adapted = {};
runInNewContext(generated.slice(generated.indexOf('const NW = {};'), generated.indexOf('const $ = ')) + '\nglobalThis.parsers = NW;', adapted);
const cases = {
  parseFlow: ['dir LR\na = Start [hex blue]\nb = End [actor green]\na <-> b : both\ngroup Group: a b', 'a = Bad [unknown]', '| a | a |\na -> missing : reject'],
  parseSeq: ['participants: a "Actor One" b "Actor Two"\na -> a : self\na -x-> b : lost\n--- phase ---\nnote over a,b: note', 'invalid syntax'],
  parseMachine: ['machine order initial draft\nstate draft # Draft\nstate done final # Done\ndraft -submit-> done : accepted', 'state bad\nbad -event-> missing'],
};
for (const [parser, sources] of Object.entries(cases)) {
  test(`${parser} reuses pinned grammar for accepted and rejected sources`, () => {
    for (const source of sources) assert.equal(JSON.stringify(adapted.parsers[parser](source)), JSON.stringify(original.HtmlPlan[parser](source)));
    assert.equal(adapted.parsers[parser](sources[0]).errors.length, 0);
    assert.ok(adapted.parsers[parser](sources.at(-1)).errors.length);
  });
}
test('generated runtime is reproducible from locked upstream and adapter', () => {
  const result = spawnSync(process.execPath, ['scripts/build-diagram-runtime.mjs'], { encoding:'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync('runtime/diagrams.js', 'utf8'), generated);
  assert.ok(!generated.includes('localStorage'));
  assert.ok(!generated.includes('globalThis.HtmlPlan'));
});
