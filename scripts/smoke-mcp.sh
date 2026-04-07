#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
TARGET_HOST="${TARGET_HOST:-tad-bim-01}"
WALL_LENGTH="${WALL_LENGTH:-15}"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-2}"
POLL_TIMEOUT_SECONDS="${POLL_TIMEOUT_SECONDS:-60}"

json_field() {
  local path="$1"
  node -e '
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      const payload = JSON.parse(data);
      const parts = process.argv[1].split(".");
      let value = payload;
      for (const part of parts) {
        value = value?.[part];
      }
      if (value === undefined || value === null) {
        process.exit(1);
      }
      process.stdout.write(String(value));
    });
  ' "$path"
}

echo "==> Checking health at ${BASE_URL}/health"
curl -fsS "${BASE_URL}/health"
echo
echo

echo "==> Calling mcp-arch-system-health for host ${TARGET_HOST}"
PING_RESPONSE="$(curl -fsS \
  -H "content-type: application/json" \
  -d "{\"targetHost\":\"${TARGET_HOST}\"}" \
  "${BASE_URL}/mcp/tools/mcp-arch-system-health")"
printf '%s\n\n' "${PING_RESPONSE}"

echo "==> Calling mcp-arch-walls-create for host ${TARGET_HOST}"
WALL_RESPONSE="$(curl -fsS \
  -H "content-type: application/json" \
  -d "{\"targetHost\":\"${TARGET_HOST}\",\"length\":${WALL_LENGTH}}" \
  "${BASE_URL}/mcp/tools/mcp-arch-walls-create")"
printf '%s\n\n' "${WALL_RESPONSE}"

JOB_ID="$(printf '%s' "${WALL_RESPONSE}" | json_field "jobId")"
echo "Local job id: ${JOB_ID}"
echo

DEADLINE=$((SECONDS + POLL_TIMEOUT_SECONDS))

while [ "${SECONDS}" -lt "${DEADLINE}" ]; do
  JOB_RESPONSE="$(curl -fsS "${BASE_URL}/jobs/${JOB_ID}")"
  STATUS="$(printf '%s' "${JOB_RESPONSE}" | json_field "status")"

  echo "Job status: ${STATUS}"
  printf '%s\n\n' "${JOB_RESPONSE}"

  case "${STATUS}" in
    completed|failed|timeout)
      exit 0
      ;;
  esac

  sleep "${POLL_INTERVAL_SECONDS}"
done

echo "Polling timed out after ${POLL_TIMEOUT_SECONDS}s" >&2
exit 1
