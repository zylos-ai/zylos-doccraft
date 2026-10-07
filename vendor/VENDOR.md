# Vendored Third-Party Dependencies

## html-plan

- **Upstream**: `anthropics/claude-plugins-community`, Apache-2.0.
- **Pinned**: commit and per-file SHA-256 values in `vendor/html-plan.lock.json`.
- **Vendored boundary**: the complete upstream `html-plan/skills/html-plan/` subtree plus the repository root `LICENSE`, copied byte-for-byte into `vendor/html-plan/`.
- **Adaptation boundary**: do not edit files below `vendor/html-plan/`. Doccraft-specific core and profiles live under `references/`. If a future change must modify an upstream file, copy it outside the vendor boundary and add a prominent modification notice as required by Apache-2.0 section 4(b).
- **Security review**: 2026-10-07 at `f60f0454df3045f724c43c6346ec80bdcc3472b2`. The browser runtime uses local DOM, local storage, and explicit clipboard writes; it has no fetch/XHR/WebSocket/EventSource/sendBeacon path. The packer limits Git execution to `rev-parse` and `cat-file blob`, disables hooks/fsmonitor/pager/prompts, fences resolved file reads, and rejects common secret paths/content. Doccraft additionally forbids remote media, which upstream permits.
- **Integration and updates**: file mapping, Doccraft-owned differences, integration commits, and the review-first comparison procedure are recorded in `vendor/html-plan.UPSTREAM.md`. `npm run vendor:check` verifies the current copy against the lock without network access.

## archify

- **Upstream**: https://github.com/tt-a1i/archify (MIT)
- **Pinned**: release tag + asset sha256 in `vendor/archify.lock.json`. The **hash is the
  review anchor** — a moved tag cannot change what installs; the hook refuses any asset
  whose sha256 differs from the lock.
- **Install mechanism**: `hooks/ensure-archify.mjs` (post-install / post-upgrade) downloads
  the pinned release asset into `vendor/archify/` inside this skill directory. Nothing is
  written outside the skill dir; uninstalling doccraft removes everything. Download failure
  is soft: doccraft works without archify (diagrams fall back to HTML/CSS + hand SVG) and
  the hook retries on the next install/upgrade.
- **Security review**: 2026-08-31 (Luna), on upstream master `2bfb4713` and re-anchored on
  the v2.16.0 release zip (delta verified cosmetic: log wording + dev-only scripts).
  Findings: no install hooks, no obfuscation, no file access outside its directory, no
  injection-style content in prompt files. Two disclosed behaviors: (1) a once-per-session
  update check against a hard-coded URL — **must be disabled** by setting
  `ARCHIFY_UPDATE_CHECK_DISABLED=1` on every CLI invocation (all doccraft guidance does
  this); (2) an opt-in `brands capture <url>` subcommand that fetches a user-supplied URL
  (SSRF-guarded) — not used by doccraft.

### Upgrade procedure

1. Diff upstream between the locked release and the target release; re-run the security
   review on the delta (network calls, file access, prompt-injection content, install hooks).
2. Download the new release asset, compute its sha256, and update `tag` + `sha256` in
   `vendor/archify.lock.json`. Never update the tag without recomputing the hash from an
   asset you have reviewed.
3. Update the review date in this file.
4. Ship as a normal doccraft release. Never point the hook at an unpinned ref.
