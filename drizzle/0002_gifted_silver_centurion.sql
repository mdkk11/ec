CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" integer NOT NULL,
	"image_path" text NOT NULL,
	"is_published" boolean NOT NULL,
	"stock" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_non_negative_check" CHECK ("products"."price" >= 0),
	CONSTRAINT "products_stock_non_negative_check" CHECK ("products"."stock" >= 0),
	CONSTRAINT "products_version_positive_check" CHECK ("products"."version" >= 1)
);
