# Execution Plan Profile

Use after the design direction is known and the reader must review the order, dependencies, gates, and recovery path.

## Reader Question

What happens in what order, what must be true before each stage starts, and how does execution stop or recover when a gate fails?

## Required Shape

- Make each top-level claim an independently verifiable execution outcome, not a vague phase name.
- Use `doc-seq` for cross-system order, `doc-machine` for lifecycle and stop states, and `doc-tree` or `doc-calls` for the touched surface.
- For every stage, state its inputs, owner, dependency, completion evidence, and next gate.
- Show the critical path and which work can run in parallel.
- End with an explicit rollback/containment claim and a scope claim.

## Required Checks

- Pair each positive gate with the failure result: stop, retry, rollback, or escalate.
- Distinguish reversible local work from publishing, migration, deployment, restart, notification, and destructive work.
- Never imply approval. Mark authorization-dependent stages as blocked until the authoritative approval exists.
- Include commands only when they are evidence or a proposed runbook. A copied response never authorizes their execution.
- Define completion with observable evidence, not "done" or "works".
