# Vendored Third-Party Dependencies

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
