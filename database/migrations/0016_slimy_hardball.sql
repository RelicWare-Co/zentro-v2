CREATE TABLE "restaurant_kitchen_ticket_line" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"kitchen_ticket_id" text NOT NULL,
	"order_item_id" text NOT NULL,
	"operation" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"notes" text,
	"modifiers_snapshot" text DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "restaurant_kitchen_ticket" ADD COLUMN "kind" text DEFAULT 'initial' NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_order_item" ADD COLUMN "pending_cancellation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_order_item" ADD COLUMN "sent_modifiers_snapshot" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_order_item" ADD COLUMN "sent_notes" text;--> statement-breakpoint
ALTER TABLE "restaurant_order_item" ADD COLUMN "sent_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "restaurant_order_item" AS item
SET
  "sent_quantity" = item."quantity",
  "sent_notes" = item."notes",
  "sent_modifiers_snapshot" = COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', modifier."modifier_product_id",
          'name', modifier_product."name",
          'quantity', modifier."quantity",
          'unitPrice', modifier."unit_price"
        )
        ORDER BY modifier."id"
      )::text
FROM "restaurant_order_item_modifier" AS modifier
      INNER JOIN "product" AS modifier_product
        ON modifier_product."id" = modifier."modifier_product_id"
      WHERE modifier."order_item_id" = item."id"
    ),
    '[]'
  )
WHERE item."kitchen_ticket_id" IS NOT NULL;--> statement-breakpoint
INSERT INTO "restaurant_kitchen_ticket_line" (
  "id",
  "organization_id",
  "kitchen_ticket_id",
  "order_item_id",
  "operation",
  "product_name",
  "quantity",
  "notes",
  "modifiers_snapshot",
  "status",
  "created_at",
  "updated_at"
)
SELECT
  CONCAT('backfill-', md5(ticket."id" || ':' || item."id")),
  item."organization_id",
  ticket."id",
  item."id",
  'prepare',
  item_product."name",
  item."quantity",
  item."notes",
  item."sent_modifiers_snapshot",
  CASE
    WHEN item."status" IN ('sent', 'ready', 'served') THEN item."status"
    ELSE 'cancelled'
  END,
  ticket."created_at",
  ticket."updated_at"
FROM "restaurant_kitchen_ticket" AS ticket
INNER JOIN "restaurant_order_item" AS item
  ON item."kitchen_ticket_id" = ticket."id"
INNER JOIN "product" AS item_product
  ON item_product."id" = item."product_id";--> statement-breakpoint
ALTER TABLE "restaurant_kitchen_ticket_line" ADD CONSTRAINT "rktl_org_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_kitchen_ticket_line" ADD CONSTRAINT "rktl_ticket_fk" FOREIGN KEY ("kitchen_ticket_id") REFERENCES "public"."restaurant_kitchen_ticket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_kitchen_ticket_line" ADD CONSTRAINT "rktl_order_item_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."restaurant_order_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "restaurantKitchenTicketLine_ticketId_idx" ON "restaurant_kitchen_ticket_line" USING btree ("kitchen_ticket_id");--> statement-breakpoint
CREATE INDEX "restaurantKitchenTicketLine_itemId_idx" ON "restaurant_kitchen_ticket_line" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "restaurantKitchenTicketLine_organizationId_idx" ON "restaurant_kitchen_ticket_line" USING btree ("organization_id");
