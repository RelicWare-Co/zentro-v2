# Thermal printing throws `Unknown codepage mapping` on Star printers after encoder v4

## Symptom

`@point-of-sale/receipt-printer-encoder` 3.0.3 → 4.0.1. Typecheck passed, but
encoding a receipt for `star-prnt` threw:

```text
Error: Unknown codepage mapping
  at new ReceiptPrinterEncoder (...receipt-printer-encoder.mjs:3877)
```

`star-line` failed differently: `TypeError: undefined is not an object
(evaluating 'Object.keys(this.#codepageMapping)')`.

## Cause

v4 validates `codepageMapping` against a per-language table
(`codepageMappings[language][mapping]`). Only `esc-pos` exposes vendor
mappings; `star-prnt` accepts just `star`; `star-line` has no table at all and
the option must be **omitted** — passing `undefined` still triggers
`Object.keys(undefined)` when no `codepageCandidates` are set.

`encode-thermal-receipt.client.ts` defaulted every language to `"epson"`, so any
Star printer would have failed at print time (hardware-only path, not covered by
tests).

## Solution

- Added `resolveCodepageMapping(language, value)` in
  `features/pos/printing/encode-thermal-receipt.client.ts`:
  - `esc-pos` → whitelist of v4 mapping names, fallback `epson` (the settings
    field is free text, so typos degrade instead of throwing);
  - `star-prnt` → `star`;
  - `star-line` → `undefined`, and the `codepageMapping` key is spread
    conditionally so the option is absent.
- Deleted the ambient encoder declaration in `types/pos-printer.d.ts`: v4 ships
  its own types. The declarations for `-status`, `webserial` and `webbluetooth`
  remain.

## Verification

- Smoke test over 4 layout combinations (80/58 mm × normal/large) × 3 languages:
  all encode to bytes, plus drawer pulse.
- `bunx tsc --noEmit` and `bun run check` pass.

## Follow-up

v4 changes the emitted bytes (no redundant style commands, no line feed after
state-only lines, tables validated against paper width). Reprint one real ticket
on 58 mm and 80 mm ESC/POS and Star hardware before promoting.
