#!/usr/bin/env bash
# scripts/smoke.sh
#
# End-to-end smoke: sign up an admin, create a channel, mint an API key,
# upload a synthesised sample video, wait for transcode, then probe the
# HLS master playlist.
#
# Assumes the dev server is reachable at $BASE_URL (default
# http://localhost:3000) and that postgres is up via `just db-up`.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
EMAIL="${SMOKE_EMAIL:-smoke-$(date +%s)@cassette.local}"
PASSWORD="${SMOKE_PASSWORD:-cassette-smoke-pwd-1234}"
NAME="${SMOKE_NAME:-Smoke Tester}"
HANDLE="${SMOKE_HANDLE:-smoke-$(date +%s)}"
SAMPLE="${SAMPLE:-/tmp/cassette-smoke-sample.mp4}"
TIMEOUT_SECS="${TIMEOUT_SECS:-180}"

log() { printf "\033[36m[smoke]\033[0m %s\n" "$*"; }
fail() { printf "\033[31m[smoke FAIL]\033[0m %s\n" "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. health ping
# ---------------------------------------------------------------------------
log "ping $BASE_URL/api/trpc/health.ping"
ping_body=$(curl -fsS "$BASE_URL/api/trpc/health.ping")
echo "  -> $ping_body"
[[ "$ping_body" == *'"ok":true'* ]] || fail "health ping did not return ok:true"

# ---------------------------------------------------------------------------
# 2. sample video (5 s test pattern)
# ---------------------------------------------------------------------------
if [[ ! -f "$SAMPLE" ]]; then
    log "generate sample video at $SAMPLE"
    ffmpeg -y -f lavfi -i "testsrc2=size=640x360:rate=30" \
        -f lavfi -i "sine=frequency=440:sample_rate=48000" \
        -t 5 -c:v libx264 -preset ultrafast -pix_fmt yuv420p \
        -c:a aac -b:a 96k -shortest "$SAMPLE" 2>/dev/null
fi
[[ -f "$SAMPLE" ]] || fail "sample video missing"

# ---------------------------------------------------------------------------
# 3. sign up via Better-Auth
# ---------------------------------------------------------------------------
log "sign-up $EMAIL"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT
signup_body=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/auth/sign-up/email" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"$NAME\"}")
echo "  -> $signup_body"
USER_ID=$(echo "$signup_body" | python3 -c 'import json,sys;print(json.load(sys.stdin)["user"]["id"])')
log "user_id=$USER_ID"

# ---------------------------------------------------------------------------
# 4. create channel via tRPC
# ---------------------------------------------------------------------------
log "channel.create handle=@$HANDLE"
channel_body=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/trpc/channel.create" \
    -d "{\"json\":{\"handle\":\"$HANDLE\",\"name\":\"Smoke Channel\",\"description\":\"\"}}")
echo "  -> $channel_body"
CHANNEL_ID=$(echo "$channel_body" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["result"]["data"]["json"]["id"])')
log "channel_id=$CHANNEL_ID"

# ---------------------------------------------------------------------------
# 5. mint API key
# ---------------------------------------------------------------------------
log "channel.generateApiKey"
key_body=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/trpc/channel.generateApiKey" \
    -d "{\"json\":{\"channelId\":\"$CHANNEL_ID\",\"name\":\"smoke\"}}")
echo "  -> $key_body"
PLAINTEXT=$(echo "$key_body" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["result"]["data"]["json"]["plaintext"])')
log "api key minted (prefix: ${PLAINTEXT:0:12}...)"

# ---------------------------------------------------------------------------
# 6. upload sample
# ---------------------------------------------------------------------------
log "upload sample via /api/upload"
upload_body=$(curl -fsS \
    -H "Authorization: Bearer $PLAINTEXT" \
    -F "file=@$SAMPLE" \
    -F "title=Smoke Sample" \
    -F "description=automated smoke test" \
    -F "privacy=public" \
    "$BASE_URL/api/upload")
echo "  -> $upload_body"
VIDEO_ID=$(echo "$upload_body" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["videoId"])')
log "video_id=$VIDEO_ID"

# ---------------------------------------------------------------------------
# 7. wait for transcode
# ---------------------------------------------------------------------------
log "polling video.uploadStatus until ready (timeout ${TIMEOUT_SECS}s)"
deadline=$((SECONDS + TIMEOUT_SECS))
final_state=""
while (( SECONDS < deadline )); do
    status_body=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
        "$BASE_URL/api/trpc/video.uploadStatus?input=$(python3 -c "import urllib.parse,json;print(urllib.parse.quote(json.dumps({'json':{'videoId':'$VIDEO_ID'}})))")")
    state=$(echo "$status_body" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["result"]["data"]["json"]["state"])' 2>/dev/null || echo "?")
    progress=$(echo "$status_body" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["result"]["data"]["json"].get("progress","?"))' 2>/dev/null || echo "?")
    step=$(echo "$status_body" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["result"]["data"]["json"].get("step","-") or "-")' 2>/dev/null || echo "-")
    log "  state=$state progress=$progress step=$step"
    if [[ "$state" == "completed" || "$state" == "failed" ]]; then
        final_state="$state"
        break
    fi
    sleep 3
done

[[ "$final_state" == "completed" ]] || fail "transcode did not complete (final: ${final_state:-timeout})"

# ---------------------------------------------------------------------------
# 8. probe HLS master + segment
# ---------------------------------------------------------------------------
log "fetch master.m3u8"
master=$(curl -fsS "$BASE_URL/api/hls/$VIDEO_ID/master.m3u8")
echo "$master" | head -10
echo "$master" | grep -q "EXTM3U" || fail "master is not a valid m3u8"

log "fetch first variant playlist"
VARIANT_LINE=$(echo "$master" | grep -E "playlist.m3u8" | head -1)
VARIANT_URL=$(echo "$VARIANT_LINE" | tr -d "\r")
[[ -n "$VARIANT_URL" ]] || fail "no variant playlist found in master"
# resolve relative to base URL
if [[ "$VARIANT_URL" == /* ]]; then
    FULL="$BASE_URL$VARIANT_URL"
else
    FULL="$BASE_URL/api/hls/$VIDEO_ID/$VARIANT_URL"
fi
log "  variant url: $FULL"
variant=$(curl -fsS "$FULL")
echo "$variant" | head -8
echo "$variant" | grep -q "EXTM3U" || fail "variant is not a valid m3u8"

log "fetch first segment with Range bytes=0-1023"
SEG_LINE=$(echo "$variant" | grep -E "seg-" | head -1 | tr -d "\r")
[[ -n "$SEG_LINE" ]] || fail "no segment found in variant"
if [[ "$SEG_LINE" == /* ]]; then
    SEG_URL="$BASE_URL$SEG_LINE"
else
    SEG_URL="$(dirname "$FULL")/$SEG_LINE"
fi
log "  seg url: $SEG_URL"
seg_status=$(curl -s -o /dev/null -w "%{http_code} %{size_download}" -H "Range: bytes=0-1023" "$SEG_URL")
log "  seg status (code size): $seg_status"
[[ "$seg_status" == 206* ]] || fail "segment Range request did not return 206"

log "DONE - all smoke checks pass"
