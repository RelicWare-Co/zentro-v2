# GHCR publish Keychain credential failure

## Symptom

`./scripts/publish-ghcr.sh` failed during GHCR login on macOS:

```txt
error saving credentials: error storing credentials - err: exit status 1, out: `The specified item already exists in the keychain. (-25299)`
```

## Root cause

The script used `docker login ghcr.io`. On macOS, Docker can route credential
storage through the `osxkeychain` helper even when the script exports a
temporary `DOCKER_CONFIG`. If a stale or duplicate GHCR credential already
exists in Keychain, Docker fails before the image build/push starts.

The first isolated-config fix exposed a second issue: Docker CLI plugins can be
installed under `~/.docker/cli-plugins`. Replacing `DOCKER_CONFIG` with a blank
temporary directory hid the Buildx plugin, causing Docker to treat `--platform`
as an unsupported root-level Docker flag.

## Solution

The publish script now creates a temporary Docker config directory, exports it
as `DOCKER_CONFIG`, links the user's `cli-plugins` directory into the temporary
config when present, writes the GHCR auth entry directly to
`${DOCKER_CONFIG}/config.json`, and runs `docker buildx build --push` using that
isolated config. It no longer runs `docker login`, so it does not invoke the
macOS Keychain credential helper, while Buildx remains available.

## Verification

Used a fake `gh`, `git`, and `docker` command harness to confirm the script:

- exports a temporary `DOCKER_CONFIG` before `docker buildx build --push`;
- preserves access to a Buildx plugin installed under `~/.docker/cli-plugins`;
- writes a temporary GHCR auth config;
- does not run `docker login`;
- runs `docker buildx build --push` with the same temporary config;
- cleans the temporary Docker config directory on exit.
