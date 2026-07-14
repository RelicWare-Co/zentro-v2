ALTER TABLE "restaurant_order_item" ADD COLUMN "sent_product_name" text;--> statement-breakpoint
UPDATE "restaurant_order_item" AS item
SET "sent_product_name" = item_product."name"
FROM "product" AS item_product
WHERE item_product."id" = item."product_id"
  AND item."kitchen_ticket_id" IS NOT NULL;
