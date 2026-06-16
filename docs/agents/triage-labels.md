# Triage Labels

Last checked against GitHub on 2026-06-16.

The skills speak in terms of five canonical triage roles, but this repository does
not currently have dedicated triage-state labels. The live GitHub labels are the
default project labels:

- `bug`
- `documentation`
- `duplicate`
- `enhancement`
- `good first issue`
- `help wanted`
- `invalid`
- `question`
- `wontfix`

## Canonical Role Mapping

| Skill role | Current tracker label | Guidance |
| --- | --- | --- |
| `needs-triage` | none | Do not apply a replacement label. Leave the issue open without a triage-state label unless the user asks to create one. |
| `needs-info` | `question` | Use `question` when the issue is blocked on reporter/user clarification. |
| `ready-for-agent` | none | Do not map this to `help wanted`; that label does not mean AFK-agent ready in this repo. Create `ready-for-agent` only if the user asks to enable the canonical workflow. |
| `ready-for-human` | none | Do not apply a replacement label. Call out in the issue/comment that human implementation is needed. |
| `wontfix` | `wontfix` | Apply `wontfix` when closing or marking work intentionally out of scope. |

## If A Skill Requires Canonical Labels

If a skill explicitly needs canonical labels to publish or advance work, first
check the live tracker with:

```bash
gh label list --limit 200
```

If the required label is still absent, ask the user before creating labels on
GitHub. Do not silently invent local mappings that change workflow semantics.
