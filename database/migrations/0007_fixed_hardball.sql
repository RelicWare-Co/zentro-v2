CREATE TABLE "pedido" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" text,
	"sale_id" text,
	"accepted_by_user_id" text,
	"order_number" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"fulfillment" text DEFAULT 'takeaway' NOT NULL,
	"source" text DEFAULT 'web' NOT NULL,
	"contact_name" text,
	"contact_phone" text,
	"delivery_address" text,
	"delivery_notes" text,
	"notes" text,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pedido_item" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"tax_rate" integer DEFAULT 0 NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_order_id_pedido_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."pedido"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pedido_organizationId_idx" ON "pedido" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "pedido_status_idx" ON "pedido" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "pedido_org_number_uidx" ON "pedido" USING btree ("organization_id","order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "pedido_saleId_uidx" ON "pedido" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "pedidoItem_organizationId_idx" ON "pedido_item" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "pedidoItem_orderId_idx" ON "pedido_item" USING btree ("order_id");