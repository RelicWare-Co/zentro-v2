# ADR 0004: Expand modules beyond navigation and settings flags

## Status

Proposed

## Date

2026-05-29

## Context

The module system currently defines a registry with the restaurants module. The module interface exposes activation policy, entitlement status, enablement, flags, and navigation entries.

That is useful for showing or hiding UI, but it is too shallow for a product intended to grow through vertical modules. Future modules will need permissions, workflows, report contributions, data exposure rules, settings schema, seed data, hardware capabilities, and integration points.

If each module adds those through ad hoc imports into core files, the registry will become a label catalog rather than a real extension mechanism.

## Decision

Evolve the module interface into a product-module contract.

Modules should not own arbitrary application wiring, but they should declare their contribution points in one place so the core can ask each enabled module what it contributes.

The module contract should eventually support:

- settings schema and default settings;
- navigation entries;
- permission/action declarations;
- route/page contributions where appropriate;
- report cards or dashboard contributions;
- domain capability flags consumed by core flows;
- hardware or printing capabilities;
- onboarding/setup requirements;
- seed/demo data;
- integration requirements.

The registry should remain explicit and statically imported. Avoid dynamic plugin loading until there are at least two or three real modules proving what needs to vary.

## Consequences

This gives maintainers more locality: module behavior is discoverable from the module definition instead of spread across layout, settings, permissions, dashboard, and server mutators.

It also prevents premature abstraction. The module interface should grow only when a second module needs the same kind of contribution. One adapter is a hypothetical seam; two adapters make the seam real.

## Implementation Notes

- Keep `features/modules/module-definition.ts` as the public module interface.
- Add new fields only when the restaurants module and another module both need them.
- Introduce permission/action declarations before adding more manager-only checks directly inside feature mutators.
- Move module settings defaults into module definitions when the settings shape grows.
- Consider module-owned setup checks so modules can declare incomplete configuration states.

## Related Files

- `features/modules/module-definition.ts`
- `features/modules/module-registry.ts`
- `features/restaurants/restaurants.module.ts`
- `features/settings/settings.shared.ts`
- `server/modules/set-entitlement.server.ts`
