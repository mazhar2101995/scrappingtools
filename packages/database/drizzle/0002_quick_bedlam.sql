CREATE TABLE "connected_stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"platform_type" varchar(50) NOT NULL,
	"store_name" varchar(255) NOT NULL,
	"store_url" text NOT NULL,
	"api_endpoint" text,
	"encrypted_credentials" text NOT NULL,
	"webhook_secret" varchar(255),
	"status" varchar(50) DEFAULT 'connected' NOT NULL,
	"sync_schedule" varchar(50) DEFAULT 'HOURLY',
	"capabilities" jsonb NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_conflict_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connected_store_id" uuid NOT NULL,
	"global_product_id" uuid NOT NULL,
	"external_product_id" varchar(255) NOT NULL,
	"field_name" varchar(100) NOT NULL,
	"local_value" text NOT NULL,
	"remote_value" text NOT NULL,
	"resolution" varchar(50) DEFAULT 'pending' NOT NULL,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_product_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connected_store_id" uuid NOT NULL,
	"global_product_id" uuid NOT NULL,
	"external_product_id" varchar(255) NOT NULL,
	"external_sku" varchar(255),
	"sync_status" varchar(50) DEFAULT 'synced' NOT NULL,
	"last_pushed_at" timestamp with time zone,
	"last_pulled_at" timestamp with time zone,
	"store_specific_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_sync_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connected_store_id" uuid NOT NULL,
	"job_id" varchar(100) NOT NULL,
	"sync_type" varchar(50) NOT NULL,
	"direction" varchar(20) NOT NULL,
	"items_processed" integer DEFAULT 0 NOT NULL,
	"items_succeeded" integer DEFAULT 0 NOT NULL,
	"items_failed" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'processing' NOT NULL,
	"error_details" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connected_stores" ADD CONSTRAINT "connected_stores_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_conflict_logs" ADD CONSTRAINT "store_conflict_logs_connected_store_id_connected_stores_id_fk" FOREIGN KEY ("connected_store_id") REFERENCES "public"."connected_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_conflict_logs" ADD CONSTRAINT "store_conflict_logs_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_conflict_logs" ADD CONSTRAINT "store_conflict_logs_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_mappings" ADD CONSTRAINT "store_product_mappings_connected_store_id_connected_stores_id_fk" FOREIGN KEY ("connected_store_id") REFERENCES "public"."connected_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_mappings" ADD CONSTRAINT "store_product_mappings_global_product_id_global_products_id_fk" FOREIGN KEY ("global_product_id") REFERENCES "public"."global_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_sync_history" ADD CONSTRAINT "store_sync_history_connected_store_id_connected_stores_id_fk" FOREIGN KEY ("connected_store_id") REFERENCES "public"."connected_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cs_org" ON "connected_stores" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_cs_store_url_org" ON "connected_stores" USING btree ("organization_id","store_url");--> statement-breakpoint
CREATE INDEX "idx_scl_store_pending" ON "store_conflict_logs" USING btree ("connected_store_id","resolution");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_spm_store_ext_id" ON "store_product_mappings" USING btree ("connected_store_id","external_product_id");--> statement-breakpoint
CREATE INDEX "idx_spm_gp" ON "store_product_mappings" USING btree ("global_product_id");--> statement-breakpoint
CREATE INDEX "idx_spm_status" ON "store_product_mappings" USING btree ("connected_store_id","sync_status");--> statement-breakpoint
CREATE INDEX "idx_ssh_store" ON "store_sync_history" USING btree ("connected_store_id","created_at");