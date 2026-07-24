# Changelog

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
