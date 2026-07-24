# zylos-doccraft

Document design skill for zylos agents. Turns structured content (reports, proposals, digests, decision memos) into beautiful, human-friendly standalone HTML pages.

## Install

```bash
zylos add doccraft
```

## What it does

- **Methodology** (`references/methodology.md`): Design principles — conclusion-first information architecture, progressive disclosure, dual light/dark theme, mobile responsiveness.
- **Template** (`assets/template.html`): Production-ready HTML template with CSS for status boards, collapsible sections, number cards, and responsive grids.
- **Skill** (`SKILL.md`): Trigger rules and execution workflow for the agent.

## Usage

The skill is triggered when the agent needs to produce a document for human consumption. Trigger words include "可视化版", "HTML 版", "做成网页", "readable version".

The agent reads the methodology, uses the template as a starting point, generates HTML, and publishes via whatever channel is available (typically the `pages` component).

## Design Principles

1. **Conclusion first** — TL;DR + 3 number cards at the top
2. **Progressive disclosure** — overview → status board → collapsible details
3. **Dual theme** — automatic light/dark via `prefers-color-scheme`
4. **Mobile responsive** — flexbox/grid, overflow-x containers
5. **Sensitive info scan** — no internal IDs or credentials in published output

## Origin

Inspired by Anthropic's Artifacts design system. Adapted for self-hosted publishing via zylos pages or any static file server.
