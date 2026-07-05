# Vike client Zero provider boundary

## Symptom

Publishing the production Docker image failed during `bun run build` in
`deploy/app/Dockerfile`.

Vike rejected `pages/+Layout.tsx` because it imported
`zero/zero-provider-gate.client.tsx` from the server-side build.

## Root cause

`ZeroProviderGate` is correctly marked as a client-only module because it uses
browser runtime behavior for Zero cache configuration. The shared Vike layout
imported it statically, so the SSR build graph included a `.client` module.

## Solution

`pages/+Layout.tsx` now uses a small dynamic-import wrapper that loads
`ZeroProviderGate` after mount. Public menu pages still bypass Zero entirely.

## Verification

Re-run `bun run build` and the Docker publish flow.
