# Changelog

## [0.2.4] — 2026-07-25

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
