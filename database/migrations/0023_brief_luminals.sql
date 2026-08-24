-- better-auth 1.7: account identity is scoped by issuer.
-- Safe order per https://better-auth.com/docs/guides/upgrading-to-v1-7
-- 1) add nullable column, 2) backfill, 3) enforce NOT NULL, 4) unique index.
ALTER TABLE "account" ADD COLUMN "issuer" text;
--> statement-breakpoint
UPDATE "account"
SET "issuer" = CASE
	WHEN "provider_id" = 'credential' THEN 'local:credential'
	ELSE 'local:oauth:' || "provider_id"
END
WHERE "issuer" IS NULL;
--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" USING btree ("issuer","account_id");
