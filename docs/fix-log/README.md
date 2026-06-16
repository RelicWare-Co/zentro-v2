# Fix Log

Use this folder to leave a compact record of non-trivial fixes for future agents.

Create one new Markdown file for each fix. The filename must start with the date and end with a short descriptive slug:

```text
YYYY-MM-DD-descriptive-fix-name.md
```

Each entry should include:

- Symptom: what the user or system observed.
- Cause: the root cause, with relevant file references.
- Solution: what changed and why.
- Verification: tests or checks run, including known unrelated failures.

Keep entries factual and short. This is an operational debugging memory, not a full ADR.
