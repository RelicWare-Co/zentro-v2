#!/usr/bin/env bash
set -euo pipefail

# Build and publish the production app image for Bunny Magic Containers.
# Authentication comes from the active GitHub CLI session; the token is never
# written to stdout or stored in this repository. Docker credentials are written
# only to a temporary Docker config directory for this publish run.
#
# Usage:
#   bun run docker:publish
#   GHCR_IMAGE=ghcr.io/acme/zentro-app bun run docker:publish
#   PUBLISH_LATEST=true bun run docker:publish

fail() {
  echo "[ERROR] $*" >&2
  exit 1
}

docker_config_dir=""
cleanup() {
  if [[ -n "$docker_config_dir" && -d "$docker_config_dir" ]]; then
    rm -rf "$docker_config_dir"
  fi
}
trap cleanup EXIT

command -v gh >/dev/null || fail "GitHub CLI (gh) is required."
command -v docker >/dev/null || fail "Docker is required."
docker buildx version >/dev/null 2>&1 || fail "Docker Buildx is required."
auth_status="$(gh auth status --hostname github.com 2>&1)" \
  || fail "Log in with: gh auth login"
if [[ "$auth_status" == *"Token scopes:"* && "$auth_status" != *"write:packages"* ]]; then
  fail "The active gh token needs write:packages. Run: gh auth refresh -h github.com -s write:packages"
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" \
  || fail "Run this script from a Git repository."
cd "$repo_root"

if [[ -n "$(git status --porcelain)" ]]; then
  fail "Commit or stash local changes before publishing a commit-tagged image."
fi

repository="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')" \
  || fail "Could not determine the GitHub repository."
owner="${repository%%/*}"
owner="$(printf '%s' "$owner" | tr '[:upper:]' '[:lower:]')"

image="${GHCR_IMAGE:-ghcr.io/${owner}/zentro-app}"
commit_sha="$(git rev-parse HEAD)"
tag="${GHCR_TAG:-sha-${commit_sha}}"

if [[ "$tag" == "latest" ]]; then
  fail "GHCR_TAG must be immutable; use PUBLISH_LATEST=true to add latest."
fi

tags=(--tag "${image}:${tag}")
if [[ "${PUBLISH_LATEST:-false}" == "true" ]]; then
  tags+=(--tag "${image}:latest")
fi

echo "[INFO] Publishing ${image}:${tag} for linux/amd64"
if [[ "${PUBLISH_LATEST:-false}" == "true" ]]; then
  echo "[INFO] Also publishing ${image}:latest"
fi

docker_config_dir="$(mktemp -d)"
export DOCKER_CONFIG="$docker_config_dir"

gh auth token --hostname github.com \
  | docker login ghcr.io --username "$owner" --password-stdin

docker buildx build \
  --platform linux/amd64 \
  --file deploy/app/Dockerfile \
  "${tags[@]}" \
  --push \
  .

echo "[INFO] Published ${image}:${tag}"
