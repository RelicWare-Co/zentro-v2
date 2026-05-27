# Maestro Command Catalog

Use this as a compact syntax reminder. When in doubt, call Maestro MCP `cheat_sheet`, run `maestro <subcommand> --help`, or check the official command page.

## App, Device, And Navigation

- `launchApp`: launch the app or web URL. Map form supports `appId`, `clearState`, `clearKeychain`, `stopApp`, `permissions`, and `arguments`.
  ```yaml
  - launchApp:
      clearState: true
      clearKeychain: true
      permissions:
        all: deny
        camera: allow
      arguments:
        featureFlag: true
  ```
- `stopApp`: stop the app without clearing state. Optional shorthand app ID.
- `killApp`: mobile only; simulate process death. Optional `appId`. No effect for web.
- `clearState`: reset app data/cache/preferences. Android uses package clear; iOS reinstalls the app; web clears origin data.
- `clearKeychain`: iOS only; clears Keychain. Can also use `launchApp.clearKeychain`.
- `openLink`: open URL or deeplink. Map fields: `link`, Android `autoVerify`, Android `browser`.
- `back`: Android and web only.
- `pressKey`: `home`, `lock`, `enter`, `backspace`, `volume up`, `volume down`, Android `back`, `power`, `tab`, and Android TV remote keys.
- `setOrientation`: mobile only; `PORTRAIT`, `LANDSCAPE_LEFT`, `LANDSCAPE_RIGHT`, `UPSIDE_DOWN`.
- `setLocation`: `latitude`, `longitude`. Android requires API 31+; Cloud IP geolocation remains US-based.
- `travel`: simulate a route with `points` and `speed`.
- `setAirplaneMode`: Android only, `enabled` or `disabled`; passes with no effect on iOS/web.
- `toggleAirplaneMode`: Android only; passes with no effect on iOS/web.

## Permissions

- `launchApp.permissions` and `setPermissions` can set `allow`, `deny`, or `unset`.
- `setPermissions` fields: `appId` and `permissions`.
- Cross-platform names include `calendar`, `camera`, `contacts`, `location`, `medialibrary`, `microphone`, and `notifications`.
- Android-only examples include `bluetooth`, `phone`, `sms`, `storage`, and full Android permission IDs.
- iOS-only examples include `homekit`, `motion`, `photos`, `reminders`, `siri`, `speech`, `usertracking`.
- iOS granular values: `location: always|inuse|never`, `photos: limited`.

```yaml
- setPermissions:
    appId: com.example.app
    permissions:
      all: deny
      location: inuse
      notifications: allow
```

## Input And Gestures

- `tapOn`: text shorthand or selector map. Interaction fields include `point`, `repeat`, `delay`, `retryTapIfNoChange`, `waitToSettleTimeoutMs`, `label`, and `optional`.
- `doubleTapOn`: text or selector map; optional `delay`.
- `longPressOn`: same selector model as `tapOn`; long press is about 3 seconds.
- `inputText`: string or `{ text, label }`. Works even if no field is focused, but target focus explicitly when possible.
- Random input commands: `inputRandomEmail`, `inputRandomPersonName`, `inputRandomNumber`, `inputRandomText`, `inputRandomCityName`, `inputRandomCountryName`, `inputRandomColorName`. `inputRandomNumber` and `inputRandomText` support `length`.
- `eraseText`: no args removes up to 50 chars; numeric arg removes up to 100. For large text, select all then `eraseText: 1`.
- `hideKeyboard`: no-op on web. On iOS it can be layout-sensitive; tapping a safe non-input area is often more reliable.
- `copyTextFrom`: selector; stores value in `maestro.copiedText`.
- `setClipboard`: set Maestro's internal clipboard to a string or expression.
- `pasteText`: paste from Maestro's internal clipboard into focused element. It does not read the native system clipboard.

```yaml
- tapOn:
    id: submit_button
    enabled: true
    retryTapIfNoChange: true
- setClipboard: ${'user' + Date.now() + '@example.com'}
- tapOn:
    id: email
- pasteText
```

## Scrolling And Swiping

- `scroll`: simple vertical scroll, equivalent to an upward swipe.
- `scrollUntilVisible`: fields: `element`, `direction` (`DOWN`, `UP`, `LEFT`, `RIGHT`), `timeout` default 20000, `speed` 0-100 default 40, `visibilityPercentage` default 100, `centerElement`.
- `swipe`: use `direction`, or `start`/`end`, or `from` selector plus `direction`. Optional `duration`, `waitToSettleTimeoutMs`.

```yaml
- scrollUntilVisible:
    element:
      id: ".*settings"
    direction: DOWN
    centerElement: true
- swipe:
    start: 90%, 50%
    end: 10%, 50%
```

Use percentages instead of pixels. For scrollable fragments or bottom sheets, use `repeat` with targeted `swipe` from a coordinate inside the scrollable region.

## Assertions And Waits

- `assertVisible`: selector or text shorthand. Auto-waits for the default short window.
- `assertNotVisible`: selector or text shorthand. Auto-waits for disappearance.
- `assertTrue`: expression shorthand or `{ condition, label }`.
- `extendedWaitUntil`: `{ visible|notVisible, timeout }` for long waits.
- `waitForAnimationToEnd`: optional `timeout` default 15000; succeeds when timeout is reached even if animation continues.
- `assertScreenshot`: visual regression against `path`; optional `cropOn`, `thresholdPercentage` default 95, `label`.
- `assertWithAI`: experimental visual natural language assertion. Fields: `assertion`, `optional`; optional defaults to true.
- `assertNoDefectsWithAI`: experimental visual defect scan. `optional` defaults to true.
- `extractTextWithAI`: experimental screenshot text extraction. Fields: `query`, `outputVariable` default `aiOutput`, `optional` default true.

```yaml
- assertVisible:
    text: Continue
    enabled: true
- assertTrue:
    condition: ${output.total > 0}
    label: Cart total is positive
- assertScreenshot:
    path: checkout-summary.png
    cropOn:
      id: summary_panel
    thresholdPercentage: 98
```

AI commands require Maestro Cloud authentication. Prefer conventional selectors/assertions when possible.

## Composition And Scripting

- `runFlow`: shorthand path or map with `file`, `env`, `commands`, `label`; supports `when`.
- `runScript`: shorthand JS path or map with `file`, `env`. Paths are relative to the calling flow. Cloud requires uploading the directory containing scripts.
- `evalScript`: one-line JavaScript expression, usually assigning to `output`.
- `repeat`: fields `times`, `while`, `commands`.
- `retry`: fields `maxRetries` 0-3 and either `commands` or `file`.

```yaml
- runScript:
    file: scripts/create_user.js
    env:
      role: admin
- runFlow:
    file: subflows/login.yaml
    env:
      EMAIL: ${output.auth.email}
- repeat:
    times: 3
    while:
      notVisible: Done
    commands:
      - tapOn: Next
```

## Media, Evidence, And Artifacts

- `addMedia`: list of workspace-relative media files. Supports PNG, JPEG, JPG, GIF, MP4.
- `takeScreenshot`: shorthand path or map with `path`, `cropOn`, `label`. Path is relative to the Maestro workspace.
- `startRecording`: shorthand path or map with `path`, `label`, `optional`. Must pair with `stopRecording`.
- `stopRecording`: no args; does not fail if no recording is active.

```yaml
- addMedia:
    - ./assets/avatar.png
- takeScreenshot:
    path: LoginScreen
    cropOn:
      id: login_form
- startRecording: checkout
- stopRecording
```

## Shared Fields

Many commands accept:

- `label`: human-readable report text; use for intent and sensitive inputs.
- `optional: true`: continue on failure. Standard commands default false; AI commands default true.
- `when`: conditional execution on commands that support it, especially `runFlow`.

Use `optional` for non-critical one-off UI only. For readable branching with multiple commands, use `runFlow.when`.
