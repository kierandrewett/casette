CREATE TABLE "channel_bandwidth_daily" (
	"channel_id" uuid NOT NULL,
	"bucket" integer NOT NULL,
	"bytes" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_bandwidth_daily_channel_id_bucket_pk" PRIMARY KEY("channel_id","bucket")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_bandwidth_daily" ADD CONSTRAINT "channel_bandwidth_daily_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_bandwidth_daily_bucket_channel_idx" ON "channel_bandwidth_daily" USING btree ("bucket" DESC NULLS LAST,"channel_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_actor_created_at_idx" ON "audit_logs" USING btree ("actor_id","created_at" DESC NULLS LAST);