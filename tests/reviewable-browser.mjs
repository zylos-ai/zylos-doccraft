import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(resolve(tmpdir(), 'doccraft-browser-'));
const profiles = ['implementation-plan', 'execution-plan', 'code-review-guide'];

function ordinaryTemplateSource() {
  const fixture = readFileSync(resolve(repo, 'examples/diagrams/chinese-diagrams.html'), 'utf8');
  const diagrams = fixture.match(/<doc-(?:flow|seq|machine)\b[\s\S]*?<\/doc-(?:flow|seq|machine)>/gi).join('\n');
  return readFileSync(resolve(repo, 'assets/template.html'), 'utf8')
    .replace('<title><!-- 文档标题 --></title>', '<title>普通文档图表回归</title>')
    .replace('<h1><!-- 文档标题 --></h1>', '<h1>普通文档图表回归</h1>')
    .replace('</head>', '<link rel="stylesheet" href="../runtime/diagrams.css"><script src="../runtime/diagrams.js" defer></script></head>')
    .replace('<footer>', `<h2 id="isolation-heading"><a href=""></a>隔离边界</h2>\n${diagrams}\n<footer>`);
}

function resolvePlaywright() {
  const candidates = [
    resolve(repo, 'node_modules/playwright'),
    resolve(repo, 'node_modules/playwright-core'),
    '/opt/playwright/node_modules/playwright',
    '/opt/playwright/node_modules/playwright-core',
    'playwright',
    'playwright-core',
  ];
  for (const candidate of candidates) {
    try { return require(candidate); } catch { /* try next candidate */ }
  }
  throw new Error(`Playwright is required for browser validation; tried: ${candidates.join(', ')}`);
}

function chromiumExecutable(chromium) {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    chromium.executablePath(),
    '/opt/ms-playwright/chromium-1228/chrome-linux64/chrome',
  ].filter(Boolean);
  const executablePath = candidates.find(existsSync);
  if (!executablePath) throw new Error(`Chromium is required for browser validation; tried: ${candidates.join(', ')}`);
  return executablePath;
}

const { chromium } = resolvePlaywright();
const outputs = profiles.map((profile) => {
  const fixture = resolve(repo, `examples/reviewable/${profile}.html`);
  const output = resolve(work, `${profile}.html`);
  const packed = spawnSync(process.execPath, [resolve(repo, 'scripts/pack-reviewable.mjs'), fixture, '--profile', profile, '--root', repo, '-o', output], { encoding: 'utf8' });
  if (packed.status !== 0) throw new Error(packed.stdout + packed.stderr);
  return { profile, output };
});
const diagramSources = [
  ['ordinary-diagrams', (() => { const source = resolve(work, 'ordinary-diagrams.src.html'); writeFileSync(source, ordinaryTemplateSource()); return source; })()],
  ['wide-sequence-stress', resolve(repo, 'examples/diagrams/wide-sequence-stress.html')],
];
for (const [profile, source] of diagramSources) {
  const output = resolve(work, `${profile}.html`);
  const packed = spawnSync(process.execPath, [resolve(repo, 'scripts/pack-diagrams.mjs'), source, '--root', repo, '-o', output], { encoding: 'utf8' });
  if (packed.status !== 0) throw new Error(packed.stdout + packed.stderr);
  outputs.push({ profile, output });
}

const browser = await chromium.launch({ headless: true, executablePath: chromiumExecutable(chromium) });
try {
  for (const { profile, output } of outputs) {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      for (const colorScheme of ['light', 'dark']) {
        const page = await browser.newPage({ viewport, colorScheme });
        const remoteRequests = [];
        page.on('request', (request) => {
          if (/^https?:/i.test(request.url())) remoteRequests.push(request.url());
        });
        await page.goto(`file://${output}`);
        await page.waitForFunction(() => document.documentElement.dataset.nwReady === '1');
        if (profile === 'implementation-plan') {
          await page.check('input[name="validation"][value="strict"]');
          await page.click('.nw-respond');
          const response = await page.locator('.nw-sheet pre').textContent();
          if (!response.includes('# Re: Reviewable Validator') || !response.includes('`strict`')) throw new Error('structured Markdown response did not include the changed decision');
        }
        if (profile === 'ordinary-diagrams') {
          const diagramState = await page.evaluate(() => ({
            svgs: [...document.querySelectorAll('doc-flow, doc-seq, doc-machine')].reduce((count, host) => count + host.shadowRoot.querySelectorAll('svg').length, 0),
            text: [...document.querySelectorAll('doc-flow, doc-seq, doc-machine')].flatMap((host) => [...host.shadowRoot.querySelectorAll('svg text, .mc-now')].map((node) => node.textContent)).join('\n'),
            accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toUpperCase(),
            maxWidth: getComputedStyle(document.querySelector('main')).maxWidth,
            bodyPaddingLeft: getComputedStyle(document.body).paddingLeft,
            tldrBorderLeft: getComputedStyle(document.querySelector('.tldr')).borderLeftWidth,
            h2FontSize: getComputedStyle(document.querySelector('h2')).fontSize,
            reviewBars: document.querySelectorAll('.nw-bar, .nw-respond, .nw-sheet').length,
            rails: document.querySelectorAll('.rail, .nw-toc').length,
            headingMarkup: document.querySelector('#isolation-heading').innerHTML,
            storageKeys: Object.keys(localStorage).filter((key) => key.startsWith('nw:')),
            bodyPopups: document.querySelectorAll('body > dialog, body > .nw-pop').length,
          }));
          if (diagramState.svgs !== 3) throw new Error(`ordinary template rendered ${diagramState.svgs} SVGs; expected 3`);
          if (!diagramState.text.includes('返回拒绝原因') || !diagramState.text.includes('草稿等待提交')) throw new Error(`Chinese diagram labels are missing after render: ${diagramState.text}`);
          await page.locator('doc-machine').locator('g.st[data-state="checking"]').click();
          if (!(await page.locator('doc-machine').locator('.mc-now').textContent()).includes('系统正在校验')) throw new Error('state explanation missing after legal transition');
          await page.locator('doc-machine').locator('g.st[data-state="accepted"]').click();
          if (!(await page.locator('doc-machine').locator('.mc-now').textContent()).includes('订单已受理')) throw new Error('final state explanation missing after legal transition');
          const expectedAccent = colorScheme === 'dark' ? '#4EC2B2' : '#0E7C72';
          if (diagramState.accent !== expectedAccent) throw new Error(`ordinary template accent changed: ${diagramState.accent}`);
          if (diagramState.maxWidth !== '880px') throw new Error(`ordinary template main max-width changed: ${diagramState.maxWidth}`);
          if (diagramState.bodyPaddingLeft !== '20px') throw new Error(`ordinary template body padding changed: ${diagramState.bodyPaddingLeft}`);
          if (diagramState.tldrBorderLeft !== '4px') throw new Error(`ordinary template TLDR border changed: ${diagramState.tldrBorderLeft}`);
          if (diagramState.h2FontSize !== '22px') throw new Error(`ordinary template h2 changed: ${diagramState.h2FontSize}`);
          if (diagramState.reviewBars) throw new Error(`ordinary template injected ${diagramState.reviewBars} review controls`);
          if (diagramState.rails) throw new Error(`ordinary template injected ${diagramState.rails} TOC rails`);
          if (diagramState.headingMarkup !== '<a href=""></a>隔离边界') throw new Error(`ordinary template heading or empty anchor changed: ${diagramState.headingMarkup}`);
          if (diagramState.storageKeys.length) throw new Error(`ordinary template wrote review storage: ${diagramState.storageKeys.join(', ')}`);
          if (diagramState.bodyPopups) throw new Error(`ordinary template mounted ${diagramState.bodyPopups} popups on document.body`);
        }
        if (profile === 'wide-sequence-stress' && viewport.width === 390) {
          const scroll = await page.evaluate(() => {
            const frame = document.querySelector('doc-seq').shadowRoot.querySelector('.fig-frame');
            return { local: frame.scrollWidth > frame.clientWidth + 1, body: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
          });
          if (!scroll.local || scroll.body) throw new Error(`wide sequence scroll boundary is wrong: ${JSON.stringify(scroll)}`);
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        if (overflow) throw new Error(`${profile} has horizontal overflow at ${viewport.width}px`);
        if (remoteRequests.length) throw new Error(`${profile} loaded remote resources: ${remoteRequests.join(', ')}`);
        await page.close();
      }
    }
  }
  console.log('all reviewable profiles, ordinary diagrams, and wide-sequence stress passed light/dark browser checks at 1280x800 and 390x844');
} finally {
  await browser.close();
}
