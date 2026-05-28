#!/usr/bin/env bash
# Local Playwright E2E run (headed, 1 worker).
#
# Usage:
#   ./scripts/e2e-playwright-run.sh              # full suite
#   ./scripts/e2e-playwright-run.sh --smoke    # @smoke only
#   FRESH=1 ./scripts/e2e-playwright-run.sh      # new bootstrap user/org
#
# Optional creds: copy .env.example → .env.playwright.local and fill PLAYWRIGHT_*.
# Without creds, global-setup creates playwright/.auth/e2e-bootstrap.json.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.playwright.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.playwright.local
  set +a
fi

SMOKE=0
FRESH_RUN="${FRESH:-${PLAYWRIGHT_E2E_FRESH:-0}}"
PLAYWRIGHT_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --smoke)
      SMOKE=1
      ;;
    --fresh)
      FRESH_RUN=1
      ;;
    *)
      PLAYWRIGHT_ARGS+=("$arg")
      ;;
  esac
done

echo "→ Postgres (docker compose up -d)"
docker compose up -d

echo "→ Playwright Chromium (skip if already installed)"
bunx playwright install chromium

if [[ "$FRESH_RUN" == "1" ]]; then
  echo "→ Removing bootstrap creds (FRESH=1 / --fresh)"
  rm -f playwright/.auth/e2e-bootstrap.json
fi

CMD=(bunx playwright test --headed --workers=1)
if [[ "$SMOKE" == "1" ]]; then
  CMD+=(--grep @smoke)
fi
if ((${#PLAYWRIGHT_ARGS[@]} > 0)); then
  CMD+=("${PLAYWRIGHT_ARGS[@]}")
fi

echo "→ ${CMD[*]}"
exec "${CMD[@]}"
