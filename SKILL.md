---
name: doccraft
description: >-
  Turn a document (research doc, architecture proposal, 方案文档, report, decision
  memo) into a beautiful, human-friendly standalone HTML page — conclusion-first
  information architecture, diagrams, status boards, progressive disclosure, dual
  theme, mobile-ready — published via the pages component. Use when asked for a
  "可视化版", "美观易懂的版本", "HTML 版", "visual version", "做成网页", "readable
  version", or when delivering a long/dense document to a human reader who needs
  to grasp it quickly without losing detail.
execution:
  model: claude-sonnet-5
---

# Doccraft

Produce a standalone, self-contained HTML page that a human can skim in 30 seconds, read in minutes, and still drill into for full detail.

## Execution Model

The frontmatter declares `execution.model: claude-sonnet-5`. When the active session runs a different model, delegate the HTML generation (steps 2–5) to a background subagent running the declared model. The subagent receives four inputs: (1) the full source document content, (2) methodology from `references/methodology.md`, (3) the template from `assets/template.html`, (4) the target output path. The main session handles orchestration (step 1) and publishing (steps 6–8).

How to spawn the subagent depends on the runtime — use whatever background-agent mechanism is available. The runtime's own documentation covers the specifics.

## Workflow

1. **Read the source document in full.** Never design from a summary — fidelity is the contract. Note the version/date, open questions and their statuses, honest caveats or counterarguments (these MUST survive into the visual version).

2. **Load `references/methodology.md`** for information-organization and visual principles. Follow its 三层阅读深度 model and the 图形化决策表 to map each content block to a component.

3. **Sketch the info architecture** before writing any HTML: the one-sentence conclusion, the ≤3 key numbers, the section list, which blocks become diagrams/boards/collapsibles. If the source has a decision list, it becomes a status board near the end.

4. **Copy `assets/template.html` to the output location.** Default output directory: `~/zylos/http/public/pages/docs/<slug>.html` (inside the pages component's always-allowed content root). Writing to other directories requires an `externalFiles.allowedSources` entry in `~/zylos/components/pages/config.json`. The template contains the full dual-theme token system, CJK typography, and one example of every component. Delete unused component examples; do not invent a new design system unless the user asked for a specific visual direction.

5. **Build the page.** Rules that override convenience:
   - Progressive disclosure never drops content — collapsed ≠ cut.
   - Diagrams: HTML/CSS boxes first, simple inline SVG second (colors via CSS custom-property tokens so both themes work).
   - Sensitive-info scan before publishing: no internal IPs/domains (100.64.*, 192.168.*, 内网 hostnames), chat IDs, platform IDs (ou_/oc_/cli_), credentials. Share links are public URLs only.
   - Footer must state which source version the page is synced to and link the verbatim source.

6. **Publish via the pages component.** Locate the pages CLI by running `zylos info pages --json` and reading the `skillDir` field, then invoke `<skillDir>/src/cli/pages.js`:
   ```
   register --source <abs-path>.html --uri <topic>/<slug>
   share <topic>/<slug> --duration 30d
   ```
   Use the returned share URL as-is (it carries the host's pages domain).

7. **Verify the published page**: fetch the share URL (expect HTTP 200 with page content); run the 常见失误清单 from methodology.md (dark theme, mobile width, sensitive info, link validity, version sync).

8. **Record the source→page pairing.** When the source doc is later updated, the visual page must be updated in the same pass — note the mapping wherever the source doc's lifecycle is tracked.

## Quality Standard

A doccraft page must satisfy all of the following:

- **Self-contained**: single HTML file, no external dependencies (CDN, remote fonts, external CSS/JS).
- **Dual-theme**: renders correctly in both light and dark modes using CSS custom-property tokens from the template.
- **Mobile-ready**: responsive layout, no horizontal overflow on narrow viewports.
- **CJK-aware**: typography handles Chinese/Japanese/Korean text correctly (font stack, line height, punctuation spacing).
- **Conclusion-first**: TL;DR card with one-sentence conclusion + ≤3 key numbers visible on the first screen.
- **Progressive disclosure**: all source content preserved — detail is collapsed, never cut.
- **No sensitive data**: internal IPs, platform IDs, credentials, and hostnames must not appear.

## Files

| File | Purpose |
|---|---|
| `references/methodology.md` | Info organization, visual principles, component decision table, pre-publish checklist |
| `assets/template.html` | Starting-point HTML with dual-theme CSS tokens and all component examples |
