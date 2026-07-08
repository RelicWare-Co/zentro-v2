CREATE TABLE "product_ingredient" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"product_id" text NOT NULL,
	"ingredient_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "is_ingredient" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product_ingredient" ADD CONSTRAINT "product_ingredient_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ingredient" ADD CONSTRAINT "product_ingredient_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ingredient" ADD CONSTRAINT "product_ingredient_ingredient_id_product_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_ingredient_org_idx" ON "product_ingredient" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "product_ingredient_product_idx" ON "product_ingredient" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_ingredient_ingredient_idx" ON "product_ingredient" USING btree ("ingredient_id");