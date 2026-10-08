import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let playwright;
for (const path of ['playwright', 'playwright-core', '/opt/playwright/node_modules/playwright', '/opt/playwright/node_modules/playwright-core']) {
  try { playwright = require(path); break; } catch {}
}
assert.ok(playwright, 'Playwright required');
const { chromium } = playwright;
const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath(), '/opt/ms-playwright/chromium-1228/chrome-linux64/chrome'].find((path) => path && existsSync(path));
const work = mkdtempSync(resolve(tmpdir(), 'doccraft-semantics-'));
const source = resolve(work, 'fixture.html'), output = resolve(work, 'packed.html');
const chinese = '\u4e2d\u6587\u6807\u7b7e\u5b9e\u9645\u5bbd\u5ea6\u9700\u8981\u5728\u5e03\u5c40\u524d\u8ba1\u7b97';
const hiddenEdge = '\u9690\u85cf\u8fb9', reverse = '\u53cd\u5411';
const notePlaceholder = 'note over unicode_note_actor: wait for callback';
const unicodeNote = 'note over \u8ba2\u5355\u63a5\u5165\u7f51\u5173\u670d\u52a1: \u7b49\u5f85\u5f02\u6b65\u56de\u6267';
const diagram = (tag, lines, attrs='') => `<${tag} ${attrs}><script type="text/plain">${lines.join('\n')}</script></${tag}>`;
writeFileSync(source, `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>Diagram semantic regression</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root { --surface:#fff;--ink:#22252e;--ink2:#5c6270;--accent:#0e7c72;--accent-soft:#e0f0ee;--hairline:#dfe3e1; }
:root[data-theme=dark] { --surface:#202126;--ink:#f1f2f3;--ink2:#b5bbc4;--accent:#4ec2b2;--accent-soft:#23423f;--hairline:#454851; }
body { margin:0;padding:20px; } main { max-width:880px;margin:auto; }
</style><link rel="stylesheet" href="runtime/diagrams.css"><script src="runtime/diagrams.js" defer></script></head><body><main><div id="outside" data-state="done" data-field="status">unchanged</div>
${diagram('doc-flow',['dir LR',`a = ${chinese} [box accent]`,`  ${chinese}`,`b = ${chinese} [pill green]`,`a <-> b : ${chinese}`,'b -> a : reverse'])}
${diagram('doc-flow',['a = A [diamond]','b = B [hex]','a -> b : proceed'])}
${diagram('doc-flow',['dir LR','a = Blue [blue]','b = Purple [purple]','c = Ink [ink]','a -> b : next','b -> c : next'])}
${diagram('doc-flow',['dir LR','a = Order intake gateway\\nvalidates request\\nroutes commands\\ntracks response','b = Batch reconciler','c = Policy review','d = Order ledger','a -> c : x','a -> d : y','b -> c : z','c -> a : retry with validation context'])}
${diagram('doc-machine',['machine order initial draft',`state draft "${chinese}" shows #outside set status=changed`,`state done "${chinese}" final`, `draft -submit-> done : ${chinese}`,'done -undo-> draft : reverse'],'dir="LR"')}
${diagram('doc-machine',['machine vertical initial one','state one "One"','state two "Two" final','one -next-> two : vertical'],'dir="TB"')}
${diagram('doc-seq',[`participants: a "${chinese}" b "${chinese}"`,'a -> a : self call','a -> b : message','b --> a : reply',`note over a,b: ${chinese}`,notePlaceholder])}
<section id="hidden-diagrams" style="display:none">
${diagram('doc-flow',['dir LR','x = X','y = Y',`x -> y : ${hiddenEdge}`,`y -> x : ${reverse}`])}
${diagram('doc-machine',['machine hidden initial draft','state draft "Hidden draft"','state done "Hidden done" final','draft -submit-> done : hidden forward','done -undo-> draft : hidden reverse'],'dir="LR"')}
</section>
</main></body></html>`);
const pack = spawnSync(process.execPath, ['scripts/pack-diagrams.mjs', source, '--root', process.cwd(), '-o', output], { encoding:'utf8' });
assert.equal(pack.status, 0, pack.stdout + pack.stderr);
writeFileSync(output, readFileSync(output, 'utf8').replace(notePlaceholder, unicodeNote));
const browser = await chromium.launch({ headless:true, executablePath });
function inspect() {
  const failures = [];
  const intersects = (a,b) => a.x < b.x+b.width-1 && a.x+a.width > b.x+1 && a.y < b.y+b.height-1 && a.y+a.height > b.y+1;
  const distanceToPath = (box, path) => {
    const center = { x:box.x + box.width / 2, y:box.y + box.height / 2 };
    const length = path.getTotalLength(), samples = Math.max(1, Math.ceil(length / 2));
    let closest = Infinity;
    for (let i=0;i<=samples;i++) { const point=path.getPointAtLength(length*i/samples); closest=Math.min(closest,Math.hypot(center.x-point.x,center.y-point.y)); }
    return closest;
  };
  for (const host of document.querySelectorAll('doc-flow,doc-seq,doc-machine')) {
    const root = host.shadowRoot, svg = root.querySelector('svg.nw');
    if (!svg || host.dataset.doccraftDiagram === 'error') { failures.push('missing SVG'); continue; }
    const nodes = [...svg.querySelectorAll('g.node, g.st')].map((group) => group.firstElementChild.getBBox());
    const labels = [...svg.querySelectorAll('g.edge rect.lbl, g.tr rect.lbl')];
    const edgePaths=[...svg.querySelectorAll('g.edge path[marker-end],g.tr path[marker-end]')];
    if (host.tagName==='DOC-FLOW' && edgePaths.length===2 && edgePaths[0].getAttribute('d')===edgePaths[1].getAttribute('d')) failures.push('reverse routes coincide');
    for (const path of edgePaths) {
      const point = path.getPointAtLength(path.getTotalLength());
      if (nodes.some((b) => point.x > b.x+2 && point.x < b.x+b.width-2 && point.y > b.y+2 && point.y < b.y+b.height-2)) failures.push('arrow endpoint inside node');
      if (!root.querySelector(path.getAttribute('marker-end').slice(4,-1))) failures.push('missing marker');
      if (labels.some((rect) => { const b=rect.getBBox();return point.x>b.x && point.x<b.x+b.width && point.y>b.y && point.y<b.y+b.height; })) failures.push('arrow covered by label');
      for (const length of [Math.max(0,path.getTotalLength()-8), ...(path.hasAttribute('marker-start')?[0,Math.min(8,path.getTotalLength())]:[])]) {
        const p=path.getPointAtLength(length);
        if(nodes.some(b=>p.x>b.x+2&&p.x<b.x+b.width-2&&p.y>b.y+2&&p.y<b.y+b.height-2)) failures.push('marker body inside node');
        if(labels.some(rect=> { const b=rect.getBBox();return p.x>b.x&&p.x<b.x+b.width&&p.y>b.y&&p.y<b.y+b.height; })) failures.push('marker body covered by label');
      }
    }
    labels.forEach((rect,i) => {
      const box = rect.getBBox();
      if (nodes.some((node) => intersects(box,node))) failures.push('label overlaps node');
      if (labels.slice(i+1).some((other) => intersects(box,other.getBBox()))) failures.push('labels overlap');
      const ownPath = rect.parentElement.querySelector(':scope > path');
      if (rect.parentElement.matches('g.edge') && ownPath && distanceToPath(box,ownPath)>24) failures.push('edge label too far from own path');
      for (const text of rect.parentElement.querySelectorAll('text')) {
        const b=text.getBBox(); if (b.x<box.x-1||b.x+b.width>box.x+box.width+1||b.y<box.y-1||b.y+b.height>box.y+box.height+1) failures.push('label exceeds background');
      }
    });
    for (const text of svg.querySelectorAll('text:not(.more)')) {
      const pixels = parseFloat(getComputedStyle(text).fontSize) * svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      if (pixels < 11.5) failures.push(`unreadable text:${host.tagName}:${text.textContent}:${pixels}:${svg.getBoundingClientRect().width}:${svg.viewBox.baseVal.width}`);
      const b=text.getBBox(), v=svg.viewBox.baseVal;
      if(b.x<v.x-1||b.y<v.y-1||b.x+b.width>v.x+v.width+1||b.y+b.height>v.y+v.height+1) failures.push('text clipped by viewBox');
    }
    for (const group of svg.querySelectorAll('g.node,g.st,g.actor')) {
      const box=group.firstElementChild.getBBox();
      for (const text of group.querySelectorAll('text:not(.more):not(.sub)')) { const b=text.getBBox();if (b.x<box.x-1||b.x+b.width>box.x+box.width+1) failures.push('node text exceeds shape'); }
    }
  }
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth+1) failures.push('body overflow');
  return failures;
}
try {
  for (const width of [1280,390]) {
    const page = await browser.newPage({ viewport:{ width,height:844 } });
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`file://${output}`); await page.waitForFunction(()=>document.documentElement.dataset.nwReady==='1');
    const hiddenLayout = await page.locator('#hidden-diagrams > doc-flow').evaluate((host) => ({
      clientRects:host.getClientRects().length,
      zeroBoxes:[...host.shadowRoot.querySelectorAll('g.edge text')].every((text) => {
        const box=text.getBBox(); return box.x===0 && box.y===0 && box.width===0 && box.height===0;
      }),
    }));
    assert.deepEqual(hiddenLayout,{ clientRects:0,zeroBoxes:true },'hidden fixture starts without layout geometry');
    await page.evaluate(() => { document.querySelector('#hidden-diagrams').style.display = 'block'; });
    await page.waitForTimeout(100);
    for (const theme of ['light','dark','light']) {
      await page.evaluate((theme)=>document.documentElement.dataset.theme=theme,theme);
      await page.waitForTimeout(100);
      assert.deepEqual(await page.evaluate(inspect),[],`${width} ${theme}`);
      const colors=await page.evaluate(()=> ({
        node:getComputedStyle(document.querySelector('doc-flow').shadowRoot.querySelector('g.node text')).fill,
        actor:getComputedStyle(document.querySelector('doc-seq').shadowRoot.querySelector('g.actor text')).fill,
        actorBackground:getComputedStyle(document.querySelector('doc-seq').shadowRoot.querySelector('g.actor rect')).fill,
      }));
      assert.equal(colors.node,theme==='dark'?'rgb(241, 242, 243)':'rgb(34, 37, 46)');
      assert.equal(colors.actor,theme==='dark'?'rgb(32, 33, 38)':'rgb(255, 255, 255)');
      assert.equal(colors.actorBackground,colors.node);
      const tones=await page.evaluate(()=>[...document.querySelectorAll('doc-flow')[2].shadowRoot.querySelectorAll('g.node')].map(g=>({text:getComputedStyle(g.querySelector('text')).fill,fill:getComputedStyle(g.firstElementChild).fill})));
      const luminance=(color)=> {const rgb=color.match(/[\d.]+/g).slice(0,3).map(n=>Number(n)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;};
      for(const tone of tones){const a=luminance(tone.text),b=luminance(tone.fill);assert.ok((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)>=4.5,JSON.stringify(tone));}
      await page.screenshot({path:resolve(work,`${width}-${theme}.png`),fullPage:true});
    }
    assert.equal(await page.locator('doc-flow').first().locator('g.edge path[marker-start]').count(),1);
    const sequenceText = await page.locator('doc-seq').locator('svg').textContent();
    assert.match(sequenceText, /\u8ba2\u5355\u63a5\u5165\u7f51\u5173\u670d\u52a1/);
    assert.match(sequenceText, /\u7b49\u5f85\u5f02\u6b65\u56de\u6267/);
    assert.equal(await page.locator('doc-machine').nth(1).locator('g.tr path[marker-end]').count(),1,'explicit TB machine renders its marker in a separate shadow root');
    const secondFlow = page.locator('doc-flow').nth(1);
    const visibleSecondFlow = await secondFlow.screenshot();
    await page.locator('doc-flow').first().evaluate((host) => { host.hidden = true; });
    assert.deepEqual(await secondFlow.screenshot(), visibleSecondFlow, 'hiding the first figure does not remove markers from another shadow root');
    await page.locator('doc-flow').first().evaluate((host) => { host.hidden = false; });
    if (width === 1280) {
      const beforeLabels = await page.evaluate(() => [...document.querySelectorAll('doc-flow')[3].shadowRoot.querySelectorAll('g.edge rect.lbl')]
        .map((rect) => ['x','y','width','height'].map((attr) => rect.getAttribute(attr))));
      const beforeResize = await page.evaluate(() => {
        const root = document.querySelector('doc-machine').shadowRoot;
        const path = root.querySelector('g.tr path[marker-end]');
        return { d:path.getAttribute('d'), marker:path.getAttribute('marker-end'), defs:root.querySelectorAll('marker').length };
      });
      await page.setViewportSize({ width:390, height:844 }); await page.waitForTimeout(100);
      const afterResize = await page.evaluate(() => {
        const root = document.querySelector('doc-machine').shadowRoot;
        const path = root.querySelector('g.tr path[marker-end]');
        return { d:path.getAttribute('d'), marker:path.getAttribute('marker-end'), defs:root.querySelectorAll('marker').length };
      });
      assert.deepEqual(afterResize,beforeResize,'native-size mobile resize preserves the fixed direction and marker definitions');
      await page.setViewportSize({ width,height:844 });
      await page.waitForTimeout(100);
      const afterLabels = await page.evaluate(() => [...document.querySelectorAll('doc-flow')[3].shadowRoot.querySelectorAll('g.edge rect.lbl')]
        .map((rect) => ['x','y','width','height'].map((attr) => rect.getAttribute(attr))));
      assert.deepEqual(afterLabels,beforeLabels,'repeated label correction is idempotent across resize');

      const hiddenPanel = page.locator('#hidden-diagrams');
      const hiddenMachine = page.locator('#hidden-diagrams > doc-machine');
      const beforeHiddenMutation = await hiddenMachine.locator('g.tr rect.lbl').evaluateAll((labels) => labels
        .map((rect) => ['x','y','width','height'].map((attr) => rect.getAttribute(attr))));
      await hiddenPanel.evaluate((panel) => { panel.style.display = 'none'; });
      await hiddenMachine.locator('g.st[data-state="done"]').evaluate((node) => node.dispatchEvent(new MouseEvent('click',{ bubbles:true })));
      await page.waitForTimeout(50);
      assert.equal(await hiddenMachine.evaluate((host) => host.getClientRects().length),0,'hidden state rebuild has no layout geometry');
      const afterHiddenMutation = await hiddenMachine.locator('g.tr rect.lbl').evaluateAll((labels) => labels
        .map((rect) => ['x','y','width','height'].map((attr) => rect.getAttribute(attr))));
      assert.deepEqual(afterHiddenMutation,beforeHiddenMutation,'MutationObserver skips hidden label correction');
      await hiddenPanel.evaluate((panel) => { panel.style.display = 'block'; });
      await page.waitForTimeout(100);
      assert.deepEqual(await page.evaluate(inspect),[],'hidden state rebuild corrects labels after reveal');
      const beforeHiddenResize = await hiddenPanel.locator('g.edge rect.lbl, g.tr rect.lbl').evaluateAll((labels) => labels
        .map((rect) => ['x','y','width','height'].map((attr) => rect.getAttribute(attr))));
      await page.setViewportSize({ width:390, height:844 }); await page.waitForTimeout(100);
      await page.setViewportSize({ width,height:844 }); await page.waitForTimeout(100);
      const afterHiddenResize = await hiddenPanel.locator('g.edge rect.lbl, g.tr rect.lbl').evaluateAll((labels) => labels
        .map((rect) => ['x','y','width','height'].map((attr) => rect.getAttribute(attr))));
      assert.deepEqual(afterHiddenResize,beforeHiddenResize,'revealed hidden labels stay idempotent across resize');
    }
    const detailNode = page.locator('doc-flow').first().locator('g.node').first();
    assert.equal(await detailNode.getAttribute('tabindex'),'0','detailed flow node remains keyboard interactive');
    await detailNode.click();
    assert.equal(await page.locator('body > dialog, body > .nw-pop').count(),0,'diagram detail never mounts on document.body');
    assert.equal(await page.locator('doc-flow').first().locator('dialog').count(),1,'diagram detail stays inside its shadow root');
    await page.locator('doc-flow').first().locator('dialog button').click();
    await detailNode.dispatchEvent('keydown',{ key:'Enter' });
    assert.equal(await page.locator('doc-flow').first().locator('dialog').count(),1,'detailed flow node keeps Enter-key interaction');
    await page.locator('doc-flow').first().locator('dialog button').click();
    const emptyNode = page.locator('doc-flow').nth(1).locator('g.node').first();
    assert.equal(await emptyNode.getAttribute('tabindex'),null,'flow node without detail is not keyboard interactive');
    await emptyNode.click();
    await emptyNode.dispatchEvent('keydown',{ key:'Enter' });
    assert.equal(await page.locator('doc-flow').nth(1).locator('dialog').count(),0,'flow node without detail does not open an empty dialog');
    await page.locator('main > doc-machine').first().locator('g.st[data-state="done"]').click();
    assert.equal(await page.evaluate(()=>document.querySelector('doc-machine').shadowRoot.querySelector('doc-machine').dataset.state),'done');
    assert.equal(await page.locator('#outside').textContent(),'unchanged'); assert.equal(await page.locator('#outside').isVisible(),true);
    assert.equal(errors.length,0,errors.join('\n'));
    await page.evaluate(()=> { const host=document.querySelector('doc-flow'), svg=host.shadowRoot.querySelector('svg'), path=svg.querySelector('g.edge path'), node=svg.querySelector('g.node').firstElementChild.getBBox();path.setAttribute('d',`M0,0 L${node.x+node.width/2},${node.y+node.height/2}`); });
    assert.ok((await page.evaluate(inspect)).includes('arrow endpoint inside node'),'gate rejects center-covered arrows');
    await page.evaluate(()=>document.querySelector('doc-flow').shadowRoot.querySelector('svg text').style.fontSize='6px');
    assert.ok((await page.evaluate(inspect)).some(value=>value.startsWith('unreadable text')),'gate rejects shrunken text');
    await page.evaluate(()=> { const svg=document.querySelector('doc-flow').shadowRoot.querySelector('svg'), labels=svg.querySelectorAll('g.edge rect.lbl');for(const attr of ['x','y','width','height']) labels[1].setAttribute(attr,labels[0].getAttribute(attr)); });
    assert.ok((await page.evaluate(inspect)).includes('labels overlap'),'gate rejects overlapping reverse labels');
    await page.evaluate(()=> { const group=document.querySelectorAll('doc-flow')[3].shadowRoot.querySelector('g.edge');for(const element of group.querySelectorAll(':scope > rect.lbl, :scope > text')) element.setAttribute('x',Number(element.getAttribute('x'))+100); });
    assert.ok((await page.evaluate(inspect)).includes('edge label too far from own path'),'gate rejects a label displaced from its own path');
    await page.close();
  }
  console.log(`Diagram semantic and reject gates passed. Screenshots: ${work}`);
} finally { await browser.close(); }
