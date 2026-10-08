import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { spawnSync } from 'node:child_process';

const upstream = readFileSync('vendor/html-plan/runtime/htmlplan.js', 'utf8');
const generated = readFileSync('runtime/diagrams.js', 'utf8');
const original = {}; runInNewContext(upstream, original);
const adapted = { measure:(text) => String(text).length * 7 };
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
test('adapted sequence parser accepts Unicode note actor IDs without changing pinned upstream', () => {
  const source = '订单接入网关服务 -> 规则服务 : 校验订单\nnote over 订单接入网关服务: 等待异步回执';
  const result = adapted.parsers.parseSeq(source);
  assert.equal(result.errors.length, 0);
  assert.ok(result.actors.some(({ id }) => id === '订单接入网关服务'));
  assert.ok(result.steps.some(({ kind, over }) => kind === 'note' && over.includes('订单接入网关服务')));

  const pinned = original.HtmlPlan.parseSeq(source);
  assert.ok(pinned.errors.length, 'the locked upstream grammar remains unchanged');
  assert.equal(pinned.steps.some(({ kind }) => kind === 'note'), false);
});
test('dense flow fixture reproduces an edge label beyond its own path threshold', () => {
  const source = 'dir LR\na = Order intake gateway\\nvalidates request\\nroutes commands\\ntracks response\nb = Batch reconciler\nc = Policy review\nd = Order ledger\na -> c : x\na -> d : y\nb -> c : z\nc -> a : retry with validation context';
  const layout = adapted.parsers.layoutFlow(adapted.parsers.parseFlow(source));
  const route = layout.routes.find(({ e }) => e.from === 'c' && e.to === 'a');
  const distance = route.pts.slice(0, -1).reduce((closest, [x1, y1], index) => {
    const [x2, y2] = route.pts[index + 1], dx = x2 - x1, dy = y2 - y1;
    const at = Math.max(0, Math.min(1, ((route.lx - x1) * dx + (route.ly - y1) * dy) / (dx * dx + dy * dy || 1)));
    return Math.min(closest, Math.hypot(route.lx - x1 - at * dx, route.ly - y1 - at * dy));
  }, Infinity);
  assert.ok(distance > 24, `expected raw c -> a label distance above 24px, got ${distance}`);
});
test('generated runtime is reproducible from locked upstream and adapter', () => {
  const result = spawnSync(process.execPath, ['scripts/build-diagram-runtime.mjs'], { encoding:'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync('runtime/diagrams.js', 'utf8'), generated);
  assert.ok(!generated.includes('localStorage'));
  assert.ok(!generated.includes('globalThis.HtmlPlan'));
});
