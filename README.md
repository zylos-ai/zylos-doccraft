# zylos-doccraft

Document design skill for zylos agents. Turns structured content (reports, proposals, digests, decision memos) into beautiful, human-friendly standalone HTML pages.

## Install

After registry publication:

```bash
zylos add doccraft
```

Pre-registry (from GitHub release):

```bash
zylos add zylos-ai/zylos-doccraft
```

## What it does

- **Methodology** (`references/methodology.md`): Design principles — conclusion-first information architecture, progressive disclosure, dual light/dark theme, mobile responsiveness.
- **Template** (`assets/template.html`): Production-ready HTML template with CSS for status boards, collapsible sections, number cards, and responsive grids.
- **Skill** (`SKILL.md`): Trigger rules and execution workflow for the agent.

## Usage

The skill is triggered when the agent needs to produce a document for human consumption. Trigger words include "可视化版", "HTML 版", "做成网页", "readable version".

The agent reads the methodology, uses the template as a starting point, generates HTML, and publishes via the `pages` component.

## Runtime Compatibility

This skill is runtime-neutral — it works on both Claude Code and Codex. The execution model declares `claude-sonnet-5` as a quality preference with a three-tier fallback: declared model, strongest available model, or inline execution. The output quality standard is the same regardless of execution path.

## Design Principles

1. **Conclusion first** — TL;DR + 3 number cards at the top
2. **Progressive disclosure** — overview → status board → collapsible details
3. **Dual theme** — automatic light/dark via `prefers-color-scheme`
4. **Mobile responsive** — flexbox/grid, overflow-x containers
5. **Sensitive info scan** — no internal IDs or credentials in published output
