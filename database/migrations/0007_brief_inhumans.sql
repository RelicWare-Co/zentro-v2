ALTER TABLE "restaurant_order" DROP CONSTRAINT "restaurant_order_table_id_restaurant_table_id_fk";
--> statement-breakpoint
ALTER TABLE "restaurant_order" ALTER COLUMN "table_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_order" ADD CONSTRAINT "restaurant_order_table_id_restaurant_table_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_table"("id") ON DELETE set null ON UPDATE no action;