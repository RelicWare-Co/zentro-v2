ALTER TABLE "restaurant_kitchen_ticket_line" ADD COLUMN "previous_quantity" integer;--> statement-breakpoint
ALTER TABLE "restaurant_kitchen_ticket_line" ADD COLUMN "previous_notes" text;--> statement-breakpoint
ALTER TABLE "restaurant_kitchen_ticket_line" ADD COLUMN "previous_modifiers_snapshot" text;