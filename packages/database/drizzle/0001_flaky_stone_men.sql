CREATE TABLE "ai_prompt_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"task_type" varchar(50) NOT NULL,
	"system_prompt" text NOT NULL,
	"user_prompt_template" text NOT NULL,
	"input_schema" jsonb NOT NULL,
	"output_schema" jsonb NOT NULL,
	"model_preference" varchar(100) DEFAULT 'gpt-4o-mini' NOT NULL,
	"temperature" numeric(3, 2) DEFAULT '0.10' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_attribute_dictionary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_attribute_name" varchar(150) NOT NULL,
	"canonical_key" varchar(100) NOT NULL,
	"category_scope" varchar(100) DEFAULT 'GLOBAL',
	"unit_type" varchar(50),
	"standard_unit" varchar(20),
	"conversion_multiplier" numeric(12, 6) DEFAULT '1.000000',
	"data_type" varchar(30) DEFAULT 'string' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_merge_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_global_product_id" uuid NOT NULL,
	"source_global_product_id" uuid NOT NULL,
	"merged_by_user_id" uuid,
	"merge_reason" varchar(255) NOT NULL,
	"merge_confidence" numeric(3, 2) NOT NULL,
	"snapshot_state" jsonb NOT NULL,
	"is_reversed" boolean DEFAULT false NOT NULL,
	"reversed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translations_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"source_language" varchar(10) NOT NULL,
	"target_language" varchar(10) NOT NULL,
	"original_text" text NOT NULL,
	"translated_text" text NOT NULL,
	"model_used" varchar(100) DEFAULT 'deterministic_dictionary' NOT NULL,
	"character_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_merge_history" ADD CONSTRAINT "product_merge_history_target_global_product_id_global_products_id_fk" FOREIGN KEY ("target_global_product_id") REFERENCES "public"."global_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_merge_history" ADD CONSTRAINT "product_merge_history_merged_by_user_id_users_id_fk" FOREIGN KEY ("merged_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_apt_slug_version" ON "ai_prompt_templates" USING btree ("slug","version");--> statement-breakpoint
CREATE INDEX "idx_apt_task_active" ON "ai_prompt_templates" USING btree ("task_type","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pad_raw_scope" ON "product_attribute_dictionary" USING btree ("raw_attribute_name","category_scope");--> statement-breakpoint
CREATE INDEX "idx_pad_canonical" ON "product_attribute_dictionary" USING btree ("canonical_key");--> statement-breakpoint
CREATE INDEX "idx_pmh_target" ON "product_merge_history" USING btree ("target_global_product_id");--> statement-breakpoint
CREATE INDEX "idx_pmh_source" ON "product_merge_history" USING btree ("source_global_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tc_hash_lang" ON "translations_cache" USING btree ("content_hash","source_language","target_language");