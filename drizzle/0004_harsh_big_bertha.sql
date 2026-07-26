CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"discount_percent" integer NOT NULL,
	"minimum_subtotal" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_active" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_normalized_check" CHECK ("coupons"."code" = upper(btrim("coupons"."code"))),
	CONSTRAINT "coupons_code_not_empty_check" CHECK (char_length("coupons"."code") > 0),
	CONSTRAINT "coupons_discount_percent_check" CHECK ("coupons"."discount_percent" between 1 and 100),
	CONSTRAINT "coupons_minimum_subtotal_non_negative_check" CHECK ("coupons"."minimum_subtotal" >= 0),
	CONSTRAINT "coupons_period_check" CHECK ("coupons"."starts_at" < "coupons"."ends_at")
);
--> statement-breakpoint
ALTER TABLE "carts" ADD COLUMN "coupon_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_unique" ON "coupons" USING btree ("code");--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;