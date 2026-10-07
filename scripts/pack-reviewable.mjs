#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const args = process.argv.slice(2);
const valueAfter = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : '';
};
const profile = valueAfter('--profile');
const packArgs = args.filter((arg, i) => arg !== '--profile' && args[i - 1] !== '--profile');
const input = packArgs.find((arg, i) => !arg.startsWith('-') && !['-o', '--out', '--root'].includes(packArgs[i - 1]));
const profiles = new Set(['implementation-plan', 'execution-plan', 'code-review-guide']);

if (!input || !profile) {
  console.error('usage: node scripts/pack-reviewable.mjs <page.html> --profile <implementation-plan|execution-plan|code-review-guide> [packer options]');
  process.exit(2);
}
if (!profiles.has(profile)) {
  console.error(`doccraft: unknown reviewable profile "${profile}"`);
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
const attrs = (source) => {
  const out = {};
  source.replace(/([\w:.-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g, (match, key, a, b, c) => {
    out[key.toLowerCase()] = a ?? b ?? c ?? '';
    return match;
  });
  return out;
};
const metaContent = (name) => {
  for (const match of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const meta = attrs(match[1]);
    if (meta.name === name) return meta.content;
  }
  return undefined;
};
const strip = (source) => source.replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const declared = metaContent('doccraft-profile');
if (declared !== profile) fail(`profile metadata is ${declared ? `"${declared}"` : 'missing'}; expected "${profile}"`);

const plans = [...html.matchAll(/<doc-plan\b/g)];
if (plans.length !== 1) fail(`expected exactly one <doc-plan>; found ${plans.length}`);

const remoteChecks = [
  [/<(?:script|img|video|audio|source|iframe|embed|doc-shot)\b[^>]*\bsrc\s*=\s*["']\s*https?:\/\//gi, 'remote src dependency'],
  [/<link\b[^>]*\bhref\s*=\s*["']\s*https?:\/\//gi, 'remote link dependency'],
  [/<object\b[^>]*\bdata\s*=\s*["']\s*https?:\/\//gi, 'remote object dependency'],
  [/@import\s+(?:url\()?\s*["']?https?:\/\//gi, 'remote CSS import'],
  [/url\(\s*["']?https?:\/\//gi, 'remote CSS asset'],
];
for (const [pattern, label] of remoteChecks) if (pattern.test(html)) fail(`${label} is forbidden; reviewable documents must be self-contained`);

const sensitive = [
  [/\b(?:10|127)\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\b192\.168\.\d{1,3}\.\d{1,3}\b|\b100\.64\.\d{1,3}\.\d{1,3}\b/i, 'internal IP address'],
  [/\b(?:ou_|oc_|cli_)[A-Za-z0-9_-]{8,}\b/, 'platform identifier'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY|\b(?:sk-ant-|sk-[A-Za-z0-9]{32,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|xox[abeprs]-[A-Za-z0-9-]{10,})/, 'credential-like content'],
  [/(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)["']?\s*[:=]\s*["'][^"'\s$<{]{12,}["']/i, 'credential assignment'],
];
for (const [pattern, label] of sensitive) if (pattern.test(html)) fail(`${label} found in authoring source`);

const treeSource = html.replace(/<!--([\s\S]*?)-->/g, '').replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, '');
const root = { children: [], depth: 0 };
const stack = [root];
let inPlan = 0;
for (const token of treeSource.matchAll(/<(\/?)doc-(plan|claim)\b([^>]*)>|<(doc-(?:code|flow|seq|schema|tree|calls|machine|mock|shot|quote|ask|draft))\b/gi)) {
  const closing = token[1] === '/';
  if (token[2] === 'plan') {
    inPlan += closing ? -1 : 1;
    continue;
  }
  if (token[2] === 'claim') {
    if (closing) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (!inPlan) continue;
    const node = { attrs: attrs(token[3] || ''), children: [], exhibits: [], depth: stack.at(-1).depth + 1 };
    stack.at(-1).children.push(node);
    stack.push(node);
    continue;
  }
  if (token[4] && stack.length > 1) stack.at(-1).exhibits.push(token[4].toLowerCase());
}

const all = [];
const walk = (node) => {
  all.push(node);
  node.children.forEach(walk);
};
root.children.forEach(walk);
if (!root.children.length) fail('the plan has no top-level claims');
if (root.children.filter((node) => !node.attrs.aux).length > 5) fail('the plan has more than five top-level behavior claims');
if (all.some((node) => node.depth > 3)) fail('the claim tree exceeds three levels');
if (!root.children.some((node) => node.attrs.aux === 'scope')) fail('the plan needs a top-level aux="scope" claim');
for (const node of all) {
  if (!node.exhibits.length && !node.children.length && node.attrs.aux !== 'scope') fail(`a level-${node.depth} claim has no exhibit or child claim`);
  if (node.exhibits.length > 1) fail(`a level-${node.depth} claim has ${node.exhibits.length} primary exhibits; split the claim`);
}

const has = (tag) => new RegExp(`<${tag}\\b`, 'i').test(html);
const tagged = (tag, predicate) => [...treeSource.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'gi'))]
  .filter((match) => predicate(attrs(match[1])));
const marked = (name, value) => tagged('[a-z][\\w:-]*', (attributes) => name in attributes && (value === undefined || attributes[name] === value));
const text = strip(html).toLowerCase();
if (!/(reject|error|fail|cancel|rollback|refus|invalid|denied|stop)/.test(text)) fail('no reject, error, cancellation, rollback, refusal, invalid, denied, or stop path is visible');

if (profile === 'implementation-plan') {
  if (!has('doc-calls')) fail('implementation-plan requires a <doc-calls> change-surface exhibit');
  if (!has('doc-code') && !has('doc-schema')) fail('implementation-plan requires a <doc-code> or <doc-schema> location/contract exhibit');
  if (!has('doc-mock') && !has('doc-machine')) fail('implementation-plan requires a <doc-mock> or <doc-machine> behavior exhibit');
  const doubtfulPremises = marked('data-review-premise', 'doubtful').length;
  const authoritativeQuotes = tagged('doc-quote', (attributes) => 'data-review-authoritative-quote' in attributes).length;
  if (authoritativeQuotes < doubtfulPremises) fail('each data-review-premise="doubtful" marker requires a <doc-quote data-review-authoritative-quote>');
  const contractAlternatives = marked('data-review-alternative', 'contract').length;
  const preferenceConditions = marked('data-review-preferable-when').length;
  if (preferenceConditions < contractAlternatives) fail('each data-review-alternative="contract" marker requires a data-review-preferable-when field');
}
if (profile === 'execution-plan') {
  if (!has('doc-seq')) fail('execution-plan requires a <doc-seq> ordering exhibit');
  if (!has('doc-machine')) fail('execution-plan requires a <doc-machine> stop/recovery exhibit');
  if (!root.children.some((node) => ['rollback', 'containment'].includes(node.attrs.aux))) fail('execution-plan needs a top-level aux="rollback" or aux="containment" claim');
}
if (profile === 'code-review-guide') {
  for (const name of ['doccraft-base', 'doccraft-head']) {
    const revision = metaContent(name)?.trim();
    if (!revision || /^(unknown|unverified)$/i.test(revision)) fail(`code-review-guide requires verified <meta name="${name}" content="revision">`);
  }
  if (!has('doc-calls')) fail('code-review-guide requires a <doc-calls> behavioral change exhibit');
  if (!has('doc-code')) fail('code-review-guide requires a <doc-code> high-risk-lines exhibit');
  if (!/<table\b[^>]*data-review-verification\b/i.test(html)) fail('code-review-guide requires a verification table with data-review-verification');
}

if (errors.length) {
  for (const error of errors) console.error(`doccraft: ${error}`);
  console.error(`doccraft: ${errors.length} validation error(s); upstream packer not run`);
  process.exit(1);
}

const result = spawnSync(process.execPath, [resolve(repo, 'vendor/html-plan/runtime/pack.mjs'), ...packArgs], {
  stdio: 'inherit',
  env: process.env,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
