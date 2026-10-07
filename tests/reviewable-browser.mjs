import { createRequire } from 'node:module';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(resolve(tmpdir(), 'doccraft-browser-'));
const profiles = ['implementation-plan', 'execution-plan', 'code-review-guide'];

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

const browser = await chromium.launch({ headless: true, executablePath: chromiumExecutable(chromium) });
try {
  for (const { profile, output } of outputs) {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
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
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      if (overflow) throw new Error(`${profile} has horizontal overflow at ${viewport.width}px`);
      if (remoteRequests.length) throw new Error(`${profile} loaded remote resources: ${remoteRequests.join(', ')}`);
      await page.close();
    }
  }
  console.log('all reviewable profiles passed browser checks at 1280x800 and 390x844');
} finally {
  await browser.close();
}
