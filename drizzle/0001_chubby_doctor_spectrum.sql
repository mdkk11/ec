CREATE TYPE "public"."user_role" AS ENUM('customer', 'admin');--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_format_check" CHECK ("sessions"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "sessions_expiration_check" CHECK ("sessions"."expires_at" > "sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_normalized_check" CHECK ("users"."email" = lower(btrim("users"."email"))),
	CONSTRAINT "users_email_length_check" CHECK (char_length("users"."email") between 1 and 254),
	CONSTRAINT "users_password_hash_not_empty_check" CHECK (char_length("users"."password_hash") > 0)
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");