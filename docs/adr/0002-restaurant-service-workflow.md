# ADR 0002: Model restaurant service as a workflow, not only table orders

## Status

Proposed

## Date

2026-05-29

## Context

The restaurants module already has meaningful foundations: areas, tables, open orders, order items, item modifiers, kitchen tickets, kitchen board states, and closeout into a sale.

That model covers a simple restaurant flow, but a real restaurant operation has workflows that are not represented yet: assigning a server, moving a table, joining or splitting checks, splitting by seat, handling service charges or tips, holding and firing courses, voiding items with reasons, routing items to preparation stations, measuring kitchen timing, and supporting dine-in, pickup, and delivery.

If these capabilities are added as isolated flags and buttons around the current table order model, restaurant logic will become shallow and scattered across UI, mutators, kitchen display, sale closeout, and reports.

## Decision

Deepen the restaurants module around a restaurant service workflow.

The central concept should be a service session: a durable workflow that may be attached to a table, channel, server, guests/seats, checks, courses, kitchen tickets, and final sale documents.

Tables remain layout resources. Orders/items remain part of the workflow. Closing a restaurant session into one or more sales should be an explicit operation, not the only shape the workflow can take.

The restaurant service workflow should own:

- service channel: dine-in, pickup, delivery, counter, or future channels;
- table assignment, table move, merge, and transfer history;
- server assignment and handoff history;
- checks, seats, split/merge behavior, and per-check payments;
- item lifecycle with draft, held, sent, preparing, ready, served, voided, and comped states;
- kitchen routing by station and ticket timing;
- service charge, tip, and discount policy;
- closeout into one or more sales and fiscal documents.

## Consequences

This keeps restaurant-specific complexity local to the restaurants module while still reusing the shared sales, payments, fiscal document, inventory, and shift modules.

It also avoids making `restaurant_order` a catch-all table that later needs incompatible meanings. The existing schema can evolve, but new behavior should be expressed as workflow transitions with audit history rather than direct mutable state only.

The initial implementation can still expose a simple table-first UI, but the model should not block split checks, table moves, or non-table channels.

## Implementation Notes

- Add a service session/check model before implementing split payments or table moves.
- Add explicit transition mutators for moving table, merging sessions, splitting checks, assigning server, voiding item, holding item, firing item, and closing checks.
- Add reason codes for voids, comps, discounts, and manager overrides.
- Add kitchen stations and item routing so KDS is not only a flat ticket board.
- Ensure restaurant closeout calls the same sales/fiscal-document module used by the POS.

## Related Files

- `database/drizzle/schema/restaurant.schema.ts`
- `server/restaurants/restaurant-mutations.server.ts`
- `features/restaurants/`
- `features/pos/`
- `server/sales/create-sale.server.ts`
