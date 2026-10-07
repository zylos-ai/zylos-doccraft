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
- **Reviewable documents** (`references/reviewable-document.md`): Opt-in implementation-plan, execution-plan, and code-review-guide profiles with structured feedback.

## Usage

The skill is triggered when the agent needs to produce a document for human consumption. Trigger words include "可视化版", "HTML 版", "做成网页", "readable version".

The agent reads the methodology, uses the template as a starting point, and generates a self-contained HTML file. Delivery is pluggable: if the `pages` component is installed, the file is published there for a share link; if not, the skill hands over the file path directly. `pages` is a recommended companion, not a requirement — the artifact has no external dependencies of its own.

### Reviewable plans and guides

For implementation plans, execution plans, and code-review guides that need inline decisions or comments, choose the matching profile and start from its representative example:

```bash
node scripts/pack-reviewable.mjs examples/reviewable/implementation-plan.html \
  --profile implementation-plan --root . -o /tmp/implementation-plan.html
```

The wrapper verifies the profile contract, local-only assets, common sensitive-content patterns, claim depth, and required evidence before invoking the pinned upstream packer. The packed file is self-contained; feedback is returned as structured Markdown. See `examples/reviewable/` for all three profiles and `vendor/html-plan.UPSTREAM.md` for provenance and the review-first update procedure.

Run the complete validation suite with `npm test`. Run `npm run vendor:check` when auditing the pinned upstream copy.

## Runtime Compatibility

This skill is runtime-neutral — it works on both Claude Code and Codex. The execution model declares `claude-sonnet-5` as a quality preference with a three-tier fallback: declared model, strongest available model, or inline execution. The output quality standard is the same regardless of execution path.

## Design Principles

1. **Conclusion first** — TL;DR + 3 number cards at the top
2. **Progressive disclosure** — overview → status board → collapsible details
3. **Dual theme** — automatic light/dark via `prefers-color-scheme`
4. **Mobile responsive** — flexbox/grid, overflow-x containers
5. **Sensitive info scan** — no internal IDs or credentials in published output
