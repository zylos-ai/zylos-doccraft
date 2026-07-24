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

# Doc Design

Produce a standalone, self-contained HTML page that a human can skim in 30 seconds, read in minutes, and still drill into for full detail.

## Execution Model

Declares `execution.model: claude-sonnet-5`. When the main session runs a different model, delegate HTML writing (steps 2–5) to a Sonnet subagent. The subagent receives: source content, methodology, template, and output path. The main session orchestrates and publishes.

## Workflow

1. **Read the source completely.** Never design from a summary — fidelity is the contract. Note: the version/date of the source, its open questions and their statuses, any honest caveats or counterarguments (these MUST survive into the visual version).

2. **Load `references/methodology.md`** for information-organization and visual principles. Follow its 三层阅读深度 model and the 图形化决策表 to map each content block to a component.

3. **Sketch the info architecture** before writing HTML: the one-sentence conclusion, the ≤3 key numbers, the section list, which blocks become diagrams/boards/collapsibles. If the source has a decision list, it becomes a status board near the end.

4. **Start from `assets/template.html`** — copy it to the output location. Default: `~/zylos/http/public/pages/docs/<slug>.html` (inside the always-allowed `pages-content` root — registering from arbitrary dirs fails with "source is outside the configured allowed root"; other dirs need an `externalFiles.allowedSources` entry in `~/zylos/components/pages/config.json`, e.g. the avatar-arch project dir). The template contains the full dual-theme token system, CJK typography, and one example of every component. Delete unused component examples; do not invent a new design system unless the user asked for a specific visual direction.

5. **Build.** Rules that override convenience:
   - Progressive disclosure never drops content — collapsed ≠ cut.
   - Diagrams: HTML/CSS boxes first, simple inline SVG second (colors via token classes so both themes work).
   - Sensitive-info scan before publishing: no internal IPs/domains (100.64.*, 192.168.*, 内网 hostnames), chat IDs, platform IDs (ou_/oc_/cli_), credentials. Share links are public URLs.
   - Footer must state which source version the page is synced to, and link the 逐字版 source.

6. **Publish via pages** (register before share; register rejects paths outside allowed roots):
   ```bash
   node ~/zylos/.claude/skills/pages/src/cli/pages.js register --source <abs-path>.html --uri <topic>/<slug>
   node ~/zylos/.claude/skills/pages/src/cli/pages.js share <topic>/<slug> --duration 30d
   ```
   Use the returned share URL as-is (it carries this machine's pages domain).

7. **Verify before delivering**: `curl` the share URL (expect 200 + page content); run the 常见失误清单 at the end of methodology.md (dark theme, mobile width, sensitive info, link validity, version sync).

8. **Record the pairing.** When the source doc later gets updated, the visual page must be updated in the same pass — note the source→page mapping wherever the source doc's lifecycle is tracked (e.g. the project's state.md entry).

## Files

| File | Purpose |
|---|---|
| `references/methodology.md` | Info organization, visual principles, component decision table, pre-publish checklist |
| `assets/template.html` | Starting-point HTML with dual-theme CSS tokens and all component examples |
