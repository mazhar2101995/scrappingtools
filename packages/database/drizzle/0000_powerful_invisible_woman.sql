CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_prefix" varchar(16) NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"permissions" jsonb DEFAULT '["read", "write"]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_prefix_unique" UNIQUE("key_prefix")
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"plan_tier" varchar(50) DEFAULT 'standard' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"full_name" varchar(255) NOT NULL,
	"avatar_url" varchar(1000),
	"is_superadmin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "brand_scraping_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"source_website_id" uuid NOT NULL,
	"profile_version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"selector_config" jsonb NOT NULL,
	"pagination_config" jsonb DEFAULT '{}'::jsonb,
	"anti_bot_strategy" varchar(50) DEFAULT 'playwright_stealth',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"normalized_name" varchar(255) NOT NULL,
	"official_website" text,
	"logo_url" text,
	"country_of_origin" varchar(3),
	"is_verified" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_normalized_name_unique" UNIQUE("normalized_name")
);
--> statement-breakpoint
CREATE TABLE "source_product_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_website_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"source_product_id" varchar(255),
	"canonical_product_id" uuid,
	"raw_title" text NOT NULL,
	"raw_description" text,
	"raw_price" numeric(14, 4),
	"raw_currency" varchar(3) DEFAULT 'USD',
	"raw_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw_identifiers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw_images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"html_snapshot_uri" text,
	"last_scraped_at" timestamp with time zone NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_websites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255) NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"trust_score" numeric(3, 2) DEFAULT '0.85' NOT NULL,
	"country" varchar(3) DEFAULT 'USA',
	"rate_limit_per_minute" integer DEFAULT 60,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_websites_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "global_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"canonical_title" varchar(500) NOT NULL,
	"model_number" varchar(255),
	"normalized_model" varchar(255),
	"category_path" varchar(500),
	"standardized_description" text,
	"primary_image_url" text,
	"confidence_score" numeric(3, 2) DEFAULT '1.00' NOT NULL,
	"verification_status" varchar(50) DEFAULT 'unverified' NOT NULL,
	"sources_count" integer DEFAULT 1 NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"global_product_id" uuid NOT NULL,
	"product_variant_id" uuid,
	"attribute_key" varchar(100) NOT NULL,
	"raw_value" text NOT NULL,
	"normalized_value" text NOT NULL,
	"unit" varchar(30),
	"data_type" varchar(30) DEFAULT 'string' NOT NULL,
	"source_website_id" uuid,
	"confidence" numeric(3, 2) DEFAULT '1.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"global_product_id" uuid NOT NULL,
	"product_variant_id" uuid,
	"id_type" varchar(30) NOT NULL,
	"id_value" varchar(100) NOT NULL,
	"normalized_value" varchar(100) NOT NULL,
	"source_website_id" uuid,
	"confidence" numeric(3, 2) DEFAULT '1.00' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"global_product_id" uuid NOT NULL,
	"product_variant_id" uuid,
	"origin_url" text NOT NULL,
	"storage_uri" text NOT NULL,
	"image_hash" varchar(64) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"width" integer,
	"height" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"global_product_id" uuid NOT NULL,
	"variant_name" varchar(255) NOT NULL,
	"sku" varchar(255),
	"color" varchar(100),
	"size" varchar(100),
	"weight_grams" numeric(10, 2),
	"dimensions_cm" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"global_product_id" uuid NOT NULL,
	"field_name" varchar(100) NOT NULL,
	"current_value" text NOT NULL,
	"source_website_id" uuid NOT NULL,
	"source_product_listing_id" uuid NOT NULL,
	"confidence" numeric(3, 2) DEFAULT '1.00' NOT NULL,
	"last_corroborated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"change_count" integer DEFAULT 1 NOT NULL,
	"is_stale" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_review_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_product_listing_id" uuid NOT NULL,
	"suggested_global_product_id" uuid,
	"match_confidence" numeric(3, 2) NOT NULL,
	"match_reasons" jsonb NOT NULL,
	"resolution_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_source_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"global_product_id" uuid NOT NULL,
	"source_product_listing_id" uuid NOT NULL,
	"observed_price" numeric(14, 4),
	"observed_currency" varchar(3),
	"availability_status" varchar(50),
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"global_product_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"changed_by_source_id" uuid,
	"diff_payload" jsonb NOT NULL,
	"full_snapshot" jsonb NOT NULL,
	"reason" varchar(255) DEFAULT 'automated_corroboration' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_product_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"global_product_id" uuid NOT NULL,
	"customer_internal_sku" varchar(255),
	"is_favorite" boolean DEFAULT false NOT NULL,
	"sync_status" varchar(50) DEFAULT 'active' NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_product_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"global_product_id" uuid NOT NULL,
	"custom_title" varchar(500),
	"custom_description" text,
	"custom_category" varchar(255),
	"custom_tags" jsonb DEFAULT '[]'::jsonb,
	"custom_attributes" jsonb DEFAULT '{}'::jsonb,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_processing_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"global_product_id" uuid NOT NULL,
	"task_type" varchar(50) NOT NULL,
	"model_name" varchar(100) NOT NULL,
	"input_payload" jsonb NOT NULL,
	"output_result" jsonb NOT NULL,
	"token_usage" integer,
	"latency_ms" integer,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"old_state" jsonb,
	"new_state" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_validation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_product_listing_id" uuid NOT NULL,
	"rule_name" varchar(100) NOT NULL,
	"is_valid" boolean NOT NULL,
	"validation_message" text,
	"validated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraping_job_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"log_level" varchar(20) DEFAULT 'INFO' NOT NULL,
	"message" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraping_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"brand_id" uuid,
	"source_website_id" uuid NOT NULL,
	"target_url" text NOT NULL,
	"job_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'queued' NOT NULL,
	"items_extracted" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_scraping_profiles" ADD CONSTRAINT "brand_scraping_profiles_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_scraping_profiles" ADD CONSTRAINT "brand_scraping_profiles_source_website_id_source_websites_id_fk" FOREIGN KEY ("source_website_id") REFERENCES "public"."source_websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_product_listings" ADD CONSTRAINT "source_product_listings_source_website_id_source_websites_id_fk" FOREIGN KEY ("source_website_id") REFERENCES "public"."source_websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_websites" ADD CONSTRAINT "source_websites_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_products" ADD CONSTRAINT "global_products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_product_variant_id_product_variants_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_source_website_id_source_websites_id_fk" FOREIGN KEY ("source_website_id") REFERENCES "public"."source_websites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_identifiers" ADD CONSTRAINT "product_identifiers_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_identifiers" ADD CONSTRAINT "product_identifiers_product_variant_id_product_variants_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_identifiers" ADD CONSTRAINT "product_identifiers_source_website_id_source_websites_id_fk" FOREIGN KEY ("source_website_id") REFERENCES "public"."source_websites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_variant_id_product_variants_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_provenance" ADD CONSTRAINT "field_provenance_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_provenance" ADD CONSTRAINT "field_provenance_source_website_id_source_websites_id_fk" FOREIGN KEY ("source_website_id") REFERENCES "public"."source_websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_provenance" ADD CONSTRAINT "field_provenance_source_product_listing_id_source_product_listings_id_fk" FOREIGN KEY ("source_product_listing_id") REFERENCES "public"."source_product_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_review_queue" ADD CONSTRAINT "identity_review_queue_source_product_listing_id_source_product_listings_id_fk" FOREIGN KEY ("source_product_listing_id") REFERENCES "public"."source_product_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_review_queue" ADD CONSTRAINT "identity_review_queue_suggested_global_product_id_global_products_id_fk" FOREIGN KEY ("suggested_global_product_id") REFERENCES "public"."global_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_review_queue" ADD CONSTRAINT "identity_review_queue_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_source_history" ADD CONSTRAINT "product_source_history_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_source_history" ADD CONSTRAINT "product_source_history_source_product_listing_id_source_product_listings_id_fk" FOREIGN KEY ("source_product_listing_id") REFERENCES "public"."source_product_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_changed_by_source_id_source_websites_id_fk" FOREIGN KEY ("changed_by_source_id") REFERENCES "public"."source_websites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_product_mappings" ADD CONSTRAINT "customer_product_mappings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_product_mappings" ADD CONSTRAINT "customer_product_mappings_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_product_overrides" ADD CONSTRAINT "customer_product_overrides_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_product_overrides" ADD CONSTRAINT "customer_product_overrides_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_processing_history" ADD CONSTRAINT "ai_processing_history_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_validation_results" ADD CONSTRAINT "data_validation_results_source_product_listing_id_source_product_listings_id_fk" FOREIGN KEY ("source_product_listing_id") REFERENCES "public"."source_product_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraping_job_logs" ADD CONSTRAINT "scraping_job_logs_job_id_scraping_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scraping_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraping_jobs" ADD CONSTRAINT "scraping_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraping_jobs" ADD CONSTRAINT "scraping_jobs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraping_jobs" ADD CONSTRAINT "scraping_jobs_source_website_id_source_websites_id_fk" FOREIGN KEY ("source_website_id") REFERENCES "public"."source_websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_keys_org" ON "api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_org_members_unique" ON "organization_memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_org_members_org_id" ON "organization_memberships" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_organizations_slug" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bsp_version_unique" ON "brand_scraping_profiles" USING btree ("brand_id","source_website_id","profile_version");--> statement-breakpoint
CREATE INDEX "idx_brands_normalized" ON "brands" USING btree ("normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_spl_unique_url" ON "source_product_listings" USING btree ("source_website_id","source_url");--> statement-breakpoint
CREATE INDEX "idx_spl_canonical_id" ON "source_product_listings" USING btree ("canonical_product_id");--> statement-breakpoint
CREATE INDEX "idx_spl_content_hash" ON "source_product_listings" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_source_websites_domain" ON "source_websites" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_gp_brand_id" ON "global_products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_gp_normalized_model" ON "global_products" USING btree ("brand_id","normalized_model");--> statement-breakpoint
CREATE INDEX "idx_gp_verification" ON "global_products" USING btree ("verification_status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pa_unique_attr" ON "product_attributes" USING btree ("global_product_id","product_variant_id","attribute_key");--> statement-breakpoint
CREATE INDEX "idx_pa_key_val" ON "product_attributes" USING btree ("attribute_key","normalized_value");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pi_unique_id" ON "product_identifiers" USING btree ("id_type","normalized_value");--> statement-breakpoint
CREATE INDEX "idx_pi_lookup" ON "product_identifiers" USING btree ("id_type","normalized_value");--> statement-breakpoint
CREATE INDEX "idx_pi_gp" ON "product_identifiers" USING btree ("global_product_id");--> statement-breakpoint
CREATE INDEX "idx_pimg_gp" ON "product_images" USING btree ("global_product_id");--> statement-breakpoint
CREATE INDEX "idx_pimg_hash" ON "product_images" USING btree ("image_hash");--> statement-breakpoint
CREATE INDEX "idx_pv_global_product" ON "product_variants" USING btree ("global_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_fp_unique_field" ON "field_provenance" USING btree ("global_product_id","field_name");--> statement-breakpoint
CREATE INDEX "idx_fp_freshness" ON "field_provenance" USING btree ("last_corroborated_at","is_stale");--> statement-breakpoint
CREATE INDEX "idx_irq_status" ON "identity_review_queue" USING btree ("resolution_status");--> statement-breakpoint
CREATE INDEX "idx_psh_gp" ON "product_source_history" USING btree ("global_product_id","extracted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pv_unique_version" ON "product_versions" USING btree ("global_product_id","version_number");--> statement-breakpoint
CREATE INDEX "idx_pv_history" ON "product_versions" USING btree ("global_product_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cpm_unique_tenant_product" ON "customer_product_mappings" USING btree ("organization_id","global_product_id");--> statement-breakpoint
CREATE INDEX "idx_cpm_sku" ON "customer_product_mappings" USING btree ("organization_id","customer_internal_sku");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cpo_unique_tenant_product" ON "customer_product_overrides" USING btree ("organization_id","global_product_id");--> statement-breakpoint
CREATE INDEX "idx_cpo_tenant" ON "customer_product_overrides" USING btree ("organization_id","global_product_id");--> statement-breakpoint
CREATE INDEX "idx_ai_history" ON "ai_processing_history" USING btree ("global_product_id","task_type");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_org" ON "audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_dvr_listing" ON "data_validation_results" USING btree ("source_product_listing_id");--> statement-breakpoint
CREATE INDEX "idx_job_logs" ON "scraping_job_logs" USING btree ("job_id","logged_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_status" ON "scraping_jobs" USING btree ("status","created_at");