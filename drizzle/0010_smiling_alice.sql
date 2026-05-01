ALTER TABLE "channels" ADD COLUMN "pinned_video_id" uuid;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "moderate_comments" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "is_draft" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "publish_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "is_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_pinned_video_id_videos_id_fk" FOREIGN KEY ("pinned_video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "videos_draft_idx" ON "videos" USING btree ("is_draft");--> statement-breakpoint
CREATE INDEX "comments_pending_idx" ON "comments" USING btree ("is_pending","created_at" DESC NULLS LAST);