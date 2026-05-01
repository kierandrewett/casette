ALTER TABLE "user_preferences" ALTER COLUMN "user_id" DROP DEFAULT;--> statement-breakpoint
-- Add public_id nullable, backfill existing rows with a 11-char URL-safe
-- random value, then promote to NOT NULL + unique. Future rows let the
-- upload route mint the id via lib/slug.videoPublicId().
ALTER TABLE "videos" ADD COLUMN "public_id" text;--> statement-breakpoint
UPDATE "videos"
   SET "public_id" = translate(
       substr(encode(gen_random_bytes(8), 'base64'), 1, 11),
       '+/=', '_-_'
   )
 WHERE "public_id" IS NULL;--> statement-breakpoint
ALTER TABLE "videos" ALTER COLUMN "public_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_public_id_unique" UNIQUE("public_id");
