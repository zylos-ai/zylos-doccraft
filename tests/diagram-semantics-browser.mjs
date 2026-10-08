import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
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
const diagram = (tag, lines, attrs='') => `<${tag} ${attrs}><script type="text/plain">${lines.join('\n')}</script></${tag}>`;
writeFileSync(source, `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>Diagram semantic regression</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root { --surface:#fff;--ink:#22252e;--ink2:#5c6270;--accent:#0e7c72;--accent-soft:#e0f0ee;--hairline:#dfe3e1; }
:root[data-theme=dark] { --surface:#202126;--ink:#f1f2f3;--ink2:#b5bbc4;--accent:#4ec2b2;--accent-soft:#23423f;--hairline:#454851; }
body { margin:0;padding:20px; } main { max-width:880px;margin:auto; }
</style><link rel="stylesheet" href="runtime/diagrams.css"><script src="runtime/diagrams.js" defer></script></head><body><main><div id="outside" data-state="done" data-field="status">unchanged</div>
${diagram('doc-flow',['dir LR',`a = ${chinese} [box accent]`,`  ${chinese}`,`b = ${chinese} [pill green]`,`a <-> b : ${chinese}`,'b -> a : reverse'])}
${diagram('doc-flow',['a = A [diamond]','b = B [hex]','a -> b : proceed'])}
${diagram('doc-flow',['dir LR','a = Blue [blue]','b = Purple [purple]','c = Ink [ink]','a -> b : next','b -> c : next'])}
${diagram('doc-machine',['machine order initial draft',`state draft "${chinese}" shows #outside set status=changed`,`state done "${chinese}" final`, `draft -submit-> done : ${chinese}`,'done -undo-> draft : reverse'],'dir="LR"')}
${diagram('doc-machine',['machine vertical initial one','state one "One"','state two "Two" final','one -next-> two : vertical'],'dir="TB"')}
${diagram('doc-seq',[`participants: a "${chinese}" b "${chinese}"`,'a -> a : self call','a -> b : message','b --> a : reply',`note over a,b: ${chinese}`])}
</main></body></html>`);
const pack = spawnSync(process.execPath, ['scripts/pack-diagrams.mjs', source, '--root', process.cwd(), '-o', output], { encoding:'utf8' });
assert.equal(pack.status, 0, pack.stdout + pack.stderr);
const browser = await chromium.launch({ headless:true, executablePath });
function inspect() {
  const failures = [];
  const intersects = (a,b) => a.x < b.x+b.width-1 && a.x+a.width > b.x+1 && a.y < b.y+b.height-1 && a.y+a.height > b.y+1;
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
    assert.equal(await page.locator('doc-machine').nth(1).locator('g.tr path[marker-end]').count(),1,'explicit TB machine renders its marker in a separate shadow root');
    const secondFlow = page.locator('doc-flow').nth(1);
    const visibleSecondFlow = await secondFlow.screenshot();
    await page.locator('doc-flow').first().evaluate((host) => { host.hidden = true; });
    assert.deepEqual(await secondFlow.screenshot(), visibleSecondFlow, 'hiding the first figure does not remove markers from another shadow root');
    await page.locator('doc-flow').first().evaluate((host) => { host.hidden = false; });
    if (width === 1280) {
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
    }
    await page.locator('doc-flow').first().locator('g.node').first().click();
    assert.equal(await page.locator('body > dialog, body > .nw-pop').count(),0,'diagram detail never mounts on document.body');
    assert.equal(await page.locator('doc-flow').first().locator('dialog').count(),1,'diagram detail stays inside its shadow root');
    await page.locator('doc-flow').first().locator('dialog button').click();
    await page.locator('doc-machine').locator('g.st[data-state="done"]').click();
    assert.equal(await page.evaluate(()=>document.querySelector('doc-machine').shadowRoot.querySelector('doc-machine').dataset.state),'done');
    assert.equal(await page.locator('#outside').textContent(),'unchanged'); assert.equal(await page.locator('#outside').isVisible(),true);
    assert.equal(errors.length,0,errors.join('\n'));
    await page.evaluate(()=> { const host=document.querySelector('doc-flow'), svg=host.shadowRoot.querySelector('svg'), path=svg.querySelector('g.edge path'), node=svg.querySelector('g.node').firstElementChild.getBBox();path.setAttribute('d',`M0,0 L${node.x+node.width/2},${node.y+node.height/2}`); });
    assert.ok((await page.evaluate(inspect)).includes('arrow endpoint inside node'),'gate rejects center-covered arrows');
    await page.evaluate(()=>document.querySelector('doc-flow').shadowRoot.querySelector('svg text').style.fontSize='6px');
    assert.ok((await page.evaluate(inspect)).some(value=>value.startsWith('unreadable text')),'gate rejects shrunken text');
    await page.evaluate(()=> { const svg=document.querySelector('doc-flow').shadowRoot.querySelector('svg'), labels=svg.querySelectorAll('g.edge rect.lbl');for(const attr of ['x','y','width','height']) labels[1].setAttribute(attr,labels[0].getAttribute(attr)); });
    assert.ok((await page.evaluate(inspect)).includes('labels overlap'),'gate rejects overlapping reverse labels');
    await page.close();
  }
  console.log(`Diagram semantic and reject gates passed. Screenshots: ${work}`);
} finally { await browser.close(); }
