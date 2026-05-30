# ADR 0005: Design POS resilience before relying on offline writes

## Status

Proposed

## Date

2026-05-29

## Context

The Zero migration plan intentionally rejects offline writes: when Zero is disconnected, errored, or needs auth, writes are rejected. That is a sensible MVP constraint because offline financial writes are hard to reconcile safely.

For a physical POS, especially in restaurants and small shops, total dependence on connectivity is still a product risk. Cashiers expect to keep selling during short outages, print a receipt, and reconcile later. Restaurants also need kitchen continuity during local network or internet failures.

The risk is not only technical. It affects trust: a system that cannot sell during a connectivity incident may be unacceptable even if the accounting model is cleaner.

## Decision

Keep the current no-offline-writes rule for the immediate product, but design an explicit resilience path before adding features that assume always-online operation.

The resilience path should not mean arbitrary offline mutation of all data. It should define narrow, auditable contingency workflows for POS-critical actions.

The first resilience target should be local sale capture under controlled conditions:

- active shift and terminal are known before outage;
- catalog snapshot is already synced;
- payment methods available offline are restricted;
- temporary local document number is issued;
- sale is queued locally with immutable payload and idempotency key;
- receipt clearly marks pending sync or contingency state;
- reconciliation either accepts, rejects, or requires manager repair.

## Consequences

This preserves the current online-first architecture while avoiding a dead end. The product can ship with online-only writes, but the domain model should already include states for pending sync, contingency, duplicate detection, and repair.

It also prevents accidental offline complexity. Only POS-critical flows should get contingency support; organization management, settings, module toggles, and most reports should remain online-only.

## Implementation Notes

- Keep `MIGRATION_PLAN.md` no-offline-writes guidance until a dedicated contingency design is implemented.
- Add idempotency keys to sale/fiscal-document creation before building any local queue.
- Add explicit sale/document states for pending, accepted, rejected, cancelled, and contingency where legally appropriate.
- Build a local queue only for sale capture and fiscal-document contingency, not for general-purpose mutators.
- Add an operator-facing reconciliation screen before enabling offline sale capture.
- Document which payment methods are allowed during outage mode.

## Related Files

- `MIGRATION_PLAN.md`
- `src/zero/mutators.ts`
- `src/zero/mutators.server.ts`
- `server/sales/create-sale.server.ts`
- `features/pos/`
- `features/restaurants/`
