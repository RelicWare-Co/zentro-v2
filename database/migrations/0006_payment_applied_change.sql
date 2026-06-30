ALTER TABLE "payment" ADD COLUMN "applied_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "change_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "payment" SET "applied_amount" = "amount", "change_amount" = 0;--> statement-breakpoint
WITH "sale_payment_totals" AS (
  SELECT
    "payment"."sale_id",
    GREATEST(SUM("payment"."amount") - "sale"."total_amount", 0) AS "change_to_return"
  FROM "payment"
  INNER JOIN "sale" ON "sale"."id" = "payment"."sale_id"
  WHERE "payment"."sale_id" IS NOT NULL
  GROUP BY "payment"."sale_id", "sale"."total_amount"
  HAVING GREATEST(SUM("payment"."amount") - "sale"."total_amount", 0) > 0
),
"cash_payments" AS (
  SELECT
    "payment"."id",
    "payment"."amount",
    "sale_payment_totals"."change_to_return",
    COALESCE(
      SUM("payment"."amount") OVER (
        PARTITION BY "payment"."sale_id"
        ORDER BY "payment"."created_at" DESC, "payment"."id" DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ),
      0
    ) AS "preceding_cash_amount"
  FROM "payment"
  INNER JOIN "sale_payment_totals" ON "sale_payment_totals"."sale_id" = "payment"."sale_id"
  WHERE "payment"."method" = 'cash'
),
"cash_change" AS (
  SELECT
    "id",
    GREATEST(LEAST("amount", "change_to_return" - "preceding_cash_amount"), 0) AS "change_amount"
  FROM "cash_payments"
)
UPDATE "payment"
SET
  "change_amount" = "cash_change"."change_amount",
  "applied_amount" = "payment"."amount" - "cash_change"."change_amount"
FROM "cash_change"
WHERE "payment"."id" = "cash_change"."id";
