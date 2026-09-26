ALTER TABLE "restaurant_kitchen_ticket" ADD COLUMN "print_target" text DEFAULT 'sender' NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_kitchen_ticket" ADD COLUMN "print_status" text;--> statement-breakpoint
ALTER TABLE "restaurant_kitchen_ticket" ADD COLUMN "print_claimed_by" text;--> statement-breakpoint
ALTER TABLE "restaurant_kitchen_ticket" ADD COLUMN "print_claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "restaurant_kitchen_ticket" ADD COLUMN "printed_by_terminal" text;