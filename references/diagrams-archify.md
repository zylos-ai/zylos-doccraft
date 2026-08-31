# Diagrams with the Vendored Archify Toolchain

Archify (installed at `vendor/archify/` by `hooks/ensure-archify.mjs` from the pinned,
checksum-locked release in `vendor/archify.lock.json`; provenance and security review in
`vendor/VENDOR.md` — if the directory is absent, run the hook once) turns a small typed JSON description into a validated, polished diagram.
Five types: `architecture`, `workflow`, `sequence`, `dataflow`, `lifecycle`.

**Every CLI invocation must set `ARCHIFY_UPDATE_CHECK_DISABLED=1`** — this disables the
upstream update check permanently (see VENDOR.md). Shorthand used below:

```bash
ARCHIFY="ARCHIFY_UPDATE_CHECK_DISABLED=1 node <doccraft-skill-dir>/vendor/archify/bin/archify.mjs"
```

The CLI is zero-dependency (Node ≥18). For authoring guidance (JSON schema, examples,
quality presets) read `vendor/archify/SKILL.md` — load it on demand, not by default.

## Routing

| Diagram role | Method | Cost |
|---|---|---|
| Presentation-grade figure (default) | static dual-theme SVG, inlined | ~55KB each |
| Explorable centerpiece (max 1–2 per doc) | `<iframe srcdoc>` full viewer | ~700KB each |
| Quick structural sketch | HTML/CSS boxes / simple inline SVG | negligible |

## Pipeline (static SVG, the default)

1. **Author** the diagram as JSON (see `vendor/archify/examples/` and the schemas in
   `vendor/archify/schemas/`). Save it next to the document source, e.g.
   `<doc-dir>/<slug>.sequence.json` — the JSON is the editable source of truth;
   never hand-patch the exported SVG.
2. **Validate and render**: `$ARCHIFY deliver sequence <slug>.sequence.json <slug>.html`.
   Fix diagnostics until it passes; run `$ARCHIFY visual-check <slug>.html` for the
   screenshot-verified pass when the diagram is dense.
3. **Export** the dual-theme self-contained SVG:
   `node <doccraft-skill-dir>/scripts/export-archify-svg.mjs <abs>/<slug>.html <abs>/<slug>.svg`
   (headless Chromium; resolves playwright-core from doccraft's or the browser skill's
   node_modules). The SVG embeds all styles and both theme variable sets: it follows
   `prefers-color-scheme` automatically, and `data-theme="light|dark"` on the `<svg>`
   element forces a theme — set it to follow the document's own theme toggle if the
   page has one.
4. **Inline** the SVG into the document inside a width-constrained container:
   ```html
   <div class="figure"><!-- svg here; style .figure svg { display:block; width:100%; height:auto; } --></div>
   ```
5. Delete the intermediate `<slug>.html` or keep it beside the JSON if the interactive
   version may be linked later.

## Explorable centerpiece (`<iframe srcdoc>`)

For the one diagram a reader should explore (pan/zoom, route tracing, Present mode):

```python
import html
full = open('<slug>.html', encoding='utf-8').read()
iframe = f'<iframe srcdoc="{html.escape(full, quote=True)}" title="..." loading="lazy"></iframe>'
```

Style: `iframe { display:block; width:100%; height:680px; border:0; }` inside the same
`.figure` container. The document stays a single self-contained file. Keep to 1–2 per
document — each embeds the ~700KB viewer.

## Standalone diagram requests (no doccraft document)

The same toolchain serves "画个架构图" requests outside doccraft: `deliver` the HTML and
publish it directly (e.g. register with the pages component) instead of embedding.
