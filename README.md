# cassette

A self-hosted, YouTube-shaped personal video platform. Upload via a simple HTTP API, watch back as adaptive HLS, keep
the library on disk where you can see it.

## Stack

- Next.js 15 (App Router) with React 19
- TypeScript (strict)
- tRPC v11
- Drizzle ORM with Postgres 16
- Better-Auth (email + password, plus channel-scoped API keys)
- Vidstack player with hls.js
- shadcn/ui + Tailwind 3 (dark, `system-ui` typography)
- pg-boss for transcoding jobs
- ffmpeg + ffprobe for the HLS pipeline (MPEG-TS `.ts` segments, ABR ladder)

## Quick start (development)

Prerequisites: Node 22+, yarn (via corepack), Docker, ffmpeg on the host (the dev server uses the host's ffmpeg).

```bash
corepack enable
yarn install
cp .env.example .env

# bring postgres up and apply the schema
just bootstrap

# run the dev server
yarn dev
```

Open `http://localhost:3000`.

## Environment

Configuration is driven by `.env`. See `.env.example` for the full list. The most important variables:

| Variable              | Purpose                                                  |
| --------------------- | -------------------------------------------------------- |
| `DATABASE_URL`        | Postgres connection string                               |
| `MEDIA_SOURCE_PATH`   | Where uploaded originals are written. Bind-mount in prod |
| `MEDIA_HLS_PATH`      | Where transcoded HLS output lives. Safe to wipe          |
| `BETTER_AUTH_SECRET`  | Random 32+ byte secret used by Better-Auth               |
| `HLS_SIGNING_SECRET`  | Random 32+ byte secret for signed segment tokens         |
| `MAX_UPLOAD_BYTES`    | Hard cap for a single upload. Default 20 GiB             |
| `TRANSCODE_CONCURRENCY` | How many ffmpeg jobs run in parallel                   |
| `ENABLE_NVENC`        | Set to 1 to use h264_nvenc when available                |

## Layout

See `PLAN.md` for the full design document and milestone breakdown. See `TODO.md` for the live execution checklist.

## Self-hosting

Build the image and run via docker compose:

```bash
docker compose --profile full up -d --build
# wait for /api/health to return 200
curl -fsS http://localhost:3000/api/health
```

The migrator runs automatically on container boot, so a fresh database is
schema-ready by the time the app accepts traffic. The compose file binds two
host paths:

- `MEDIA_SOURCE_PATH` for uploaded originals (the Emby-style "arbitrary path")
- `MEDIA_HLS_PATH` for transcoded HLS output (regenerable; safe to wipe)

Both default to `./media/source` and `./media/hls`. Override in `.env` to
point at any path on the host. The compose stack creates the `cassette-pgdata`
named volume for Postgres data; `docker compose down -v` resets to a fresh
database.

## End-to-end smoke

`scripts/smoke.sh` exercises the full stack against any reachable cassette
instance:

```bash
just smoke
# or BASE_URL=http://other-host:3000 bash scripts/smoke.sh
```

The smoke covers: tRPC ping, sign-up, channel.create, channel.generateApiKey,
multipart upload via the API key, pg-boss transcode polling, master.m3u8 +
variant + segment Range, the watch page, subscribe, like, comment.create,
comment.list, queue.add, watchLater.add, search, recordProgress, and
notification.unreadCount. Every step fails the script loudly on regression.

The smoke generates a 5-second `testsrc2 + sine` sample with `libopenh264`
when one is missing; install ffmpeg with libx264 on the host for a realistic
encoder pass, or rely on the production runner image (Debian + libx264).

## Licence

MIT.
