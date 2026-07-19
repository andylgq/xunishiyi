CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"helpful_level" text NOT NULL,
	"reasons" text[],
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" text NOT NULL,
	"user_id" uuid,
	"task_id" uuid,
	"duration_ms" integer,
	"props" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"total_quota" integer DEFAULT 5 NOT NULL,
	"used_quota" integer DEFAULT 0 NOT NULL,
	"reserved_quota" integer DEFAULT 0 NOT NULL,
	"period_start_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tryon_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"seed" integer,
	"storage_key" text,
	"is_saved" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tryon_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"person_upload_id" uuid NOT NULL,
	"garment_upload_id" uuid NOT NULL,
	"garment_type" text NOT NULL,
	"requested_count" integer DEFAULT 3 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_name" text DEFAULT 'mock' NOT NULL,
	"provider_req_key" text,
	"provider_task_ids" text[],
	"seeds" integer[],
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"original_task_id" uuid,
	"quota_charged" boolean DEFAULT false NOT NULL,
	"last_error_code" text,
	"last_error_message" text,
	"submitted_at" timestamp with time zone,
	"last_polled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"sha256" text,
	"precheck_passed" boolean,
	"precheck_result" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anon_uid" text NOT NULL,
	"is_anonymous" boolean DEFAULT true NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_anon_uid_unique" UNIQUE("anon_uid")
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_task_id_tryon_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tryon_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota" ADD CONSTRAINT "quota_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_task_id_tryon_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tryon_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tryon_results" ADD CONSTRAINT "tryon_results_task_id_tryon_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tryon_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tryon_tasks" ADD CONSTRAINT "tryon_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tryon_tasks" ADD CONSTRAINT "tryon_tasks_person_upload_id_uploads_id_fk" FOREIGN KEY ("person_upload_id") REFERENCES "public"."uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tryon_tasks" ADD CONSTRAINT "tryon_tasks_garment_upload_id_uploads_id_fk" FOREIGN KEY ("garment_upload_id") REFERENCES "public"."uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_task_id_uniq" ON "feedback" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "metrics_events_event_name_created_at_index" ON "metrics_events" USING btree ("event_name","created_at");--> statement-breakpoint
CREATE INDEX "task_logs_task_id_index" ON "task_logs" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "tryon_results_task_id_index" ON "tryon_results" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "tryon_results_expires_at_index" ON "tryon_results" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "tryon_tasks_status_index" ON "tryon_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tryon_tasks_user_id_index" ON "tryon_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tryon_tasks_status_last_polled_at_index" ON "tryon_tasks" USING btree ("status","last_polled_at");--> statement-breakpoint
CREATE INDEX "tryon_tasks_expires_at_index" ON "tryon_tasks" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "uploads_user_id_index" ON "uploads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "uploads_expires_at_index" ON "uploads" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_anon_uid_index" ON "users" USING btree ("anon_uid");