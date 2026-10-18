-- better-auth 1.7.3 reverted the `issuer` column introduced in 1.7.0-1.7.2:
-- account identity is (providerId, accountId) again and better-auth never writes
-- `issuer`. Keeping it NOT NULL makes the runtime schema check fail every
-- request with SCHEMA_MISMATCH. Drop the index before the column.
DROP INDEX "account_issuer_accountId_uidx";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "issuer";
