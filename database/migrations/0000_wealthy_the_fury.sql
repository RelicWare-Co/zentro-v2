CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`inviter_id` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invitation_organizationId_idx` ON `invitation` (`organization_id`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_organizationId_idx` ON `member` (`organization_id`);--> statement-breakpoint
CREATE INDEX `member_userId_idx` ON `member` (`user_id`);--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`created_at` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_unique` ON `organization` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_uidx` ON `organization` (`slug`);--> statement-breakpoint
CREATE TABLE `organization_join_link` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`token` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`label` text,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`max_uses` integer DEFAULT 1 NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	`last_used_by_user_id` text,
	`revoked_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`last_used_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_join_link_token_unique` ON `organization_join_link` (`token`);--> statement-breakpoint
CREATE INDEX `organizationJoinLink_organizationId_idx` ON `organization_join_link` (`organization_id`);--> statement-breakpoint
CREATE INDEX `organizationJoinLink_createdByUserId_idx` ON `organization_join_link` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `organizationJoinLink_lastUsedByUserId_idx` ON `organization_join_link` (`last_used_by_user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	`active_organization_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `credit_account` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`interest_rate` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_org_customer_uidx` ON `credit_account` (`organization_id`,`customer_id`);--> statement-breakpoint
CREATE TABLE `credit_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`credit_account_id` text NOT NULL,
	`sale_id` text,
	`payment_id` text,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`credit_account_id`) REFERENCES `credit_account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sale_id`) REFERENCES `sale`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_id`) REFERENCES `payment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customer` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`type` text DEFAULT 'natural' NOT NULL,
	`document_type` text,
	`document_number` text,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`address` text,
	`city` text,
	`tax_regime` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_organizationId_idx` ON `customer` (`organization_id`);--> statement-breakpoint
CREATE INDEX `customer_document_idx` ON `customer` (`document_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_org_doc_uidx` ON `customer` (`organization_id`,`document_number`);--> statement-breakpoint
CREATE TABLE `organization_module_entitlement` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`module_key` text NOT NULL,
	`status` text DEFAULT 'granted' NOT NULL,
	`updated_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `orgModuleEntitlement_organizationId_idx` ON `organization_module_entitlement` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orgModuleEntitlement_org_module_uidx` ON `organization_module_entitlement` (`organization_id`,`module_key`);--> statement-breakpoint
CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `category_organizationId_idx` ON `category` (`organization_id`);--> statement-breakpoint
CREATE TABLE `inventory_movement` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`product_id` text NOT NULL,
	`user_id` text,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inv_mov_productId_idx` ON `inventory_movement` (`product_id`);--> statement-breakpoint
CREATE TABLE `product` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`sku` text,
	`barcode` text,
	`price` integer NOT NULL,
	`cost` integer DEFAULT 0,
	`tax_rate` integer DEFAULT 0 NOT NULL,
	`is_modifier` integer DEFAULT false NOT NULL,
	`track_inventory` integer DEFAULT true NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `product_organizationId_idx` ON `product` (`organization_id`);--> statement-breakpoint
CREATE INDEX `product_categoryId_idx` ON `product` (`category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_org_barcode_uidx` ON `product` (`organization_id`,`barcode`) WHERE deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX `product_org_sku_uidx` ON `product` (`organization_id`,`sku`) WHERE deleted_at is null;--> statement-breakpoint
CREATE TABLE `cash_movement` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`type` text NOT NULL,
	`payment_method` text DEFAULT 'cash' NOT NULL,
	`amount` integer NOT NULL,
	`description` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_id`) REFERENCES `shift`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cash_mov_shiftId_idx` ON `cash_movement` (`shift_id`);--> statement-breakpoint
CREATE TABLE `shift` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`terminal_id` text,
	`terminal_name` text,
	`status` text DEFAULT 'open' NOT NULL,
	`starting_cash` integer DEFAULT 0 NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`notes` text,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shift_organizationId_idx` ON `shift` (`organization_id`);--> statement-breakpoint
CREATE TABLE `shift_closure` (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`payment_method` text NOT NULL,
	`expected_amount` integer NOT NULL,
	`actual_amount` integer NOT NULL,
	`difference` integer NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `shift`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shift_closure_shiftId_idx` ON `shift_closure` (`shift_id`);--> statement-breakpoint
CREATE TABLE `restaurant_area` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `restaurantArea_organizationId_idx` ON `restaurant_area` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `restaurantArea_org_name_uidx` ON `restaurant_area` (`organization_id`,`name`);--> statement-breakpoint
CREATE TABLE `restaurant_kitchen_ticket` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`order_id` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`sequence_number` integer NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`printed_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `restaurant_order`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `restaurantKitchenTicket_organizationId_idx` ON `restaurant_kitchen_ticket` (`organization_id`);--> statement-breakpoint
CREATE INDEX `restaurantKitchenTicket_orderId_idx` ON `restaurant_kitchen_ticket` (`order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `restaurantKitchenTicket_order_sequence_uidx` ON `restaurant_kitchen_ticket` (`order_id`,`sequence_number`);--> statement-breakpoint
CREATE TABLE `restaurant_order` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`table_id` text NOT NULL,
	`opened_by_user_id` text NOT NULL,
	`closed_by_user_id` text,
	`sale_id` text,
	`order_number` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`guest_count` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`table_id`) REFERENCES `restaurant_table`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`opened_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sale_id`) REFERENCES `sale`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `restaurantOrder_organizationId_idx` ON `restaurant_order` (`organization_id`);--> statement-breakpoint
CREATE INDEX `restaurantOrder_tableId_idx` ON `restaurant_order` (`table_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `restaurantOrder_org_number_uidx` ON `restaurant_order` (`organization_id`,`order_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `restaurantOrder_saleId_uidx` ON `restaurant_order` (`sale_id`);--> statement-breakpoint
CREATE TABLE `restaurant_order_item` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`order_id` text NOT NULL,
	`kitchen_ticket_id` text,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`tax_rate` integer DEFAULT 0 NOT NULL,
	`discount_amount` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`sent_at` integer,
	`ready_at` integer,
	`served_at` integer,
	`cancelled_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `restaurant_order`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`kitchen_ticket_id`) REFERENCES `restaurant_kitchen_ticket`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `restaurantOrderItem_organizationId_idx` ON `restaurant_order_item` (`organization_id`);--> statement-breakpoint
CREATE INDEX `restaurantOrderItem_orderId_idx` ON `restaurant_order_item` (`order_id`);--> statement-breakpoint
CREATE INDEX `restaurantOrderItem_ticketId_idx` ON `restaurant_order_item` (`kitchen_ticket_id`);--> statement-breakpoint
CREATE TABLE `restaurant_order_item_modifier` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`order_item_id` text NOT NULL,
	`modifier_product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_item_id`) REFERENCES `restaurant_order_item`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`modifier_product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `restaurantOrderItemModifier_organizationId_idx` ON `restaurant_order_item_modifier` (`organization_id`);--> statement-breakpoint
CREATE INDEX `restaurantOrderItemModifier_orderItemId_idx` ON `restaurant_order_item_modifier` (`order_item_id`);--> statement-breakpoint
CREATE TABLE `restaurant_table` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`area_id` text NOT NULL,
	`name` text NOT NULL,
	`seats` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`area_id`) REFERENCES `restaurant_area`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `restaurantTable_organizationId_idx` ON `restaurant_table` (`organization_id`);--> statement-breakpoint
CREATE INDEX `restaurantTable_areaId_idx` ON `restaurant_table` (`area_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `restaurantTable_org_area_name_uidx` ON `restaurant_table` (`organization_id`,`area_id`,`name`);--> statement-breakpoint
CREATE TABLE `payment` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`sale_id` text,
	`shift_id` text NOT NULL,
	`method` text NOT NULL,
	`reference` text,
	`amount` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sale_id`) REFERENCES `sale`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_id`) REFERENCES `shift`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payment_saleId_idx` ON `payment` (`sale_id`);--> statement-breakpoint
CREATE TABLE `sale` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`customer_id` text,
	`user_id` text NOT NULL,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`tax_amount` integer DEFAULT 0 NOT NULL,
	`discount_amount` integer DEFAULT 0 NOT NULL,
	`total_amount` integer NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_id`) REFERENCES `shift`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sale_organizationId_idx` ON `sale` (`organization_id`);--> statement-breakpoint
CREATE TABLE `sale_item` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`subtotal` integer NOT NULL,
	`tax_rate` integer DEFAULT 0 NOT NULL,
	`tax_amount` integer DEFAULT 0 NOT NULL,
	`discount_amount` integer DEFAULT 0 NOT NULL,
	`total_amount` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sale`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `saleItem_organizationId_idx` ON `sale_item` (`organization_id`);--> statement-breakpoint
CREATE TABLE `sale_item_modifier` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_item_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`modifier_product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`subtotal` integer NOT NULL,
	FOREIGN KEY (`sale_item_id`) REFERENCES `sale_item`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`modifier_product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `saleItemModifier_organizationId_idx` ON `sale_item_modifier` (`organization_id`);