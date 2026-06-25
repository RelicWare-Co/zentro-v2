# GHCR publish Keychain credential failure

## Symptom

`./scripts/publish-ghcr.sh` failed during GHCR login on macOS:

```txt
error saving credentials: error storing credentials - err: exit status 1, out: `The specified item already exists in the keychain. (-25299)`
```

## Root cause

The script used the default Docker configuration for `docker login ghcr.io`.
On macOS, that configuration can route credential storage through the
`osxkeychain` helper. If a stale or duplicate GHCR credential already exists in
Keychain, Docker fails before the image build/push starts.

## Solution

The publish script now creates a temporary Docker config directory, exports it
as `DOCKER_CONFIG`, performs the GHCR login there, and runs `docker buildx build
--push` using that isolated config. The temporary directory is removed on exit,
so the script no longer writes GHCR credentials to the user's global Docker
config or Keychain.

## Verification

Used a fake `gh`, `git`, and `docker` command harness to confirm the script:

- exports a temporary `DOCKER_CONFIG` before `docker login`;
- runs `docker buildx build --push` with the same temporary config;
- cleans the temporary Docker config directory on exit.
