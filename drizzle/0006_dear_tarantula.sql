ALTER TABLE "channels" ADD COLUMN "disk_quota_bytes" bigint;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "auto_prune_days" integer;