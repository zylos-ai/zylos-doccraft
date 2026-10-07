# Implementation Plan Profile

Use for design review before code is written or changed.

## Reader Question

What behavior will change, how will it work, where will it live, and which choices still affect the design?

## Required Shape

- Use `<doc-plan>` with at most five top-level behavior claims and three claim levels.
- Level 1 states what a user, operator, or caller can now do or observe.
- Level 2 states the entrypoint, rule, state transition, or record that makes the behavior work.
- Level 3 identifies the exact `path:line` location or labels new code as a sketch.
- Include `aux="shared"` for shared records or mechanisms when applicable.
- End with `aux="scope"` covering unchanged behavior and excluded systems.

## Preferred Exhibits

- Visible behavior: `doc-mock` or `doc-machine`.
- Call path and change surface: `doc-calls` with exact locations.
- Data contract: `doc-schema` in the repository's actual language.
- Critical existing or proposed logic: short `doc-code` with pins.

## Required Checks

- Show at least one reject/error path for each behavior that validates, retries, cancels, or can partially fail.
- Keep implementation order out of the top level; behavior, not files or phases, defines the plan tree.
- Put each unresolved design fork in `doc-ask` on the affected claim. Do not ask the reader to approve already-set scope or authorization.
- Do not begin implementation based only on the generated response. Obtain the normal repository-write authorization separately.
