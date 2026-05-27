# Platforms And Troubleshooting

## Android

Maestro drives Android through ADB and the accessibility/display stack. It tests the installed app from outside the process; no test APK or app instrumentation is required.

App ID:

- Use the package name from `AndroidManifest.xml`.
- Find installed IDs with `adb shell pm list packages | grep <name>`.

Selector mapping:

- `text`: view text, hint text, and content description.
- `id`: Android resource ID.
- For Jetpack Compose, expose stable IDs with `Modifier.semantics { testTagsAsResourceId = true }` when using test tags as resource IDs.
- For icons/image buttons, set `contentDescription` and target with `text`.

State:

- `clearState` is equivalent to clearing package data.
- `launchApp.clearState: true` gives a clean start.
- Android physical devices need USB debugging enabled.

Known issues:

- Android `inputText` does not support Unicode input.
- Some physical devices fail `clearState` until Developer Settings disables "Verify apps over USB" or enables "Disable permission monitoring".
- Some Redmi devices may need "Reset to default values" tapped several times in Developer Settings, then "Disable permission monitoring".
- For inaccessible WebView content, add `androidWebViewHierarchy: devtools` at the top of the flow:
  ```yaml
  androidWebViewHierarchy: devtools
  ---
  - tapOn: Open WebView
  - assertVisible: My button
  ```

## iOS

Maestro drives iOS through Xcode Simulator tooling and the accessibility layer. Local physical iOS devices are not supported.

App ID:

- Use the bundle ID.
- Find installed IDs with `xcrun simctl listapps booted | grep CFBundleIdentifier`.

Selector mapping:

- `text`: visible text and `accessibilityLabel`.
- `id`: `accessibilityIdentifier`; this is the best stable selector for non-text UI.

SwiftUI:

- Prefer `.accessibilityIdentifier("stable_id")` for icons, custom controls, localized text, and refactor-resistant flows.
- Use Studio or hierarchy inspection to see how nested SwiftUI resolves.
- Wheel pickers and merged toggle/text accessibility can expose surprising hierarchy shapes.

UIKit:

- Button titles and labels are visible text.
- Use `accessibilityIdentifier` for reliable IDs.
- Use `scrollUntilVisible` for `UITableView` and `UICollectionView` instead of manual coordinates.

Known issues:

- `hideKeyboard` can be flaky because iOS has no native hide-keyboard API. Tap a safe non-input area if needed.
- Pagination in `UITableView` / `UICollectionView` can be triggered unexpectedly by XCTest hierarchy queries. App code should ensure `willDisplayCell` loads data only for actually visible index paths.
- First deep-link launch can show an iOS security confirmation. Handle it conditionally:
  ```yaml
  - openLink:
      link: awesomeapp://settings
  - runFlow:
      when:
        visible: 'Open in "Awesome App"'
      commands:
        - tapOn: Open
  ```

## React Native

Maestro supports React Native through native accessibility.

Selectors:

- Use visible text for stable copy.
- Use `testID` for stable IDs:
  ```jsx
  <TextInput testID="username_input" />
  ```
  ```yaml
  - tapOn:
      id: username_input
  ```

Expo:

- Expo Go cannot be launched with the app's own ID because the app runs inside Expo. Use `openLink: exp://...`.
- Standalone/EAS builds use normal `launchApp` with package/bundle ID.

iOS nested components:

- If touches are swallowed, set outer wrappers `accessible={false}` and inner tappable components `accessible={true}` so the intended element appears in the accessibility tree.

## Flutter

Maestro uses Flutter Semantics, not widget internals.

Selectors:

- `text`: visible text or `semanticLabel`.
- `id`: Flutter semantics `identifier` in Flutter 3.19+.
- Flutter Keys are not exposed to Maestro; do not rely on them.

Examples:

```dart
Icon(Icons.add, semanticLabel: 'fabAddIcon')
```

```dart
Semantics(
  identifier: 'login_button',
  child: ElevatedButton(onPressed: login, child: Text('Sign In')),
)
```

Flutter Web:

- Maestro Web can test Flutter Web, but Flutter renders to canvas and must enable semantics:
  ```dart
  import 'package:flutter/rendering.dart';

  void main() {
    WidgetsFlutterBinding.ensureInitialized();
    SemanticsBinding.instance.ensureSemantics();
    runApp(const MyApp());
  }
  ```

## Web

Maestro Web is beta and uses managed Chromium. Use `url:` instead of `appId:`.

```yaml
url: http://localhost:3000
---
- launchApp
- tapOn: Sign in
- assertVisible: Dashboard
```

Notes:

- Same YAML commands work across mobile and web where supported.
- `css` selectors are web-only and are not regex.
- `clearState` clears browser data by origin.
- Browser state is retained between flows in the same run unless cleared.
- Current web support is Chromium-focused. Some localization and viewport behavior is constrained; use CLI `--headless` and `--screen-size` when available.
- `hideKeyboard`, `killApp`, `setOrientation`, and mobile OS commands are no-ops or unsupported on web as documented per command.

For `zentro-v2`, run the app with `bun run dev`, read the printed URL, and write web flows against that URL. If the test needs backend sync, also start required services such as Postgres or Zero according to repo instructions.

## Debugging Checklist

For element not found:

1. Reproduce with a minimal flow.
2. Inspect the hierarchy or use Maestro MCP `inspect_screen`.
3. Confirm the target text/ID exists in the accessibility tree, not just visually.
4. Try a more precise selector: combine `id`, `text`, `enabled`, `below`, or `containsDescendants`.
5. If hierarchy is missing, add app-side accessibility labels/IDs/semantics or use the platform-specific workaround.

For flakiness:

1. Replace fixed sleeps or broad retries with `assertVisible`, `assertNotVisible`, or `extendedWaitUntil`.
2. Add `waitForAnimationToEnd` for moving UI.
3. Use `retryTapIfNoChange` on a single early tap.
4. Reset state with `launchApp.clearState`, `clearKeychain`, seeded backend data, or a setup subflow.
5. Avoid sequence dependencies between top-level flows.

For app not launching:

- Verify app install and exact package/bundle ID.
- Android: `adb shell pm list packages`.
- iOS: `xcrun simctl listapps booted`.
- Web: verify the URL is reachable outside Maestro first.

For missing files in Cloud:

- Upload the folder containing flows, `config.yaml`, subflows, media, and scripts.
- Use relative paths in `runFlow`, `runScript`, `addMedia`, screenshots, and baselines.

For CLI or environment failures:

- Verify Java 17 or 21.
- Increase driver startup timeout if CI machines are slow:
  ```bash
  export MAESTRO_DRIVER_STARTUP_TIMEOUT=180000
  ```
- Use `maestro bugreport` for issues to report upstream.

For WSL2 Android emulator:

- Prefer native Windows/macOS/Linux if possible.
- If using WSL2, bridge ADB to the Windows host, set `ADB_SERVER_SOCKET=tcp:<WINDOWS_IPV4_ADDR>:5037`, confirm `adb devices`, then run Maestro with the correct host/device settings.

## AI Features

AI analysis and AI assertions require Maestro Cloud authentication (`maestro login` or `MAESTRO_CLOUD_API_KEY`). A free Cloud account is enough for AI commands, but Cloud test execution requires a Cloud plan.

Use:

- `maestro test flow.yaml --analyze` for AI insights.
- `assertWithAI` for hard-to-model visual state checks.
- `assertNoDefectsWithAI` for visual smoke checks.
- `extractTextWithAI` for text embedded in images or unknown dynamic content.

AI commands are experimental and default to optional in many cases. Set `optional: false` only when you accept probabilistic failure risk in that environment.
