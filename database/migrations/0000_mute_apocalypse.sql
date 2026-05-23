CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp with time zone NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "organization_join_link" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"token" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"label" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"last_used_by_user_id" text,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "organization_join_link_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_account" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"interest_rate" integer DEFAULT 0,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"credit_account_id" text NOT NULL,
	"sale_id" text,
	"payment_id" text,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"type" text DEFAULT 'natural' NOT NULL,
	"document_type" text,
	"document_number" text,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"city" text,
	"tax_regime" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_module_entitlement" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"module_key" text NOT NULL,
	"status" text DEFAULT 'granted' NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movement" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"product_id" text NOT NULL,
	"user_id" text,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"category_id" text,
	"name" text NOT NULL,
	"sku" text,
	"barcode" text,
	"price" integer NOT NULL,
	"cost" integer DEFAULT 0,
	"tax_rate" integer DEFAULT 0 NOT NULL,
	"is_modifier" boolean DEFAULT false NOT NULL,
	"track_inventory" boolean DEFAULT true NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_movement" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"shift_id" text NOT NULL,
	"type" text NOT NULL,
	"payment_method" text DEFAULT 'cash' NOT NULL,
	"amount" integer NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"terminal_id" text,
	"terminal_name" text,
	"status" text DEFAULT 'open' NOT NULL,
	"starting_cash" integer DEFAULT 0 NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "shift_closure" (
	"id" text PRIMARY KEY NOT NULL,
	"shift_id" text NOT NULL,
	"payment_method" text NOT NULL,
	"expected_amount" integer NOT NULL,
	"actual_amount" integer NOT NULL,
	"difference" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_area" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_kitchen_ticket" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"order_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"sequence_number" integer NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"printed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "restaurant_order" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"table_id" text NOT NULL,
	"opened_by_user_id" text NOT NULL,
	"closed_by_user_id" text,
	"sale_id" text,
	"order_number" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"guest_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "restaurant_order_item" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"order_id" text NOT NULL,
	"kitchen_ticket_id" text,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"tax_rate" integer DEFAULT 0 NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"served_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "restaurant_order_item_modifier" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"order_item_id" text NOT NULL,
	"modifier_product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_table" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"area_id" text NOT NULL,
	"name" text NOT NULL,
	"seats" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"sale_id" text,
	"shift_id" text NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"shift_id" text NOT NULL,
	"customer_id" text,
	"user_id" text NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"total_amount" integer NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_item" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"subtotal" integer NOT NULL,
	"tax_rate" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_item_modifier" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_item_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"modifier_product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"subtotal" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_join_link" ADD CONSTRAINT "organization_join_link_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_join_link" ADD CONSTRAINT "organization_join_link_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_join_link" ADD CONSTRAINT "organization_join_link_last_used_by_user_id_user_id_fk" FOREIGN KEY ("last_used_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_account" ADD CONSTRAINT "credit_account_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_account" ADD CONSTRAINT "credit_account_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_credit_account_id_credit_account_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."credit_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_module_entitlement" ADD CONSTRAINT "org_mod_ent_org_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_module_entitlement" ADD CONSTRAINT "org_mod_ent_upd_by_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_closure" ADD CONSTRAINT "shift_closure_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_area" ADD CONSTRAINT "restaurant_area_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_kitchen_ticket" ADD CONSTRAINT "restaurant_kitchen_ticket_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_kitchen_ticket" ADD CONSTRAINT "restaurant_kitchen_ticket_order_id_restaurant_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."restaurant_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_kitchen_ticket" ADD CONSTRAINT "restaurant_kitchen_ticket_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_order" ADD CONSTRAINT "restaurant_order_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_order" ADD CONSTRAINT "restaurant_order_table_id_restaurant_table_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_table"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_order" ADD CONSTRAINT "restaurant_order_opened_by_user_id_user_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_order" ADD CONSTRAINT "restaurant_order_closed_by_user_id_user_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_order" ADD CONSTRAINT "restaurant_order_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_order_item" ADD CONSTRAINT "restaurant_order_item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_order_item" ADD CONSTRAINT "restaurant_order_item_order_id_restaurant_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."restaurant_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_order_item" ADD CONSTRAINT "restaurant_order_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_order_item" ADD CONSTRAINT "roi_kitchen_ticket_fk" FOREIGN KEY ("kitchen_ticket_id") REFERENCES "public"."restaurant_kitchen_ticket"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_order_item_modifier" ADD CONSTRAINT "roim_org_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_order_item_modifier" ADD CONSTRAINT "roim_order_item_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."restaurant_order_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_order_item_modifier" ADD CONSTRAINT "roim_product_fk" FOREIGN KEY ("modifier_product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_table" ADD CONSTRAINT "restaurant_table_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_table" ADD CONSTRAINT "restaurant_table_area_id_restaurant_area_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."restaurant_area"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item_modifier" ADD CONSTRAINT "sale_item_modifier_sale_item_id_sale_item_id_fk" FOREIGN KEY ("sale_item_id") REFERENCES "public"."sale_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item_modifier" ADD CONSTRAINT "sale_item_modifier_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item_modifier" ADD CONSTRAINT "sale_item_modifier_modifier_product_id_product_id_fk" FOREIGN KEY ("modifier_product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organizationJoinLink_organizationId_idx" ON "organization_join_link" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organizationJoinLink_createdByUserId_idx" ON "organization_join_link" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "organizationJoinLink_lastUsedByUserId_idx" ON "organization_join_link" USING btree ("last_used_by_user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_org_customer_uidx" ON "credit_account" USING btree ("organization_id","customer_id");--> statement-breakpoint
CREATE INDEX "customer_organizationId_idx" ON "customer" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "customer_document_idx" ON "customer" USING btree ("document_number");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_org_doc_uidx" ON "customer" USING btree ("organization_id","document_number");--> statement-breakpoint
CREATE INDEX "orgModuleEntitlement_organizationId_idx" ON "organization_module_entitlement" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orgModuleEntitlement_org_module_uidx" ON "organization_module_entitlement" USING btree ("organization_id","module_key");--> statement-breakpoint
CREATE INDEX "category_organizationId_idx" ON "category" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "inv_mov_productId_idx" ON "inventory_movement" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_organizationId_idx" ON "product" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "product_categoryId_idx" ON "product" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_org_barcode_uidx" ON "product" USING btree ("organization_id","barcode") WHERE deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "product_org_sku_uidx" ON "product" USING btree ("organization_id","sku") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "cash_mov_shiftId_idx" ON "cash_movement" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "shift_organizationId_idx" ON "shift" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "shift_closure_shiftId_idx" ON "shift_closure" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "restaurantArea_organizationId_idx" ON "restaurant_area" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurantArea_org_name_uidx" ON "restaurant_area" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "restaurantKitchenTicket_organizationId_idx" ON "restaurant_kitchen_ticket" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "restaurantKitchenTicket_orderId_idx" ON "restaurant_kitchen_ticket" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurantKitchenTicket_order_sequence_uidx" ON "restaurant_kitchen_ticket" USING btree ("order_id","sequence_number");--> statement-breakpoint
CREATE INDEX "restaurantOrder_organizationId_idx" ON "restaurant_order" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "restaurantOrder_tableId_idx" ON "restaurant_order" USING btree ("table_id");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurantOrder_org_number_uidx" ON "restaurant_order" USING btree ("organization_id","order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurantOrder_saleId_uidx" ON "restaurant_order" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "restaurantOrderItem_organizationId_idx" ON "restaurant_order_item" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "restaurantOrderItem_orderId_idx" ON "restaurant_order_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "restaurantOrderItem_ticketId_idx" ON "restaurant_order_item" USING btree ("kitchen_ticket_id");--> statement-breakpoint
CREATE INDEX "restaurantOrderItemModifier_organizationId_idx" ON "restaurant_order_item_modifier" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "restaurantOrderItemModifier_orderItemId_idx" ON "restaurant_order_item_modifier" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "restaurantTable_organizationId_idx" ON "restaurant_table" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "restaurantTable_areaId_idx" ON "restaurant_table" USING btree ("area_id");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurantTable_org_area_name_uidx" ON "restaurant_table" USING btree ("organization_id","area_id","name");--> statement-breakpoint
CREATE INDEX "payment_saleId_idx" ON "payment" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_organizationId_idx" ON "sale" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "saleItem_organizationId_idx" ON "sale_item" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "saleItemModifier_organizationId_idx" ON "sale_item_modifier" USING btree ("organization_id");