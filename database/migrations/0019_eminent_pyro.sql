CREATE TABLE "product_import_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"importer_key" text NOT NULL,
	"format_version" text NOT NULL,
	"original_filename" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_hash" text NOT NULL,
	"status" text NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"valid_rows" integer DEFAULT 0 NOT NULL,
	"invalid_rows" integer DEFAULT 0 NOT NULL,
	"created_products" integer DEFAULT 0 NOT NULL,
	"created_categories" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" text,
	"created_by_email" text NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_import_row" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"row_number" integer NOT NULL,
	"source_reference" text NOT NULL,
	"source_data" jsonb NOT NULL,
	"normalized_data" jsonb,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text NOT NULL,
	"product_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_import_batch" ADD CONSTRAINT "product_import_batch_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_import_batch" ADD CONSTRAINT "product_import_batch_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_import_row" ADD CONSTRAINT "product_import_row_batch_id_product_import_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_import_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_import_row" ADD CONSTRAINT "product_import_row_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_import_batch_org_created_idx" ON "product_import_batch" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "product_import_batch_hash_idx" ON "product_import_batch" USING btree ("organization_id","file_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "product_import_row_batch_number_uidx" ON "product_import_row" USING btree ("batch_id","row_number");--> statement-breakpoint
CREATE INDEX "product_import_row_batch_status_idx" ON "product_import_row" USING btree ("batch_id","status","row_number");
