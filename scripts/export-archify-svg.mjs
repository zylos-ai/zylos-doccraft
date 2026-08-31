#!/usr/bin/env node
// Export a dual-theme, self-contained SVG from an archify output HTML by driving
// the page's own export pipeline (which inlines all class styles and resolves both
// theme variable sets) in headless Chromium.
//
// Usage: node export-archify-svg.mjs <abs-path-to-archify-output.html> <abs-out.svg>
//
// Requires playwright-core with a Chromium install. Resolution order: local
// node_modules, the zylos browser skill's copy, then a require() lookup.

import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);

function resolvePlaywright() {
  const candidates = [
    path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'node_modules', 'playwright-core'),
    path.join(os.homedir(), 'zylos', '.claude', 'skills', 'browser', 'node_modules', 'playwright-core'),
    'playwright-core',
  ];
  for (const c of candidates) {
    try { return require(c); } catch { /* try next */ }
  }
  throw new Error('playwright-core not found (looked in doccraft node_modules, browser skill, global require)');
}

const [htmlPath, outPath] = process.argv.slice(2);
if (!htmlPath || !outPath) {
  console.error('Usage: node export-archify-svg.mjs <archify-output.html> <out.svg>');
  process.exit(1);
}

const { chromium } = resolvePlaywright();
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(htmlPath), { waitUntil: 'load' });
  await page.waitForSelector('.diagram-container svg');
  const download = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    // The menu item is hidden until the menu opens; a DOM click still reaches the
    // delegated handler, which runs serializeSvg(1, { autoTheme: true }).
    page.evaluate(() => document.querySelector('#export-menu [data-format="svg"]').click()),
  ]).then((r) => r[0]);
  await download.saveAs(path.resolve(outPath));
  console.log('saved:', outPath);
} finally {
  await browser.close();
}
