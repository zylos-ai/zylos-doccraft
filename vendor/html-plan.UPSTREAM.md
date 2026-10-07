# html-plan Integration and Updates

## Integration Record

- Upstream repository: `anthropics/claude-plugins-community`
- Upstream commit: `f60f0454df3045f724c43c6346ec80bdcc3472b2`
- Imported subtree: `html-plan/skills/html-plan/`
- Doccraft integration commits: `e4a65a1` (runtime, profiles, workflow) and
  `21003a4` (validator, examples, and browser validation)
- Integrity record: `vendor/html-plan.lock.json`

The upstream subtree and repository license are copied byte-for-byte below
`vendor/html-plan/`. Doccraft-owned behavior stays outside that directory.

## File Mapping

| Upstream source | Doccraft destination | Local role |
| --- | --- | --- |
| repository `LICENSE` | `vendor/html-plan/LICENSE` | Apache-2.0 license copy |
| `html-plan/skills/html-plan/SKILL.md` | `vendor/html-plan/SKILL.md` | Upstream authoring reference |
| `references/blocks.md` | `vendor/html-plan/references/blocks.md` | Block protocol reference |
| `runtime/htmlplan.css` | `vendor/html-plan/runtime/htmlplan.css` | Review UI styles |
| `runtime/htmlplan.js` | `vendor/html-plan/runtime/htmlplan.js` | Local interaction runtime |
| `runtime/pack.mjs` | `vendor/html-plan/runtime/pack.mjs` | Upstream lint and single-file packer |
| `examples/scheduled-send.html` | `vendor/html-plan/examples/scheduled-send.html` | Unmodified upstream example |

## Doccraft-Owned Differences

- `SKILL.md` routes reviewable implementation plans, execution plans, and code
  review guides into an explicit opt-in workflow. General Doccraft output is
  unchanged.
- `references/reviewable-document.md` and `references/profiles/` define the
  Doccraft contract for structure, evidence, scope, and profile-specific checks.
- `scripts/pack-reviewable.mjs` rejects remote dependencies and common sensitive
  content, validates the selected profile, then invokes the upstream packer.
- `examples/reviewable/` contains one Doccraft-owned fixture per profile.
- `tests/` verifies positive and reject paths plus desktop/mobile browser behavior.

## Update Procedure

1. Check out the upstream repository at the candidate commit. Do not update from
   a moving branch or install the marketplace plugin.
2. Run `node scripts/check-html-plan-vendor.mjs --source <upstream-checkout>`.
   The command first verifies the current lock, then reports added, modified, and
   deleted files in the candidate subtree and repository license.
3. Review the upstream commit range and every reported file. Re-run the security
   review for network calls, filesystem access, Git subprocesses, secret handling,
   browser storage, clipboard behavior, and license/NOTICE changes.
4. Copy only approved upstream files into a temporary branch. Never patch files
   under `vendor/html-plan/` with Doccraft behavior; place adaptations outside the
   vendor boundary.
5. Update the commit and per-file SHA-256 values in
   `vendor/html-plan.lock.json`, then update the review record in `vendor/VENDOR.md`.
6. Run `npm test`, syntax checks, `git diff --check`, and inspect the complete
   vendor diff. A changed vendor file without a matching lock change must fail.
7. Record the candidate commit, reviewed delta, accepted/rejected changes, and
   verification evidence in the delivery task and Default Knowledge Base.

This flow is deliberately review-first. The comparison command never fetches,
copies, or overwrites upstream files.
