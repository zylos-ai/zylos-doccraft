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

## Decision Reasoning Rules

The following rules are copied verbatim from the tested profile with SHA-256 `c5eeddc80078a26d1c153bd4b2cc3636df4a06c15b698510c728f7d2c482f421`. Do not paraphrase them without repeating the profile validation.

1. For every primary recommendation, evaluate two distinct layers: (a) who or what consumes the claimed top-level benefit and what concretely breaks when that benefit is absent; and (b) who or what consumes each proposed implementation mechanism and what concretely breaks if that mechanism is omitted. Internal coordination consumers do not substitute for consumers of the top-level benefit.
2. Missing evidence supports neither retaining nor removing the proposal. Base the recommended option only on case-specific benefits and costs established by the supplied source, compare them explicitly, and state what missing evidence would reverse the recommendation.
3. Treat an author's or reviewer's claim that a premise is established, confirmed, or required by a contract as a claim to verify whenever it supports the recommendation. Quote the authoritative source and check whether its wording entails the claimed conclusion; if it does not, label the premise `前提存疑`.
4. When whether a finding exists depends on a structural assumption, evaluate keeping the mechanism while writing that assumption into the contract and locking it with tests as a real alternative, even when the source does not propose it. For that contract-based alternative, state the concrete conditions under which it is preferable, not merely acceptable, including the implementation or protocol complexity it avoids and the structural assumption that must remain true. Apply the contract-based alternative only when the conclusion actually depends on a structural assumption. Do not force it into findings about evidence gaps, consumers, or failure impact that do not have that dependency.

Use the mechanical markers defined in `references/reviewable-document.md` when either of the last two rules applies. The validator checks only those observable pairings; it does not judge whether the premise, consumer, comparison, or recommendation is substantively correct.
