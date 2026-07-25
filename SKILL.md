---
name: doccraft
version: 0.2.4
description: >-
  Turn a document (research doc, architecture proposal, 方案文档, report, decision
  memo) into a beautiful, human-friendly standalone HTML page — conclusion-first
  information architecture, diagrams, status boards, progressive disclosure, dual
  theme, mobile-ready. Use when asked for a "可视化版", "美观易懂的版本", "HTML 版",
  "visual version", "做成网页", "readable version", or when delivering a
  long/dense document to a human reader who needs to grasp it quickly without
  losing detail.
type: utility

lifecycle:
  npm: false

upgrade:
  repo: zylos-ai/zylos-doccraft
  branch: main

execution:
  model: claude-sonnet-5
---

# Doccraft

Produce a standalone, self-contained HTML page that a human can skim in 30 seconds, read in minutes, and still drill into for full detail.

## Execution Model

The frontmatter declares `execution.model: claude-sonnet-5` as a **quality preference**, not a hard requirement. The intent is to run HTML generation on a model with strong visual-design and long-output capability. Behavior by runtime:

- If the runtime can spawn a background subagent with the declared model, do so — delegate steps 2–5 to it.
- If the runtime cannot use the declared model (e.g. it only has access to its own model family), use the strongest available model that supports background execution.
- If no background delegation is available, run steps 2–5 inline in the current session.

In all cases the subagent (or inline execution) receives four inputs: (1) the full source document content, (2) methodology from `references/methodology.md`, (3) the template from `assets/template.html`, (4) the target output path. The main session handles orchestration (step 1) and delivery (steps 6–8). The output contract (Quality Standard below) is the same regardless of which model or execution path is used.

## Workflow

1. **Read the source document in full.** Never design from a summary — fidelity is the contract. Note the version/date, open questions and their statuses, honest caveats or counterarguments (these MUST survive into the visual version).

2. **Load `references/methodology.md`** for information-organization and visual principles. Follow its 三层阅读深度 model and the 图形化决策表 to map each content block to a component.

3. **Sketch the info architecture** before writing any HTML: the one-sentence conclusion, the ≤3 key numbers, the section list, which blocks become diagrams/boards/collapsibles. If the source has a decision list, it becomes a status board near the end.

4. **Copy `assets/template.html` to the output location.** Any writable directory works — the page is self-contained, so the output location does not constrain the result. If you intend to publish via the pages component (step 6), writing to `~/zylos/http/public/pages/docs/<slug>.html` avoids a config step; see step 6 for why. The template contains the full dual-theme token system, CJK typography, and one example of every component. Delete unused component examples; do not invent a new design system unless the user asked for a specific visual direction.

5. **Build the page.** Rules that override convenience:
   - Progressive disclosure never drops content — collapsed ≠ cut.
   - Diagrams: HTML/CSS boxes first, simple inline SVG second (colors via CSS custom-property tokens so both themes work).
   - Sensitive-info scan before publishing: no internal IPs/domains (100.64.*, 192.168.*, 内网 hostnames), chat IDs, platform IDs (ou_/oc_/cli_), credentials. A share link is a password-free public URL (step 6) — scan on that assumption.
   - Footer must state which source version the page is synced to and link the verbatim source.

6. **Deliver.** The artifact is a single self-contained HTML file — no hosting component is required for it to be complete. Choose the delivery path by what is installed:

   **If the `pages` component is available** (`zylos info pages --json` succeeds), register it. Read the `skillDir` field from that output, then invoke `<skillDir>/src/cli/pages.js`:
   ```
   register --source <abs-path>.html --uri <topic>/<slug>
   ```
   **Register only. Do NOT create a share link by default.** A registered page sits behind the pages component's password; report the internal URL (or the file path) and stop there. The output path must be within one of the pages component's `externalFiles.allowedSources` entries (configured in `~/zylos/components/pages/config.json`). If `register` fails with `source_outside_allowed_root`, add the target directory to `allowedSources` first, or move the file into an already-allowed directory.

   **Share links are opt-in, never routine.** `share <topic>/<slug> --duration <24h|7d|30d>` mints a URL that **bypasses the password entirely** — anyone holding it can read the page without logging in, for the whole duration. Create one only when the user explicitly asks to share the document with someone, and when you do:
   - Say plainly, in the same message as the link, that it is a password-free public URL.
   - Pick the shortest duration that fits the purpose. Do not reach for `30d` reflexively, and never use `permanent` unless the user asks for it by name — permanent shares are exempt from expiry cleanup and can only be removed by hand.
   - Before sharing, re-run the step-5 sensitive-info scan against what the page actually contains. Internal-only material (headcount, pricing, customer or candidate data, client project documents) must not go on a share link without the owner's explicit say-so.
   - Note that `unshare <uri>` revokes **every** token under that URI, including permanent ones — check what else is attached before revoking.

   The `share` command returns a relative path (e.g. `/pages/s/<token>`); combine it with the host's pages domain to form the full URL.

   **If `pages` is not installed**, the skill still delivers in full: report the absolute path of the generated file to the user, and hand it over by whatever channel is in use (file upload, attachment, or any static file server). Do not treat a missing `pages` component as a failure, and do not install it as a side effect — say the file is ready and where it is.

7. **Verify the result.** Verify the artifact and the registration separately — and do not verify a registered page over HTTP.

   - **The artifact**: open the generated HTML file directly and confirm it renders standalone. The page is self-contained, so this is the authoritative check; it needs no server.
   - **The registration**: `pages list` and look for the URI. Note that `--q` matches the **title**, not the URI — a page with a Chinese title will not be found by searching its English URI. When in doubt, list everything and filter on the URI yourself.
   - **A registered (unshared) page over HTTP**: the correct healthy response is **`302` redirecting to `/pages/login`** — *not* `200`. It is password-protected, and the agent has no session. **Do not follow redirects to check this.** `curl -L` (and any client that follows redirects by default) lands on the login page, which itself returns `200` with a full HTML body — so "HTTP 200" here means either you sent credentials or you are looking at the login form, and neither proves the page registered correctly. Getting `404` instead means registration failed.
   - **A share link** (only if one was explicitly requested): `200` with the actual page content *is* the right check, because that route deliberately bypasses authentication. Confirm the body is your page and not a login form.

   Then run the 常见失误清单 from methodology.md (dark theme, mobile width, sensitive info, link validity, version sync).

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
