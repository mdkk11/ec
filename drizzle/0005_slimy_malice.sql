CREATE TYPE "public"."order_status" AS ENUM('received', 'processing', 'shipped', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"unit_price" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"line_total" bigint NOT NULL,
	CONSTRAINT "order_items_unit_price_non_negative_check" CHECK ("order_items"."unit_price" >= 0),
	CONSTRAINT "order_items_quantity_positive_check" CHECK ("order_items"."quantity" >= 1),
	CONSTRAINT "order_items_line_total_non_negative_check" CHECK ("order_items"."line_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'received' NOT NULL,
	"subtotal" bigint NOT NULL,
	"coupon_code" text,
	"discount_percent" integer,
	"discount_amount" bigint NOT NULL,
	"total" bigint NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_subtotal_non_negative_check" CHECK ("orders"."subtotal" >= 0),
	CONSTRAINT "orders_discount_percent_check" CHECK ("orders"."discount_percent" is null or "orders"."discount_percent" between 1 and 100),
	CONSTRAINT "orders_discount_amount_non_negative_check" CHECK ("orders"."discount_amount" >= 0),
	CONSTRAINT "orders_total_non_negative_check" CHECK ("orders"."total" >= 0),
	CONSTRAINT "orders_version_positive_check" CHECK ("orders"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "orders_user_created_id_idx" ON "orders" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "order_items_order_product_idx" ON "order_items" USING btree ("order_id","product_id");
