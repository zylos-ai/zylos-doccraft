#!/usr/bin/env node
// Ensure the pinned archify release is present at vendor/archify/.
// Used as both post-install and post-upgrade hook (cwd = skill dir).
//
// Behavior: if vendor/archify already matches the locked version, do nothing.
// Otherwise download the pinned release asset, verify its sha256 against
// vendor/archify.lock.json (the hash — not the tag — is what pins the reviewed
// content), and extract it. Any failure is a soft failure: doccraft works
// without archify (diagram routing falls back to HTML/CSS + hand SVG), and the
// hook retries on the next install/upgrade.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const skillDir = process.cwd();
const vendorDir = path.join(skillDir, 'vendor');
const targetDir = path.join(vendorDir, 'archify');
const lockPath = path.join(vendorDir, 'archify.lock.json');

function log(msg) { console.log(`[doccraft:archify] ${msg}`); }
function fail(msg) {
  log(`WARN: ${msg}`);
  log('doccraft remains fully usable; archify-based diagrams fall back to HTML/CSS or hand SVG until the next install/upgrade retries this download.');
  process.exit(0); // soft failure by design
}

let lock;
try {
  lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
} catch (e) {
  fail(`cannot read ${lockPath}: ${e.message}`);
}
const wantVersion = lock.tag.replace(/^v/, '');

// Already at the locked version?
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
  if (pkg.version === wantVersion) {
    log(`archify ${wantVersion} already present.`);
    process.exit(0);
  }
  log(`found archify ${pkg.version}, lock wants ${wantVersion}; updating.`);
} catch { /* absent or unreadable -> install */ }

const url = `${lock.upstream}/releases/download/${lock.tag}/${lock.asset}`;
const tmpZip = path.join(vendorDir, `.${lock.asset}.download`);
const tmpExtract = path.join(vendorDir, '.archify-extract');

// Download (curl honors https_proxy/HTTPS_PROXY from the environment).
log(`downloading ${url}`);
try {
  execFileSync('curl', ['-fsSL', '--retry', '2', '-o', tmpZip, url], { stdio: ['ignore', 'inherit', 'inherit'] });
} catch (e) {
  fail(`download failed: ${e.message}`);
}

// Verify content hash — this, not the tag, is the review anchor.
const actual = createHash('sha256').update(fs.readFileSync(tmpZip)).digest('hex');
if (actual !== lock.sha256) {
  fs.rmSync(tmpZip, { force: true });
  fail(`sha256 mismatch: expected ${lock.sha256}, got ${actual}. Refusing to install unreviewed content.`);
}
log('sha256 verified against lock.');

// Extract (unzip if available, python3 zipfile as fallback).
fs.rmSync(tmpExtract, { recursive: true, force: true });
fs.mkdirSync(tmpExtract, { recursive: true });
try {
  try {
    execFileSync('unzip', ['-oq', tmpZip, '-d', tmpExtract], { stdio: 'inherit' });
  } catch {
    execFileSync('python3', ['-m', 'zipfile', '-e', tmpZip, tmpExtract], { stdio: 'inherit' });
  }
} catch (e) {
  fs.rmSync(tmpZip, { force: true });
  fs.rmSync(tmpExtract, { recursive: true, force: true });
  fail(`extraction failed (need unzip or python3): ${e.message}`);
}
fs.rmSync(tmpZip, { force: true });

const extractedRoot = path.join(tmpExtract, 'archify');
if (!fs.existsSync(path.join(extractedRoot, 'bin', 'archify.mjs'))) {
  fs.rmSync(tmpExtract, { recursive: true, force: true });
  fail('archive layout unexpected: archify/bin/archify.mjs not found after extraction.');
}

// Swap in atomically enough for our purposes.
fs.rmSync(targetDir, { recursive: true, force: true });
fs.renameSync(extractedRoot, targetDir);
fs.rmSync(tmpExtract, { recursive: true, force: true });

// Read back the installed version as the success check.
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
  if (pkg.version !== wantVersion) fail(`installed version ${pkg.version} does not match lock ${wantVersion}.`);
  log(`archify ${pkg.version} installed at vendor/archify/.`);
} catch (e) {
  fail(`post-install read-back failed: ${e.message}`);
}
