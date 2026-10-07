# Changelog

## [Unreleased]

### Added

- Opt-in reviewable-document workflow for implementation plans, execution plans, and code-review guides, backed by the Apache-2.0 `html-plan` runtime pinned at commit `f60f0454df3045f724c43c6346ec80bdcc3472b2`.
- Doccraft-owned profile contracts, representative examples, and `scripts/pack-reviewable.mjs`, which adds profile, structure, remote-resource, and sensitive-content checks before the upstream packer runs.
- Automated positive and reject-path tests plus desktop/mobile Chromium validation for all three profiles and structured Markdown responses.
- Executable vendor-lock verification and a review-first upstream comparison/update procedure in `vendor/html-plan.UPSTREAM.md`.

### Changed

- `SKILL.md` routes matching requests into the reviewable workflow while preserving the existing general-document workflow as the default.
- The implementation-plan profile now carries the four validated decision-reasoning rules verbatim and uses mechanical companion markers for doubtful-premise quotations and contract-alternative preference conditions.

## [0.3.0] — 2026-09-01

### Added

- **Archify diagram toolchain via pinned release + checksum lock** (upstream tt-a1i/archify, MIT, security-reviewed). `vendor/archify.lock.json` pins release `v2.16.0` and the sha256 of its `archify.zip` asset; `hooks/ensure-archify.mjs` (post-install / post-upgrade) downloads the asset, refuses anything whose hash differs from the lock (the hash — not the tag — anchors the reviewed content), and extracts it to `vendor/archify/` inside the skill directory. Idempotent; download failure is soft (doccraft stays fully usable, diagrams fall back to HTML/CSS + hand SVG, retried next install/upgrade). Provenance, review findings, and the upgrade procedure live in `vendor/VENDOR.md`. Archify compiles a small typed JSON description into validated, polished architecture / workflow / sequence / dataflow / lifecycle diagrams.
- `scripts/export-archify-svg.mjs` — headless export of a dual-theme, self-contained SVG (~55KB) from an archify output page, for inlining into doccraft documents.
- `references/diagrams-archify.md` — diagram routing and recipes: static SVG inline (default), `<iframe srcdoc>` full interactive viewer for 1–2 centerpiece diagrams per document, HTML/CSS or hand SVG for quick sketches. Diagram JSON sources live next to the document and are the editable source of truth.

### Changed

- SKILL.md step 5 diagram guidance now routes by diagram role (presentation-grade → archify; explorable centerpiece → iframe viewer; quick sketch → HTML/CSS boxes) instead of defaulting to hand-built SVG.


## [0.2.4] — 2026-07-25

### Security

- **Share links are no longer created by default.** Step 6 previously ran `share <uri> --duration 30d` as a mandatory part of the workflow, so every document the skill produced got a **password-free public URL** — the pages component's `auth.enabled` protects `/pages/<uri>`, but `share` mints an `/s/<token>` route that bypasses authentication by design (`pages/src/security/auth.js`, "Share access session bypass"). Confirmed empirically: a cookie-less request to such a URL returns the page body, not a login prompt.
  - Step 6 now **registers only**; a registered page stays behind the password.
  - `share` is opt-in — created only when the user explicitly asks to share the document, and the reply must state that the link is password-free and public.
  - Shortest fitting duration; `permanent` only if requested by name, since permanent shares are exempt from expiry cleanup (`DELETE ... WHERE expires_at != 0`) and can only be removed by hand.
  - Re-run the sensitive-info scan against the actual page contents before sharing; internal-only material (headcount, pricing, customer/candidate data, client project docs) needs the owner's explicit approval.
  - Documented that `unshare <uri>` revokes **every** token under that URI, including permanent ones sharing the same URI.
- Step 5's scan note updated to match.
- **Step 7 rewritten so it cannot pass on a login page.** Verifying a registered page over HTTP is a trap: the route is password-protected and the agent has no session, so it answers `302 → /pages/login`. Following the redirect (`curl -L`, or any client that follows by default) lands on the login form, which itself returns `200` with a full HTML body — an agent told to "expect HTTP 200 with page content" would mark that a pass having read none of its own document. Step 7 now verifies the artifact by opening the file directly, verifies registration via `pages list` (noting that `--q` matches the *title*, not the URI), states that the HTTP check proves only that authentication is active and cannot prove registration — auth runs before page lookup, so a registered URI and a never-registered one return the identical `302 → /pages/login` with no `404` to tell them apart — and keeps `200`-with-content only for the share-link path, where bypassing auth is the intended behaviour.

### Changed

- **Decoupled from the `pages` component.** The artifact is a self-contained single HTML file, so hosting was never required for the skill to deliver its value. `pages` is now a recommended companion rather than a dependency.
  - Removed `dependencies: [pages]` from SKILL.md frontmatter. The field had **no install-time effect** in zylos v0.6.0 (the install path never reads it); its only behaviour was blocking `zylos uninstall pages` with `Cannot remove "pages" — depends: doccraft. Use --force.` Declaring a hard dependency that does not exist held the pages component hostage on every machine with doccraft installed.
  - Removed "published via the pages component" from the frontmatter `description`. That string is the skill-matching trigger text, so the coupling was being read at the discovery layer, not just inside the workflow.
  - Step 4 no longer mandates a pages-owned output directory; any writable path works, with the pages-friendly location offered as a convenience.
  - Step 6 is now a pluggable **Deliver** step: publish via pages when it is installed, otherwise report the absolute file path and hand the file over directly. A missing `pages` component is explicitly not a failure, and must not be installed as a side effect.
  - Step 7 verifies either delivery path.
- README usage section updated to match.

`references/methodology.md` and `assets/template.html` are unchanged — they never referenced `pages`.

### Upgrade note

Merging this release does **not** change already-installed instances. Each machine must run `zylos upgrade doccraft` for the lock to lift. Verify with `zylos uninstall pages --check` and confirm `doccraft` no longer appears in `dependents` — a version-number bump alone is not proof.

## [0.2.3] — 2026-07-25

### Fixed

- SKILL.md step 6: clarify that `share` returns a relative path, not a full URL — agent must combine with host domain before sharing.

## [0.2.2] — 2026-07-25

### Fixed

- SKILL.md: corrected pages publish prerequisite — output path must be in pages `externalFiles.allowedSources`, not assumed to be in an "always-allowed root". Added error recovery guidance for `source_outside_allowed_root`.

## [0.2.1] — 2026-07-25

### Changed

- SKILL.md frontmatter: added `type: utility`, `lifecycle`, `upgrade`, `dependencies` per component template spec.
- package.json: added `type: module`, `repository`, `bugs`, `homepage`, `license`, `engines` fields.
- README: added pre-registry install instructions and runtime compatibility section.

## [0.2.0] — 2026-07-25

### Changed

- SKILL.md rewritten for runtime-neutral compatibility (Claude Code + Codex).
- Execution model: declared model is now a quality preference with 3-tier fallback, not a hard requirement.
- Tool references replaced with action descriptions (no runtime-specific tool names).
- Pages CLI path discovery via `zylos info pages --json` instead of hardcoded path.
- Added explicit Quality Standard section (7 declarative acceptance criteria).

## [0.1.0] — 2026-07-24

### Added

- Initial release: migrated from internal `doc-design` skill to standalone component.
- `SKILL.md` — skill definition with trigger words, execution model, and design workflow.
- `references/methodology.md` — design methodology (conclusion-first, progressive disclosure, dual theme, mobile-first).
- `assets/template.html` — HTML template with full CSS (light/dark themes, responsive grid, collapsible sections, status boards).
