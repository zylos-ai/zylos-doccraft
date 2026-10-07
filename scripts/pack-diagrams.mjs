#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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
  [/<(?:script|img|video|audio|source|iframe|embed|doc-shot)\b[^>]*\bsrc\s*=\s*["']\s*https?:\/\//gi, 'remote src dependency'],
  [/<link\b[^>]*\bhref\s*=\s*["']\s*https?:\/\//gi, 'remote link dependency'],
  [/<object\b[^>]*\bdata\s*=\s*["']\s*https?:\/\//gi, 'remote object dependency'],
  [/@import\s+(?:url\()?\s*["']?https?:\/\//gi, 'remote CSS import'],
  [/url\(\s*["']?https?:\/\//gi, 'remote CSS asset'],
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

const result = spawnSync(process.execPath, [resolve(repo, 'vendor/html-plan/runtime/pack.mjs'), ...args], {
  stdio: 'inherit',
  env: process.env,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
