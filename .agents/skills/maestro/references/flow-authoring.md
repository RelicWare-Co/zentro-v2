# Maestro Flow Authoring

## YAML Anatomy

A flow is a YAML document with an optional configuration header, a required `---` separator for full flows, and a command list:

```yaml
appId: com.example.app
name: Login smoke
tags:
  - smoke
env:
  USERNAME: ${USERNAME || "guest"}
---
- launchApp:
    clearState: true
- tapOn: Username
- inputText: ${USERNAME}
- tapOn:
    text: Login
    enabled: true
- assertVisible: Dashboard
```

For web tests, use `url:` instead of `appId:`:

```yaml
url: http://localhost:3000
---
- launchApp
- assertVisible: Login
```

Subflows can be headerless when called from a parent flow, but top-level flows should be runnable alone.

## Selectors

Most commands accept either a text shorthand or a selector map. Selector maps combine fields with AND logic.

Core selectors:

- `text`: visible text or accessibility label. Regex-based by default.
- `id`: Android resource ID, iOS accessibility identifier, React Native `testID`, Flutter semantics identifier.
- `index`: zero-based occurrence when several elements match.
- `point`: `"50%,50%"` or `"100,200"`; prefer percentages.
- `css`: web only; normal CSS selector, not regex.

State selectors:

- `enabled`, `checked`, `focused`, `selected`: booleans.

Relational selectors:

- `above`, `below`, `leftOf`, `rightOf`: based on screen bounds; combine with other fields for precision.
- `containsChild`, `childOf`: direct accessibility tree relationships.
- `containsDescendants`: match a container with several descendants at any depth.

Traits and dimensions:

- `traits: text`, `traits: long-text`, `traits: square`.
- `width`, `height`, `tolerance`: useful only when combined with better anchors.

Selector strategy:

- Prefer user-visible text for stable product copy.
- Prefer IDs for icons, translated strings, duplicated text, and dynamic content.
- Use stable anchors with relational selectors for generic repeated controls.
- Use regex intentionally, e.g. `".*Continue.*"`, and escape regex metacharacters when matching literals.
- Verify state before action, e.g. `tapOn: { id: submit_button, enabled: true }`.

## Waits And Stability

Use assertions as waits. `assertVisible` and `assertNotVisible` poll for up to the default short timeout before failing.

Use `extendedWaitUntil` when the app legitimately needs longer:

```yaml
- extendedWaitUntil:
    visible: Payment Confirmed
    timeout: 30000
```

Use `waitForAnimationToEnd` when the element exists but is still moving:

```yaml
- waitForAnimationToEnd:
    timeout: 5000
```

For ignored taps on newly rendered UI, add `retryTapIfNoChange: true` to the `tapOn` step. Do not hide real flakiness by wrapping broad flow sections in `retry`.

## Control Flow

Use `when` for conditional execution. Conditions include `visible`, `notVisible`, `platform` (`Android`, `iOS`, `Web`), and `true` JavaScript expressions.

```yaml
- runFlow:
    when:
      platform: Android
      visible: Allow Notifications
    commands:
      - tapOn: Allow
```

Use `repeat` for fixed or conditional loops. Combine `times` and `while` to avoid infinite loops:

```yaml
- repeat:
    times: 10
    while:
      visible: Update available
    commands:
      - tapOn: Dismiss
      - assertNotVisible: Dismiss
```

Use `retry` only for a small flaky operation. `maxRetries` is limited to `0` through `3`; broad retries hide product bugs.

## Subflows

Use `runFlow` for reusable login, navigation, setup, teardown, and platform branches:

```yaml
- runFlow:
    file: subflows/login.yaml
    env:
      USER_ROLE: admin
```

Inline subflows are good for small conditional groups:

```yaml
- runFlow:
    label: Dismiss optional promo modal
    when:
      visible: Not now
    commands:
      - tapOn: Not now
```

For Cloud execution, upload the workspace folder containing the parent flow, subflows, scripts, and `config.yaml`. A single-file upload may fail to include dependencies.

## Variables And JavaScript

Variables come from CLI `-e KEY=value`, shell env vars prefixed with `MAESTRO_`, the flow `env:` block, or a parent `runFlow.env`. Subflow constants override parent parameters with the same name.

Built-ins:

- `MAESTRO_FILENAME`
- `MAESTRO_DEVICE_UDID`
- `MAESTRO_SHARD_ID` (starts at 1)
- `MAESTRO_SHARD_INDEX` (starts at 0)

Use JavaScript in three tiers:

- Inline expression: `inputText: ${'user_' + Date.now()}`
- One-line state: `evalScript: ${output.auth.email = 'test@example.com'}`
- External script: `runScript: scripts/create_user.js`

Useful globals:

- `output`: persistent object across the flow. Namespace it, e.g. `output.auth.token`.
- `maestro.copiedText`: value from `copyTextFrom` or `setClipboard`.
- `maestro.platform`: `ios`, `android`, or `web`.
- `faker`: DataFaker wrapper for generated names, emails, numbers, and placeholder data.
- `http`: JavaScript HTTP client with `get`, `post`, `put`, `delete`, and `request`.
- `json(response.body)`: parse response bodies.

Logging:

- `console.log` goes to `maestro.log` with `JsConsole`.
- Multiple arguments are not supported; concatenate or use template literals in external `.js`.
- Do not use template literals inside `evalScript`; use string concatenation.

## Hooks

Define `onFlowStart` and `onFlowComplete` above `---` for per-flow setup and cleanup:

```yaml
appId: com.example.app
onFlowStart:
  - runFlow: subflows/login.yaml
onFlowComplete:
  - runFlow: subflows/logout.yaml
---
- launchApp
```

Keep hooks fast. Avoid hook subflows that trigger the same hook recursively. If `onFlowStart` fails, the main flow is skipped but `onFlowComplete` still runs. If `onFlowComplete` fails, the flow fails even if the body passed.

## Tags, Discovery, And Config

By default, pointing `maestro test` at a folder runs only YAML files at that folder's root. Use `config.yaml` `flows:` patterns for subdirectories:

```yaml
flows:
  - "*"
  - "auth/*"
  - "tests/**"
includeTags:
  - smoke
excludeTags:
  - flaky
testOutputDir: build/maestro-results
executionOrder:
  continueOnFailure: false
  flowsOrder:
    - signup
    - verify_email
platform:
  ios:
    snapshotKeyHonorModalViews: false
    disableAnimations: true
  android:
    disableAnimations: true
```

Tag filters use OR inside each flag (`--include-tags auth,checkout`). Combining include and exclude applies include first, then removes excluded flows. CLI flags override `config.yaml`.

Use `executionOrder` sparingly. Maestro normally runs flows non-deterministically to encourage isolation. If there is a true dependency, prefer nesting the required setup with `runFlow`.

## YAML Gotchas

- Quote `YES`, `NO`, `ON`, `OFF`, `Y`, `N` and similar values; YAML may coerce them to booleans.
- Escape literal dollar signs in visible text: `- assertVisible: \$150 in Cash`.
- Quote strings containing `:` or leading `{`, `[`, `*`, `&`, `!`, `#`, or `@`.
- Android `inputText` supports ASCII only. Use paste/clipboard or app-side test fixtures for Unicode scenarios.
- Use labels on sensitive or opaque steps, but do not assume labels redact raw debug logs.
