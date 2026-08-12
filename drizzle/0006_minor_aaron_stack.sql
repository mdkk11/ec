CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"display_order" integer NOT NULL,
	CONSTRAINT "categories_slug_format_check" CHECK ("categories"."slug" ~ '^[a-z]+(-[a-z]+)*$'),
	CONSTRAINT "categories_display_order_positive_check" CHECK ("categories"."display_order" >= 1)
);
--> statement-breakpoint
INSERT INTO "categories" ("id", "name", "slug", "display_order") VALUES
	('40000000-0000-4000-8000-000000000001', '衣類', 'clothing', 10),
	('40000000-0000-4000-8000-000000000002', 'バッグ・服飾小物', 'bags-accessories', 20),
	('40000000-0000-4000-8000-000000000003', 'シューズ', 'shoes', 30),
	('40000000-0000-4000-8000-000000000004', 'ホーム・生活雑貨', 'home-living', 40),
	('40000000-0000-4000-8000-000000000005', 'その他', 'other', 90);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "category_id" uuid;--> statement-breakpoint
UPDATE "products" SET "category_id" = '40000000-0000-4000-8000-000000000005' WHERE "category_id" IS NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "category_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_unique" ON "categories" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_display_order_unique" ON "categories" USING btree ("display_order");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id");
