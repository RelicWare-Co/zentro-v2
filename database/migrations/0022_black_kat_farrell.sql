CREATE INDEX "product_import_batch_created_idx" ON "product_import_batch" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "product_import_batch_actor_created_idx" ON "product_import_batch" USING btree ("created_by_user_id","created_at");--> statement-breakpoint
CREATE INDEX "sale_createdAt_idx" ON "sale" USING btree ("created_at");