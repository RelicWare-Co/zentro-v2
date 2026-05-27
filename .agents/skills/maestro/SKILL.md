---
name: maestro
description: Author, run, debug, review, and maintain Maestro end-to-end tests for mobile apps, web apps, Maestro Studio, Maestro CLI, Maestro Cloud, Maestro MCP, YAML flows, selectors, subflows, JavaScript in flows, CI reports, device setup, and flaky E2E troubleshooting. Use when working with Maestro files such as .maestro/, config.yaml, *.yaml/*.yml flows, runFlow/runScript scripts, Maestro Cloud CI workflows, or when the user asks for E2E testing with Maestro.
---

# Maestro E2E

## Overview

Use this skill to design reliable Maestro flows, inspect and run them when tools are available, and debug failures through the same CLI, Cloud, MCP, and YAML semantics documented by Maestro.

This is a project-local skill for `zentro-v2`. For this repo, assume web tests are likely unless the user asks for mobile: start the app with the repo's normal dev command, discover the actual local URL from server output, and use `url:` flows for web. Do not hardcode a localhost port if the running server chose a different one.

## Source Snapshot

The bundled references were distilled from the official `mobile-dev-inc/maestro-docs` repository at commit `4b509bb968d1465ecfcea552b4784e1033153747` from 2026-05-21. If exact current behavior matters, re-check the official Maestro docs or CLI help before making a large change.

## Workflow

1. Identify the target surface: local web, Android, iOS, Cloud, CI, or MCP-driven live authoring.
2. Inspect existing `.maestro/`, `config.yaml`, flow folders, CI workflow files, and app commands before adding new structure.
3. Read only the relevant reference file:
   - `references/flow-authoring.md`: YAML anatomy, selectors, waits, control flow, JavaScript, hooks, tags, and suite design.
   - `references/commands.md`: command catalog and syntax reminders.
   - `references/cli-cloud-ci.md`: CLI install/run flags, artifacts, Cloud, GitHub Actions, env vars, reports, and devices.
   - `references/platforms-troubleshooting.md`: Android, iOS, React Native, Flutter, Web, known issues, and debug patterns.
4. Prefer live feedback:
   - If Maestro MCP tools are available, use `cheat_sheet` for unfamiliar syntax, `list_devices`, `inspect_screen`, `take_screenshot`, and `run` with inline YAML while iterating. Re-inspect after UI-changing commands.
   - If MCP tools are not available, use Maestro CLI: `maestro test`, `--debug-output`, `--test-output-dir`, `--format junit/html`, and Studio screenshots or hierarchy artifacts.
5. Author flows from user intent, not implementation details. Use selectors that validate user-visible behavior first, then stable IDs for localized, icon-only, or dynamic UI.
6. Validate before finishing: run `scripts/validate_maestro_flows.py` for static checks, then run Maestro itself when a target device/browser/server is available.

## Authoring Rules

- Keep top-level flows isolated. A flow should normally launch or navigate to its own starting state instead of relying on a previous flow.
- Use `runFlow` for reusable setup, login, teardown, navigation, or platform-specific branches. Keep subflows atomic and parameterize them with `env`.
- Use `assertVisible` and `assertNotVisible` as the default wait mechanism. Use `extendedWaitUntil` only for known long waits, and `waitForAnimationToEnd` for moving UI.
- Prefer `scrollUntilVisible` for full-screen scrolls. Use custom `swipe`/`repeat` loops only for fragments, bottom sheets, or constrained scroll regions.
- Quote YAML scalars that YAML may coerce, especially `YES`, `NO`, `ON`, `OFF`, `Y`, and `N`. Escape literal dollar signs in visible text as `\$`.
- Avoid coordinates unless no accessible selector exists. If coordinates are unavoidable, use percentages, not pixels, and include a label explaining why.
- Treat `optional: true` as exception handling for non-critical or transient UI only. For branching, prefer `runFlow` with `when`.
- For sensitive input, use `label` to keep reports readable, but remember raw debug logs can still contain values.
- For JavaScript, keep simple expressions inline, use `evalScript` for one-line state changes, and use `runScript` for reusable API calls or multi-line logic. Namespace values under `output.<feature>`.
- For Cloud or CI, upload a workspace directory rather than a single flow when subflows or scripts are referenced.

## Project Defaults

- Put project flows in `.maestro/` unless the existing repo already uses another E2E folder.
- Use `.maestro/config.yaml` once there is more than one top-level flow, subdirectories, tags, output settings, or platform config.
- For web flows in this repo, use a `url:` header and `launchApp`. Start from the actual Vike dev URL emitted by `bun run dev`.
- Keep generated Maestro artifacts out of source unless the user asks to commit baselines or reports. Common artifact paths are `~/.maestro/tests`, `build/maestro-results`, or a `testOutputDir`.

## Debug Loop

1. Reproduce the failure with the narrowest flow or inline MCP YAML.
2. Capture artifacts: `--debug-output`, `--test-output-dir`, screenshots, `maestro.log`, and `commands-*.json`.
3. Check the hierarchy before changing selectors. If an element is missing from the hierarchy, fix app accessibility/semantics or use the platform workaround.
4. Fix the smallest issue: selector precision, wait strategy, state setup, permission setup, app ID/URL, or missing file upload.
5. Re-run the failing flow, then the tagged suite if the change touches shared subflows.

## Scripts

Use the bundled static checker before or after editing flows:

```bash
python3 .agents/skills/maestro/scripts/validate_maestro_flows.py .maestro
```

This does not replace `maestro test`; it catches common static mistakes such as YAML coercion traps and missing referenced subflow/script files.

## Update Procedure

When asked to update this skill, clone `https://github.com/mobile-dev-inc/maestro-docs` into a temporary directory, compare changed headings and command pages, update only the affected reference files, then rerun the skill validator.
