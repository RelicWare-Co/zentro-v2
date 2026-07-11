ALTER TABLE "restaurant_order" ADD COLUMN "cancelled_by_user_id" text;--> statement-breakpoint
ALTER TABLE "restaurant_order" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "restaurant_order" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "restaurant_order" ADD CONSTRAINT "restaurant_order_cancelled_by_user_id_user_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;