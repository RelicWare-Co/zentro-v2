# Maestro CLI, Cloud, CI, And Artifacts

## Install And Update

Prerequisite: Java 17 or newer, with `JAVA_HOME` pointing to that installation.

Install on macOS/Linux:

```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash
```

Homebrew:

```bash
brew tap mobile-dev-inc/tap
brew install mobile-dev-inc/tap/maestro
```

Update by rerunning the installer, or set `MAESTRO_VERSION` first to pin a version:

```bash
export MAESTRO_VERSION=1.39.0
curl -Ls "https://get.maestro.mobile.dev" | bash
```

Verify:

```bash
maestro --version
maestro --help
```

## Local Commands

Global pattern:

```bash
maestro [global-options] [subcommand] [subcommand-options]
```

Common global options:

- `--device` / `--udid`: target a device. Must appear before `test`.
- `--platform`: `android`, `ios`, or `web`.
- `--verbose`
- `--version`
- `--help`

Useful subcommands:

- `test`: run local flows.
- `record`: render a flow video.
- `start-device`: create/launch a supported local emulator/simulator.
- `list-devices`: list local device model/OS options.
- `list-cloud-devices`: list Maestro Cloud device model/OS pairs.
- `cloud`: upload app and flows to Maestro Cloud.
- `login` / `logout`: Cloud auth.
- `bugreport`: collect diagnostics for Maestro issues.
- `mcp`: start the Maestro MCP server.

## `maestro test`

Examples:

```bash
maestro test .maestro
maestro --device emulator-5554 test .maestro/login.yaml
maestro test --include-tags=smoke --exclude-tags=flaky .maestro
maestro test --config .maestro/ci-config.yaml .maestro
```

Important options:

- `-e`, `--env KEY=VALUE`: pass variables.
- `--include-tags`, `--exclude-tags`: comma-separated OR filters.
- `--config`: workspace config YAML.
- `--continuous`: continuous mode.
- `--format JUNIT|HTML|NOOP`: reports.
- `--output`: report destination.
- `--test-output-dir`: screenshots, videos, commands JSON, AI reports.
- `--debug-output`: logs and debug data, including `maestro.log`.
- `--flatten-debug-output`
- `--shards`, `--shard-all`, `--shard-split`: parallel local execution across already-running devices.
- Web only: `--headless`, `--screen-size=1920x1080`.
- `--analyze`: beta AI insights report; requires Cloud auth.

When both `--test-output-dir` and `--debug-output` are set to different folders, screenshots/videos/commands JSON/AI reports go to `--test-output-dir`, while `maestro.log` goes to `--debug-output`.

## Reports And Artifacts

Defaults:

- macOS/Linux: `~/.maestro/tests`
- Windows: `%userprofile%\.maestro\tests`

JUnit:

```bash
maestro test --format junit --output build/report.xml .maestro
```

HTML:

```bash
maestro test --format html --output build/report.html .maestro
maestro test --format html-detailed --output build/detailed-report.html .maestro
```

Flow-level JUnit properties:

```yaml
appId: com.example.app
name: Login Flow
properties:
  testCaseId: TC-101
  priority: High
---
- launchApp
```

## Devices And Sharding

Start devices:

```bash
maestro start-device --platform android
maestro start-device --platform ios
maestro list-devices
maestro list-cloud-devices
```

Find running local IDs:

```bash
adb devices
xcrun simctl list devices booted
```

Target one device:

```bash
maestro --device 5B6D77EF-2AE9-47D0-9A62-70A1ABBC5FA2 test flow.yaml
```

Sharding:

```bash
maestro test --shard-all 3 .maestro
maestro test --shard-split 3 .maestro
maestro test --device "emulator-5554,emulator-5556" --shard-split 2 .maestro
```

Devices must already be booted for local sharding. Include `MAESTRO_SHARD_INDEX` and `MAESTRO_DEVICE_UDID` in screenshot names to avoid collisions.

## Locales

Set locale when starting devices or in Cloud, not inside a flow or `maestro test`.

```bash
maestro start-device --platform android --device-locale fr_FR
maestro cloud --device-locale de_DE --app-file app.apk --flows .maestro
```

Locale format is lowercase ISO-639-1 language, underscore, uppercase ISO-3166-1 country. Web locale control is limited.

## Maestro Cloud

Cloud command:

```bash
maestro cloud --app-file <app-file> --flows <flow-file-or-directory>
```

Prefer named parameters:

```bash
maestro cloud \
  --api-key "$MAESTRO_CLOUD_API_KEY" \
  --project-id "$MAESTRO_PROJECT_ID" \
  --name "$UPLOAD_NAME" \
  --app-file app/build/outputs/apk/debug/app-debug.apk \
  --flows .maestro
```

Authentication and project flags:

- `--api-key`
- `--project-id`
- `MAESTRO_CLOUD_API_KEY`

Run customization:

- `--device-os`, e.g. `android-34`, `iOS-26-2`
- `--device-model`, e.g. `pixel_6`, `iPhone-17-Pro`
- `--device-locale`
- `--include-tags`, `--exclude-tags`
- `--format`, `--output`
- `--async`
- `--branch`, `--commit-sha`, `--pull-request-id`, `--repo-owner`, `--repo-name`
- `--mapping`: dSYM or ProGuard mapping.
- `--app-binary-id`: reuse an already-uploaded app binary.

Do not use deprecated `--ios-version` or `--android-api-level`; use `--device-os` and `--device-model`.

Upload the whole workspace directory when flows use `runFlow` or `runScript`.

## Cloud App Builds

Android:

- Upload APK only; `.aab` is not supported.
- Cloud uses ARM. APK must support ARM or be multi-architecture; x86-only APKs fail.
- Debug and release APKs are supported.

Typical builds:

```bash
./gradlew assembleDebug
flutter build apk --debug
```

iOS:

- Upload a Simulator `.app` bundle or zipped `.app`, not a physical-device build.

Typical builds:

```bash
xcodebuild -project MyApp.xcodeproj \
  -scheme MyApp \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  CONFIGURATION_BUILD_DIR=$PWD/build

flutter build ios --debug --simulator
```

## GitHub Actions

Use the official action:

```yaml
- uses: mobile-dev-inc/action-maestro-cloud@v2.0.2
  with:
    api-key: ${{ secrets.MAESTRO_API_KEY }}
    project-id: ${{ secrets.MAESTRO_PROJECT_ID }}
    app-file: app/build/outputs/apk/debug/app-debug.apk
    workspace: .maestro
```

Common inputs:

- Required: `api-key`, `project-id`, and either `app-file` or `app-binary-id`.
- Optional: `workspace`, `name`, `async`, `timeout`, `env`, `include-tags`, `exclude-tags`.
- Device: `device-model`, `device-os`, `device-locale`, `mapping-file`.

Pass secrets:

```yaml
env: |
  USERNAME=${{ secrets.TEST_USERNAME }}
  PASSWORD=${{ secrets.TEST_PASSWORD }}
```

Outputs require an `id`:

- `MAESTRO_CLOUD_CONSOLE_URL`
- `MAESTRO_CLOUD_APP_BINARY_ID`
- `MAESTRO_CLOUD_UPLOAD_STATUS`
- `MAESTRO_CLOUD_FLOW_RESULTS`

Statuses include `PENDING`, `PREPARING`, `INSTALLING`, `RUNNING`, `SUCCESS`, `ERROR`, `CANCELED`, `WARNING`, and `STOPPED`.

Async mode does not fail on failed tests and does not expose final result outputs.

## Environment Variables

- `MAESTRO_CLOUD_API_KEY`: Cloud auth.
- `MAESTRO_DRIVER_STARTUP_TIMEOUT`: driver startup timeout in ms. Defaults are 15000 Android and 120000 iOS in relevant contexts.
- `MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED`: disable AI analysis notice.
- `MAESTRO_CLI_NO_ANALYTICS`: disable analytics.
- `MAESTRO_DISABLE_UPDATE_CHECK`: disable update check.
- `MAESTRO_CLI_LOG_PATTERN_CONSOLE`, `MAESTRO_CLI_LOG_PATTERN_FILE`: Logback patterns.
- `MAESTRO_OPTS`: JVM options for Maestro only, e.g. proxy settings.
- `JAVA_OPTS`: JVM options for all Java apps.

Proxy examples:

```bash
MAESTRO_OPTS="-Djava.net.useSystemProxies=true" maestro login
export MAESTRO_OPTS="-Dhttps.proxyHost=myproxy.com -Dhttps.proxyPort=8080"
```

## MCP

Maestro MCP ships inside Maestro CLI. Codex can add it with:

```bash
codex mcp add maestro -- maestro mcp
```

Or configure:

```toml
[mcp_servers.maestro]
command = "maestro"
args = ["mcp"]
```

MCP tools documented by Maestro:

- `list_devices`
- `inspect_screen`
- `take_screenshot`
- `run`
- `cheat_sheet`
- `list_cloud_devices`
- `run_on_cloud`
- `get_cloud_run_status`
- `open_maestro_viewer`

For agent-driven authoring, prefer MCP inline YAML runs for exploration, then save the resulting stable flow files.
