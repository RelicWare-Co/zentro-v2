DROP INDEX "restaurantArea_org_name_uidx";--> statement-breakpoint
ALTER TABLE "restaurant_area" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "restaurantArea_org_name_uidx" ON "restaurant_area" USING btree ("organization_id","name") WHERE "restaurant_area"."deleted_at" is null;