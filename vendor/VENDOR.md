# Vendored Third-Party Dependencies

## html-plan

- **Upstream**: `anthropics/claude-plugins-community`, Apache-2.0.
- **Pinned**: commit and per-file SHA-256 values in `vendor/html-plan.lock.json`.
- **Vendored boundary**: the complete upstream `html-plan/skills/html-plan/` subtree plus the repository root `LICENSE`, copied byte-for-byte into `vendor/html-plan/`.
- **Adaptation boundary**: do not edit files below `vendor/html-plan/`. Doccraft-specific core and profiles live under `references/`. If a future change must modify an upstream file, copy it outside the vendor boundary and add a prominent modification notice as required by Apache-2.0 section 4(b).
- **Security review**: 2026-10-07 at `f60f0454df3045f724c43c6346ec80bdcc3472b2`. The browser runtime uses local DOM, local storage, and explicit clipboard writes; it has no fetch/XHR/WebSocket/EventSource/sendBeacon path. The packer limits Git execution to `rev-parse` and `cat-file blob`, disables hooks/fsmonitor/pager/prompts, fences resolved file reads, and rejects common secret paths/content. Doccraft additionally forbids remote media, which upstream permits.
- **Integration and updates**: file mapping, Doccraft-owned differences, integration commits, and the review-first comparison procedure are recorded in `vendor/html-plan.UPSTREAM.md`. `npm run vendor:check` verifies the current copy against the lock without network access.
