# Product import concurrency and pipeline boundary

## Symptom

Concurrent commits for different files in one organization could create
duplicate categories. Concurrent files sharing an SKU could leave one batch as
`failed` instead of `invalid`. Passthrough products also discarded enabled
auto-payout values before organization payment-method validation.

## Root cause

The advisory lock included the file hash, so it serialized only duplicate-file
commits instead of all catalog writes performed by the importer for an
organization. The shared product normalizer also disabled auto payout when the
accounting treatment was `passthrough`, which was the inverse of the product
form's domain rule. Separately, adapters returned persistence-oriented rows and
the canonical document schema was never enforced by the orchestrator.

## Solution

- Serialize product-import commits with a transaction-scoped advisory lock
  derived from the organization ID, then revalidate under that lock.
- Preserve auto payout for non-ingredient passthrough products so enabled
  payment methods are checked.
- Require adapters to return `ProductImportDocumentV1` plus a one-to-one source
  row mapping, and validate both at the orchestration boundary.
- Make template filename and MIME type importer capabilities instead of XLSX
  constants in the REST/client download path.
- Render detail-query errors with retry and keep history filters visible for
  empty filtered results.

## Verification

- Integration tests use two independent PostgreSQL connections for concurrent
  category and SKU commits.
- Added payment-method, barcode isolation, unexpected rollback, and hash
  idempotency coverage.
- Focused Playwright verifies REST authorization, template headers, import
  completion, and the empty-history filter state.
- `bun run check`, `bunx tsc --noEmit`, `bun run test`, and `bun run build` pass.
