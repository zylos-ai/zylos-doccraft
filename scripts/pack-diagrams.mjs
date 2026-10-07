#!/usr/bin/env node

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const args = process.argv.slice(2);
const input = args.find((arg, index) => !arg.startsWith('-') && !['-o', '--out', '--root'].includes(args[index - 1]));

if (!input) {
  console.error('usage: node scripts/pack-diagrams.mjs <page.html> [packer options]');
  process.exit(2);
}

const inputPath = resolve(input);
if (!existsSync(inputPath)) {
  console.error(`doccraft: input not found: ${input}`);
  process.exit(2);
}

const html = readFileSync(inputPath, 'utf8');
const errors = [];
const fail = (message) => errors.push(message);
const diagramTags = ['doc-flow', 'doc-seq', 'doc-machine'];
let diagramCount = 0;

const remoteChecks = [
  [/<(?:script|img|video|audio|source|iframe|embed|doc-shot)\b[^>]*\bsrc\s*=\s*["']\s*(?:https?:)?\/\//gi, 'remote src dependency'],
  [/<link\b[^>]*\bhref\s*=\s*["']\s*(?:https?:)?\/\//gi, 'remote link dependency'],
  [/<object\b[^>]*\bdata\s*=\s*["']\s*(?:https?:)?\/\//gi, 'remote object dependency'],
  [/@import\s+(?:url\(\s*)?["']?\s*(?:https?:)?\/\//gi, 'remote CSS import'],
  [/url\(\s*["']?\s*(?:https?:)?\/\//gi, 'remote CSS asset'],
];
for (const [pattern, label] of remoteChecks) if (pattern.test(html)) fail(`${label} is forbidden; diagram pages must be self-contained`);

for (const tag of diagramTags) {
  const blocks = [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))];
  diagramCount += blocks.length;
  for (const [, body] of blocks) {
    const source = body.match(/<script\b[^>]*type\s*=\s*["']text\/plain["'][^>]*>([\s\S]*?)<\/script>/i)?.[1]?.trim();
    if (!source) fail(`<${tag}> requires a non-empty <script type="text/plain"> source block`);
  }
}

if (!diagramCount) fail('expected at least one <doc-flow>, <doc-seq>, or <doc-machine> diagram');
if (!/<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(html)) fail('diagram page requires a non-empty <html lang="..."> attribute');
if (!/<meta\b[^>]*\bname\s*=\s*["']viewport["']/i.test(html)) fail('diagram page requires a viewport meta tag');

if (errors.length) {
  for (const error of errors) console.error(`doccraft: ${error}`);
  console.error(`doccraft: ${errors.length} validation error(s); upstream packer not run`);
  process.exit(1);
}

const lintOnly = args.includes('--lint-only');
const valueAfter = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : '';
};
const outputPath = resolve(valueAfter('-o') || valueAfter('--out') || inputPath.replace(/(\.src)?\.html?$/, '') + (inputPath.includes('.src.') ? '.html' : '.packed.html'));
const temporary = mkdtempSync(resolve(tmpdir(), 'doccraft-diagram-pack-'));
const lintSource = resolve(temporary, 'diagram-source.html');
writeFileSync(lintSource, html
  .replace(/(?:\.\.\/)*runtime\/diagrams\.css/g, 'htmlplan.css')
  .replace(/(?:\.\.\/)*runtime\/diagrams\.js/g, 'htmlplan.js'));
const upstreamArgs = args.filter((arg, index) => {
  if (arg === input) return false;
  if (['-o', '--out'].includes(arg)) return false;
  if (index > 0 && ['-o', '--out'].includes(args[index - 1])) return false;
  return true;
});
upstreamArgs.push('--root', dirname(inputPath));
if (!lintOnly) upstreamArgs.push('--out', outputPath);
const adapterCss = readFileSync(resolve(repo, 'runtime/diagrams.css'), 'utf8');
const adapterJs = readFileSync(resolve(repo, 'runtime/diagrams.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const replaceReviewRuntime = (path) => {
  const packed = readFileSync(path, 'utf8')
    .replace(/<style\s+data-htmlplan>[\s\S]*?<\/style>/i, `<style data-doccraft-diagrams>\n${adapterCss}\n</style>`)
    .replace(/<script\s+data-htmlplan>[\s\S]*?<\/script>/i, `<script data-doccraft-diagrams>\n${adapterJs}\n</script>`)
    .replace(/data-htmlplan-packed/g, 'data-doccraft-diagrams-packed');
  writeFileSync(path, packed);
};

let exitStatus = null;
try {
  const result = spawnSync(process.execPath, [resolve(repo, 'vendor/html-plan/runtime/pack.mjs'), lintSource, ...upstreamArgs], {
    encoding: 'utf8',
    env: process.env,
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.error) throw result.error;
  if (result.status !== 0 || lintOnly) {
    exitStatus = result.status ?? 1;
  } else {
    replaceReviewRuntime(outputPath);
    if (args.includes('--artifact')) {
      const artifactPath = outputPath.replace(/(\.packed)?\.html?$/, '.artifact.html');
      if (existsSync(artifactPath)) replaceReviewRuntime(artifactPath);
    }
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
if (exitStatus !== null) process.exit(exitStatus);
