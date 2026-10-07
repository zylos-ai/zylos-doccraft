# Code Review Guide Profile

Use to help a reviewer assess a concrete change at an exact revision.

## Reader Question

What changed, why is it correct, where can it fail, and what evidence lets the reviewer accept or reject it?

## Required Shape

- Name the exact base and head revisions near the title and in `doccraft-base` / `doccraft-head` meta tags. If either is unknown, mark the comparison unverified and do not package it as a completed guide.
- Start with the behavioral delta and risk level, not a file list.
- Use `doc-calls` for changed entrypoints and propagation, `doc-code` for high-risk lines, `doc-schema` for contract changes, and `doc-machine` for lifecycle changes.
- Group files by behavior or risk. Do not reproduce the repository diff as the information architecture.
- End with a `<table data-review-verification>` verification matrix and explicit out-of-scope items.

## Required Checks

- Trace every important claim to a changed or relied-on path and line.
- Cover success and reject/error paths, including authorization and data-boundary failures when applicable.
- Separate evidence you reproduced from evidence reported by another party.
- Mark missing tests, stale line references, generated-file drift, and dependency changes as visible risks.
- Use `doc-ask` only for actual reviewer decisions, such as whether a known residual risk blocks merge. Do not preselect "approve" as a default.
- The guide recommends; it does not merge, deploy, or accept work.
