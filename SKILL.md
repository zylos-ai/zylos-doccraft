---
name: doccraft
description: >-
  Turn a document (research doc, architecture proposal, 方案文档, report, decision
  memo) into a beautiful, human-friendly standalone HTML page — conclusion-first
  information architecture, diagrams, status boards, progressive disclosure, dual
  theme, mobile-ready — published via the pages component. Use when asked for a
  "可视化版", "美观易懂的版本", "HTML 版", "visual version", "做成网页", "readable
  version", or when delivering a long/dense document to a human reader (especially
  Howard) who needs to grasp it quickly without losing detail. NOT for PR reviews
  (use pr-review-doc) and NOT for plain markdown publishing (use pages directly).
execution:
  model: claude-sonnet-5
---

# Doc Design

Produce a standalone, self-contained HTML page that a human can skim in 30 seconds, read in minutes, and still drill into for full detail.

## Execution Model

This skill declares `execution.model: claude-sonnet-5`. When the main session is running on a different model, delegate the HTML writing (steps 2–5 below) to a subagent with model `claude-sonnet-5`. The main session handles orchestration only: identifying the need, preparing inputs, spawning the subagent, and publishing the result (steps 6–8).

When the main session is already on `claude-sonnet-5`, run inline as usual — no subagent needed.

Subagent delegation pattern (Claude Code):
```
Agent({
  model: "sonnet",
  prompt: "<full skill instructions + source content + output path>",
  description: "doc-design writer"
})
```

Note: the Claude Code Agent tool only accepts alias enums (`sonnet`/`opus`/`haiku`/`fable`); `"sonnet"` resolves to the latest Sonnet, i.e. `claude-sonnet-5`. Everywhere a precise model string is accepted, write `claude-sonnet-5` — never a broad alias.

The subagent must receive: (1) the full source document content, (2) the methodology from `references/methodology.md`, (3) the template from `assets/template.html`, (4) the target output path. It returns the written HTML file. The main session then publishes and verifies.

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

## Reference example

First production use: 分身架构论证 visual version (2026-07-04) — source `~/zylos/workspace/agent-avatar-architecture/avatar-architecture-visual.html`, built from a 27KB Chinese architecture doc. Shows all components in real use: TL;DR facts, A/B/C option comparison with SVG topology diagrams + highlighted recommendation, DMZ dual-zone, layers, Rule-of-Two legs, phase timeline, Q1–Q6 status board, deep arguments in collapsibles.

## Files

| File | When to read |
|---|---|
| `references/methodology.md` | Always, at step 2 — info organization, visual principles, component decision table, pre-publish checklist |
| `assets/template.html` | Step 4 — copy as starting point; skim its CSS comments for token semantics |
