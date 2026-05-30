# ADR 0001: Treat fiscal documents as a core sales module

## Status

Accepted

## Date

2026-05-29

## Context

Zentro already records sales, sale items, payments, taxes, customers, credit
transactions, shifts, and printable receipts. That is enough for a basic POS
ledger, but it is not enough for fiscal, legally auditable, or
DIAN-compliant operation in Colombia.

The current `sale` model represents the commercial event: what was sold, to
whom, how it was paid, who operated the terminal, and which shift received the
money. The app can also print non-fiscal receipts from that commercial data.

Colombian fiscal operation requires a separate legal document lifecycle for
documents in the national invoicing system, including:

- electronic sales invoices (`factura electronica de venta`);
- electronic equivalent documents, especially the POS ticket equivalent
  document (`documento equivalente electronico tiquete de maquina registradora
  con sistema P.O.S.`);
- credit and debit notes derived from electronic invoices;
- adjustment notes derived from electronic equivalent documents;
- contingency and technological-incident flows;
- DIAN or provider validation/transmission evidence.

These documents are not just printable artifacts. They have regulated
generation, numbering, transmission, validation, representation, delivery,
correction, and traceability requirements. A sale can exist as an internal
commercial transaction while the fiscal document is the legal artifact derived
from that transaction.

Treating fiscal behavior as receipt formatting would spread legal rules across
POS, sales history, printing, restaurant closeout, credit, shifts, reports, and
future integrations. It would also make it hard to preserve immutable issued
totals, buyer/seller snapshots, numbering, DIAN validation state, CUFE/CUDE, QR
data, correction chains, and provider responses.

## Decision

Introduce a dedicated fiscal-document module behind the sales module instead
of extending receipts or overloading `sale`.

`sale` remains the source record for the business transaction. The fiscal
document module represents the legal document lifecycle derived from a sale,
restaurant closeout, credit event, cancellation/correction event, or other
fiscal event.

The module must not make POS, restaurants, credit, sales history, or printing
know Colombian fiscal rules directly. Those callers should ask the fiscal
module to issue, correct, retry, render, or inspect documents.

Zentro must not claim production-ready Colombian fiscal compliance until this
module supports DIAN/provider integration, numbering ranges, CUFE/CUDE, QR
data, accepted/rejected states, contingency, correction documents, and immutable
issued snapshots.

## Domain Model

The fiscal document module owns:

- fiscal document type:
  - electronic sales invoice;
  - electronic POS equivalent document;
  - credit note;
  - debit note;
  - adjustment note for equivalent document;
  - contingency/manual fallback document where applicable;
- DIAN environment:
  - habilitation/testing;
  - production/operation;
- prefix, consecutive number, full legal number, numbering authorization or
  resolution, valid range, and validity dates;
- issue, generation, transmission, validation, delivery, and correction
  timestamps;
- seller identity snapshot:
  - NIT;
  - business name;
  - tax regime/responsibilities where required;
  - establishment, branch, or point-of-sale data where applicable;
  - fiscal software/provider configuration used at issuance time;
- buyer identity snapshot:
  - document type and number;
  - name or business name;
  - email when required or available;
  - address and tax data when required by document type;
  - final-consumer fallback only where legally valid;
- immutable line snapshot:
  - product or service code;
  - description as issued;
  - quantity;
  - unit of measure;
  - unit price;
  - discounts and charges;
  - tax category/rate/amount;
  - total line amount;
- immutable fiscal totals:
  - gross subtotal;
  - discounts;
  - charges;
  - taxable bases by tax;
  - IVA;
  - impuesto nacional al consumo where applicable;
  - other taxes where applicable;
  - total payable;
  - payment means and payment terms where required;
- Colombian fiscal identifiers:
  - CUFE for electronic sales invoices;
  - CUDE for electronic equivalent documents, notes, adjustment documents, and
    other electronic instruments where applicable;
  - QR payload and DIAN lookup data where applicable;
  - digital signature/hash metadata where applicable;
- DIAN/provider lifecycle state:
  - draft;
  - number reserved;
  - generated;
  - signed;
  - transmission pending;
  - transmitted;
  - accepted;
  - rejected;
  - retry pending;
  - contingency;
  - correction required;
  - corrected;
  - voided by correction;
- transmission attempts:
  - provider or DIAN endpoint;
  - request payload reference;
  - response payload reference;
  - status code;
  - validation errors;
  - rejection reason;
  - retry count;
  - idempotency key;
  - correlation ID or track ID;
  - timestamps;
- correction chains:
  - original fiscal document;
  - derived credit/debit note;
  - derived adjustment note for equivalent document;
  - reason code;
  - affected lines/totals;
  - immutable reference to the original fiscal identifier;
- printable and digital artifacts:
  - XML or provider payload reference;
  - DIAN validation response where applicable;
  - PDF/HTML representation;
  - thermal representation;
  - email delivery artifact;
  - customer copy.

## Colombia-Specific Constraints

1. A fiscal document number must be assigned from the appropriate configured or
   authorized numbering range. Numbers are not ordinary application IDs.

2. A fiscal document, once issued and accepted/validated, must be immutable.
   Business corrections must be represented through credit notes, debit notes,
   or adjustment notes, not by mutating the original document.

3. An accepted electronic invoice must not be cancelled by deleting it or
   reusing its number. Anulment/cancellation must be modeled as a correction
   document, typically a credit note that references the original invoice.

4. CUFE and CUDE are different concepts:
   - CUFE identifies an electronic sales invoice.
   - CUDE identifies electronic documents such as notes, electronic equivalent
     documents, adjustment notes, and other derived instruments where
     applicable.

5. The system must preserve the exact data as issued. Fiscal totals must not be
   recomputed later from mutable product catalog, customer, tax, or
   configuration tables.

6. The system must distinguish between:
   - internal receipt;
   - fiscal graphic representation;
   - electronic XML/payload;
   - DIAN/provider validation response;
   - customer-facing printable copy.

7. POS must not be treated as a synonym for a non-fiscal thermal receipt. The
   electronic POS equivalent document is a fiscal electronic document; its
   graphic representation may be printed, but the legal artifact is the
   electronic document and its validation/transmission evidence.

8. The electronic POS equivalent document path must preserve buyer
   identification data when required by the applicable DIAN rules and merchant
   scenario. The data model must not assume that counter sales are always
   anonymous final-consumer receipts.

9. Contingency is a first-class state, not a generic retry error. The module
   must support technological incidents attributable to the merchant, provider,
   DIAN, or acquirer where applicable. It must record evidence, affected period,
   fallback document data, and later transmission.

10. Direct DIAN integration and provider-mediated integration must both be
   possible. Provider-specific payloads should be stored by reference and
   handled by adapters, not hardcoded into the core sales model.

11. Fiscal document generation must be server-only and transactional with sale
   creation where possible. External transmission must be resilient and
   retryable without duplicating legal documents or consuming unintended
   numbering.

12. Habilitation/testing and production/operation environments must never mix
    numbering, credentials, provider configuration, transmitted documents, or
    local artifacts.

## Architecture

The implementation should have three layers.

### Core Fiscal Domain

Owns documents, lines, statuses, numbering, snapshots, relations, correction
rules, idempotency, artifacts, and provider-neutral transmission records.

This layer should not know whether Zentro talks directly to DIAN or through a
provider.

### Fiscal Provider Adapter

Owns integration-specific payload generation, signing, transmission, status
polling, and error normalization.

Recommended interface shape:

```ts
interface FiscalProvider {
  generatePayload(input: FiscalDocumentInput): Promise<GeneratedFiscalPayload>;
  transmit(document: FiscalDocument): Promise<FiscalTransmissionResult>;
  getStatus(providerDocumentId: string): Promise<FiscalTransmissionResult>;
}
```

Provider responses should be normalized into module states while preserving raw
payloads by reference for audit and support.

### Sales Integration

`createSale`, restaurant closeout, credit correction, and sales cancellation
should call the fiscal module instead of generating fiscal data inline.

Recommended service boundary:

```ts
await fiscalDocuments.issueFromSale({
  saleId,
  documentTypePolicy: "auto",
  idempotencyKey,
});
```

The sales module records the commercial transaction. The fiscal module decides
whether a fiscal document is required, which document type applies, which
numbering range to reserve, and how transmission/correction proceeds.

## Database Implementation

Add Drizzle tables for:

- `fiscal_document`
- `fiscal_document_line`
- `fiscal_numbering_range`
- `fiscal_transmission_attempt`
- `fiscal_document_artifact`
- `fiscal_document_relation`
- `fiscal_provider_config`
- `fiscal_contingency_event`

### `fiscal_document`

Recommended fields:

- `id`
- `organization_id`
- `sale_id`
- `customer_id`
- `location_id`
- `terminal_id`
- `shift_id`
- `document_type`
- `environment`
- `status`
- `prefix`
- `sequence_number`
- `full_number`
- `numbering_range_id`
- `issue_timestamp`
- `generation_timestamp`
- `transmission_timestamp`
- `validation_timestamp`
- `delivery_timestamp`
- `seller_snapshot_json`
- `buyer_snapshot_json`
- `line_totals_json`
- `tax_totals_json`
- `monetary_totals_json`
- `payment_snapshot_json`
- `cufe`
- `cude`
- `qr_payload`
- `dian_lookup_url`
- `provider_name`
- `provider_document_id`
- `provider_track_id`
- `validation_response_ref`
- `idempotency_key`
- `created_at`
- `updated_at`

### `fiscal_document_line`

Recommended fields:

- `id`
- `fiscal_document_id`
- `sale_item_id`
- `line_number`
- `item_code`
- `description`
- `quantity`
- `unit_measure`
- `unit_price`
- `discount_amount`
- `charge_amount`
- `tax_category`
- `tax_rate`
- `taxable_base`
- `tax_amount`
- `line_total`
- `snapshot_json`

### `fiscal_numbering_range`

Recommended fields:

- `id`
- `organization_id`
- `document_type`
- `environment`
- `prefix`
- `from_number`
- `to_number`
- `current_number`
- `resolution_number`
- `resolution_date`
- `valid_from`
- `valid_until`
- `technical_key_or_provider_metadata`
- `active`

### `fiscal_transmission_attempt`

Recommended fields:

- `id`
- `fiscal_document_id`
- `attempt_number`
- `provider_name`
- `endpoint`
- `request_ref`
- `response_ref`
- `http_status`
- `status`
- `provider_status`
- `dian_status`
- `error_code`
- `error_message`
- `validation_errors_json`
- `started_at`
- `finished_at`
- `next_retry_at`
- `created_at`

### `fiscal_document_artifact`

Recommended fields:

- `id`
- `fiscal_document_id`
- `artifact_type`
- `storage_ref`
- `content_type`
- `sha256`
- `created_at`

Examples: `xml`, `provider_payload`, `validation_response`, `pdf`, `html`,
`thermal`, `email`.

### `fiscal_document_relation`

Recommended fields:

- `id`
- `source_document_id`
- `target_document_id`
- `relation_type`
- `reason_code`
- `reason_description`
- `created_at`

Examples:

- invoice -> credit note
- invoice -> debit note
- equivalent document -> adjustment note
- contingency fallback -> transmitted electronic document

### `fiscal_provider_config`

Recommended fields:

- `id`
- `organization_id`
- `environment`
- `provider_name`
- `software_id`
- `provider_account_id`
- `credentials_ref`
- `certificate_ref`
- `settings_json`
- `active`
- `created_at`
- `updated_at`

### `fiscal_contingency_event`

Recommended fields:

- `id`
- `organization_id`
- `environment`
- `cause`
- `provider_name`
- `started_at`
- `ended_at`
- `evidence_ref`
- `notes`
- `created_at`
- `updated_at`

## Generation Flow

1. `createSale` records the commercial transaction.
2. The fiscal module determines whether a fiscal document is required.
3. The fiscal module selects the document type:
   - electronic sales invoice;
   - electronic POS equivalent document;
   - non-fiscal receipt only.
4. The fiscal module reserves numbering atomically.
5. The fiscal module snapshots buyer, seller, lines, taxes, totals, and payment
   data.
6. The fiscal module generates the provider-neutral fiscal document record.
7. The provider adapter generates, signs, and/or prepares the external payload.
8. The provider adapter transmits or records contingency state where applicable.
9. The fiscal module records accepted, rejected, retry, pending, or contingency
   state.
10. Printing and email use fiscal document artifacts when a fiscal document
    exists; they use raw sale data only for non-fiscal receipts.

## Idempotency

Fiscal document creation must require an idempotency key based on:

- sale id;
- organization id;
- document type;
- correction target if applicable;
- operation type.

Retries must not create duplicate legal documents or consume additional
numbering unless a new fiscal operation is intentionally created.

## Sales Cancellation And Correction

Updating a sale to `cancelled` must not be the only operation once a fiscal
document exists.

If the sale has no fiscal document, cancellation can remain an internal sale
state change.

If the sale has an issued fiscal document, cancellation must create the
corresponding fiscal correction flow:

- credit note for electronic invoice;
- adjustment note for electronic equivalent document;
- relation to original document;
- immutable reason;
- transmission/validation lifecycle for the correction document.

## Operational UI

Add an admin/operations view for:

- pending fiscal documents;
- rejected documents;
- accepted documents;
- contingency documents;
- numbering ranges near exhaustion;
- expired or soon-to-expire numbering ranges;
- provider/DIAN transmission failures;
- documents requiring manual review;
- documents with missing buyer data;
- correction chains.

## Reporting

Reports should distinguish:

- commercial sale date;
- fiscal issue date;
- fiscal validation date;
- payment date;
- cancellation/correction date;
- fiscal document status.

Revenue reports may use sales data for operational analytics, but fiscal/audit
reports must use issued fiscal document snapshots.

## Implementation Sequence

1. Add provider-neutral schema, enums/constants, and migrations for fiscal
   documents, lines, numbering ranges, artifacts, relations, provider config,
   transmission attempts, and contingency events.
2. Add the server-only fiscal module with idempotent `issueFromSale` and
   provider-neutral document creation.
3. Wire POS sale creation to create a non-transmitted fiscal document snapshot
   behind a feature/config flag.
4. Wire restaurant closeout through the same `issueFromSale` path.
5. Add correction flow support for sale cancellation.
6. Add provider adapter boundary and one sandbox/habilitation adapter.
7. Add operational UI for document status, retries, rejections, numbering
   ranges, and correction chains.
8. Add production provider/DIAN configuration only after habilitation/testing
   and artifact rendering are complete.

## Consequences

This creates a deeper module, but it isolates legal/fiscal complexity behind a
single interface. POS, restaurants, sales history, credit, shifts, reports, and
printing can depend on the fiscal-document module instead of each caller
learning Colombian fiscal rules.

The implementation cost is higher than printing receipts from sales, but it
avoids a high-risk retrofit after real fiscal sales exist. Retrofitting fiscal
identity, numbering, CUFE/CUDE, DIAN validation state, and correction chains
after production usage would be migration-heavy and legally risky.

The app should continue to support non-fiscal receipts for demos, internal
testing, and merchants/scenarios where electronic transmission is not yet
configured. However, the domain model must not assume that a printed receipt is
the final legal artifact.

## Legal References

- DIAN Resolucion 165 de 2023:
  <https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0165_2023.htm>
- DIAN Resolucion 227 de 2025, as the compiled tax regulatory reference for
  DIAN rules:
  <https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0227_2025.htm>
- DIAN microsite for `Documento Equivalente Electronico`, especially POS
  electronic equivalent document guidance:
  <https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documento-equivalente-electronico/>

These references are legal/product inputs, not a substitute for final review by
a Colombian tax/electronic-invoicing specialist before production launch.

## Related Files

- `database/drizzle/schema/sales.schema.ts`
- `database/drizzle/schema/customer.schema.ts`
- `database/drizzle/schema/pos.schema.ts`
- `database/drizzle/schema/restaurant.schema.ts`
- `database/drizzle/schema/credit.schema.ts`
- `server/sales/create-sale.server.ts`
- `server/sales/cancel-sale.server.ts`
- `server/restaurants/restaurant-mutations.server.ts`
- `features/pos/printing/`
- `features/restaurants/`
- `features/sales/`
- `features/credit/`
- `server/fiscal-documents/`
- `database/drizzle/schema/fiscal-documents.schema.ts`
