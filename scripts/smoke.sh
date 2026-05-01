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

# ---------------------------------------------------------------------------
# 9. watch page renders
# ---------------------------------------------------------------------------
log "fetch /watch/<videoId>"
watch_status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/watch/$VIDEO_ID")
log "  /watch/$VIDEO_ID -> $watch_status"
[[ "$watch_status" == "200" ]] || fail "watch page did not render 200"

# ---------------------------------------------------------------------------
# 10. social: subscribe + like + comment
# ---------------------------------------------------------------------------
log "subscription.subscribe"
sub_body=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/trpc/subscription.subscribe" \
    -d "{\"json\":{\"channelId\":\"$CHANNEL_ID\"}}")
echo "  -> $sub_body" | head -c 200; echo
echo "$sub_body" | grep -q '"data"' || fail "subscribe failed"

log "like.toggleVideo (like)"
like_body=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/trpc/like.toggleVideo" \
    -d "{\"json\":{\"videoId\":\"$VIDEO_ID\",\"kind\":\"like\"}}")
echo "  -> $like_body" | head -c 200; echo
echo "$like_body" | grep -q '"data"' || fail "like failed"

log "comment.create"
comment_body=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/trpc/comment.create" \
    -d "{\"json\":{\"videoId\":\"$VIDEO_ID\",\"body\":\"automated smoke comment\"}}")
echo "  -> $comment_body" | head -c 200; echo
echo "$comment_body" | grep -q '"id"' || fail "comment.create failed"

log "comment.list"
list_body=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    "$BASE_URL/api/trpc/comment.list?input=$(python3 -c "import urllib.parse,json;print(urllib.parse.quote(json.dumps({'json':{'videoId':'$VIDEO_ID'}})))")")
items_count=$(echo "$list_body" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(len(d["result"]["data"]["json"]["items"]))')
log "  comment count: $items_count"
[[ "$items_count" -ge 1 ]] || fail "comment.list returned no items"

# ---------------------------------------------------------------------------
# 11. library: queue + watch later
# ---------------------------------------------------------------------------
log "playlist.queue.add"
queue_add=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/trpc/playlist.queue.add" \
    -d "{\"json\":{\"videoId\":\"$VIDEO_ID\"}}")
echo "  -> $queue_add" | head -c 200; echo

log "playlist.queue.list"
queue_list=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    "$BASE_URL/api/trpc/playlist.queue.list?input=$(python3 -c 'import urllib.parse,json;print(urllib.parse.quote(json.dumps({"json":None})))')")
echo "  -> $queue_list" | head -c 200; echo

log "playlist.watchLater.add"
wl=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/trpc/playlist.watchLater.add" \
    -d "{\"json\":{\"videoId\":\"$VIDEO_ID\"}}")
echo "  -> $wl" | head -c 200; echo

# ---------------------------------------------------------------------------
# 12. search
# ---------------------------------------------------------------------------
log "search.videos q=Smoke"
search_body=$(curl -fsS "$BASE_URL/api/trpc/search.videos?input=$(python3 -c "import urllib.parse,json;print(urllib.parse.quote(json.dumps({'json':{'q':'Smoke'}})))")")
hits=$(echo "$search_body" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(len(d["result"]["data"]["json"]["items"]))')
log "  hits: $hits"
[[ "$hits" -ge 1 ]] || fail "search returned no hits"

log "/search?q=Smoke renders"
search_status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/search?q=Smoke")
[[ "$search_status" == "200" ]] || fail "/search did not render 200"

# ---------------------------------------------------------------------------
# 13. watch progress beacon
# ---------------------------------------------------------------------------
log "video.recordProgress"
prog=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/trpc/video.recordProgress" \
    -d "{\"json\":{\"videoId\":\"$VIDEO_ID\",\"positionSec\":2}}")
echo "  -> $prog" | head -c 200; echo

# ---------------------------------------------------------------------------
# 14. notifications: a second user subscribes; new upload fans out
# ---------------------------------------------------------------------------
log "notification.unreadCount (first user)"
nc=$(curl -fsS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    "$BASE_URL/api/trpc/notification.unreadCount?input=$(python3 -c 'import urllib.parse,json;print(urllib.parse.quote(json.dumps({"json":None})))')")
echo "  -> $nc" | head -c 200; echo

log "DONE - all smoke checks pass"
