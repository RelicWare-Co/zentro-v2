ALTER TABLE "product" ADD COLUMN "accounting_treatment" text DEFAULT 'revenue' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "auto_payout_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "auto_payout_payment_method" text DEFAULT 'cash' NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD COLUMN "source_type" text;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD COLUMN "source_sale_id" text;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "pass_through_subtotal" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "pass_through_tax_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "pass_through_total_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_item" ADD COLUMN "accounting_treatment" text DEFAULT 'revenue' NOT NULL;--> statement-breakpoint
CREATE INDEX "cash_mov_sourceSaleId_idx" ON "cash_movement" USING btree ("source_sale_id");