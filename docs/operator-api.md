# cassette operator API

The operator-facing surface of cassette is small on purpose. Everything you
need to integrate with another service (a yt-dlp pipeline, a NAS importer,
an arr-stack post-processor) goes through three endpoints plus the existing
HLS streaming routes.

This document describes those endpoints, the auth model, and the smallest
working examples you can copy.

---

## Authentication

cassette has two auth paths, both proven by the end-to-end smoke test:

1. **Channel-scoped API keys** for service-to-service uploads. Mint one in
   the studio at `/studio/c/<handle>/api-keys`. The plaintext is shown
   exactly once. Format: `vid_<22-char-base64url>`.

2. **Better-Auth session cookie** for browser users. Used by the studio
   upload form, the comment composer, the like button, and the bell.

Both paths are accepted by the upload and caption endpoints. Pick whichever
fits your client. API keys cannot like or comment — they are upload-only.

---

## POST /api/upload

Upload a video to a channel. The transcode pipeline picks it up
automatically; poll `video.uploadStatus` to follow progress.

### Request

`Content-Type: multipart/form-data`

| Field         | Required | Description                                           |
| ------------- | -------- | ----------------------------------------------------- |
| `file`        | yes      | The video file. ≤ `MAX_UPLOAD_BYTES` (default 20 GB). |
| `title`       | yes      | ≤ 200 characters.                                     |
| `description` | no       | ≤ 10,000 characters.                                  |
| `privacy`     | no       | `public` (default), `unlisted`, or `private`.         |
| `channelId`   | session  | Required when using session auth, ignored otherwise.  |
| `captions[]`  | no       | One or more `<lang>-<Label>.vtt` files.               |

API key auth: `Authorization: Bearer vid_<your-key>`.

### Example

```bash
curl -fsS \
  -H "Authorization: Bearer vid_xxxxxxxxxxxxxxxxxxxxxx" \
  -F file=@/media/imports/holiday.mp4 \
  -F title="Holiday 2026" \
  -F description="Day one." \
  -F privacy=unlisted \
  -F captions[]=@/media/imports/holiday.en-English.vtt \
  https://cassette.example/api/upload
```

### Response

`201 Created`

```json
{
    "videoId": "uuid",
    "status": "queued",
    "statusUrl": "/api/trpc/video.uploadStatus?input=...",
    "watchUrl": "/watch/<id>"
}
```

### Errors

| Code | Reason                                                |
| ---- | ----------------------------------------------------- |
| 401  | Missing / invalid / revoked API key, no session.      |
| 403  | Session is not a member of `channelId`.               |
| 404  | `channelId` does not match a channel.                 |
| 413  | File exceeds `MAX_UPLOAD_BYTES`.                      |
| 400  | Missing title, malformed multipart, no body, etc.     |

---

## POST /api/upload/[videoId]/captions

Add a caption track to a video that is already transcoded. Useful for
translations or for tracks the embedded-subtitle extractor missed.

### Request

`Content-Type: multipart/form-data`

| Field       | Required | Description                                     |
| ----------- | -------- | ----------------------------------------------- |
| `file`      | yes      | A WebVTT file. Must start with the `WEBVTT` magic line. ≤ 5 MB. |
| `lang`      | yes      | BCP-47 tag, e.g. `en` or `en-GB`.               |
| `label`     | no       | Display label. Defaults to `lang`.              |
| `isDefault` | no       | `"true"` to mark as the default track.          |

Auth: same dual path as `/api/upload`. API keys must be scoped to the
video's channel.

### Example

```bash
curl -fsS \
  -H "Authorization: Bearer vid_xxxxxxxxxxxxxxxxxxxxxx" \
  -F file=@de-Deutsch.vtt \
  -F lang=de \
  -F label=Deutsch \
  -F isDefault=false \
  https://cassette.example/api/upload/<videoId>/captions
```

### Response

`201 Created`

```json
{
    "ok": true,
    "lang": "de",
    "label": "Deutsch",
    "isDefault": false,
    "url": "/api/hls/<videoId>/captions/de.vtt"
}
```

---

## POST /api/channel/[channelId]/asset

Upload an avatar or banner for a channel.

### Request

| Field   | Required | Description                          |
| ------- | -------- | ------------------------------------ |
| `kind`  | yes      | `"avatar"` or `"banner"`.            |
| `file`  | yes      | JPEG, PNG, or WebP. Magic-byte validated. Avatar ≤ 5 MB, banner ≤ 10 MB. |

Auth: session with owner / manager role on the channel, OR a vid\_ key
scoped to the same channel.

### Response

`200 OK`

```json
{ "ok": true, "url": "/api/channel/<channelId>/asset/avatar" }
```

The serving URL is extension-agnostic; the asset GET route probes
`<kind>.webp → .jpg → .png` so the operator never has to update the
public URL when replacing a file.

---

## tRPC

Everything else is tRPC at `/api/trpc/<namespace>.<procedure>`. The full
type-safe surface is in `src/server/api/routers/`. The studio uses these
exclusively. A few are useful to call from external automation:

| Procedure                 | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `health.ping`             | Liveness probe.                                    |
| `video.uploadStatus`      | Poll transcode state for a given videoId.          |
| `video.byId`              | Fetch the full video + variants + captions + chapters. |
| `channel.byHandle`        | Look up a channel by `@handle`.                    |
| `channel.generateApiKey`  | Mint a key. Plaintext is returned exactly once.    |
| `channel.revokeApiKey`    | Revoke a key (sets `revokedAt = now()`).           |
| `search.videos`           | Full-text search with filters.                     |
| `search.channels`         | Channel name / handle similarity search.           |

GET requests use `?input=<urlencoded JSON>`; POST requests carry the
JSON in the body. The tRPC wire format wraps inputs in `{"json": ...}`.

---

## Embed

Any public or unlisted video can be embedded with an `<iframe>`:

```html
<iframe
    src="https://cassette.example/embed/<videoId>"
    width="640" height="360" frameborder="0"
    allow="autoplay; fullscreen; picture-in-picture"
    allowfullscreen></iframe>
```

For unlisted videos, append `?slug=<unlistedSlug>`. Private videos cannot
be embedded — playback always requires a signed-in channel member.

---

## End-to-end smoke

`scripts/smoke.sh` is the executable contract for these endpoints. It
covers sign-up → channel.create → channel.generateApiKey → /api/upload →
transcode polling → master.m3u8 + variant + segment Range → /watch →
subscribe → like → comment → queue.add → watchLater.add → search.videos →
recordProgress → notification.unreadCount.

Run it with `just smoke` or `BASE_URL=http://other-host:3000 bash
scripts/smoke.sh`.
