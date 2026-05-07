#!/bin/sh

set -eu

SERVER_PID=""
MCP_PID=""
GATEWAY_PID=""
STOP_REQUESTED=0

# Returns success for environment flag values that should enable an option.
is_truthy() {
  case "${1:-}" in
    1|true|TRUE|True|yes|YES|Yes|on|ON|On)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# Stops all child processes started by this entrypoint.
cleanup() {
  STOP_REQUESTED=1

  if [ -n "$GATEWAY_PID" ]; then
    kill "$GATEWAY_PID" 2>/dev/null || true
    wait "$GATEWAY_PID" 2>/dev/null || true
    GATEWAY_PID=""
  fi

  if [ -n "$MCP_PID" ]; then
    kill "$MCP_PID" 2>/dev/null || true
    wait "$MCP_PID" 2>/dev/null || true
    MCP_PID=""
  fi

  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
  fi
}

# Stops the OpenClaw Gateway only when this container owns that process.
stop_gateway() {
  if [ -n "$GATEWAY_PID" ]; then
    kill "$GATEWAY_PID" 2>/dev/null || true
    wait "$GATEWAY_PID" 2>/dev/null || true
    GATEWAY_PID=""
  fi
}

trap cleanup EXIT INT TERM

# Start DIP Studio HTTP and MCP servers as core services. If either exits,
# the container exits with the same status and cleanup stops the remaining
# child processes.
node dist/server.js &
SERVER_PID=$!

node dist/mcp-server.js &
MCP_PID=$!

while :; do
  if is_truthy "${USE_EXTERNAL_OPENCLAW:-false}"; then
    GATEWAY_PID=""
  else
    openclaw gateway --allow-unconfigured &
    GATEWAY_PID=$!
  fi

  while :; do
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      wait "$SERVER_PID" 2>/dev/null || SERVER_EXIT_CODE=$?
      SERVER_EXIT_CODE=${SERVER_EXIT_CODE:-1}
      stop_gateway
      exit "$SERVER_EXIT_CODE"
    fi

    if ! kill -0 "$MCP_PID" 2>/dev/null; then
      wait "$MCP_PID" 2>/dev/null || MCP_EXIT_CODE=$?
      MCP_EXIT_CODE=${MCP_EXIT_CODE:-1}
      stop_gateway
      exit "$MCP_EXIT_CODE"
    fi

    if [ -z "$GATEWAY_PID" ]; then
      sleep 1
      continue
    fi

    if ! kill -0 "$GATEWAY_PID" 2>/dev/null; then
      break
    fi

    sleep 1
  done

  if [ -z "$GATEWAY_PID" ]; then
    continue
  fi

  GATEWAY_EXIT_CODE=0
  wait "$GATEWAY_PID" || GATEWAY_EXIT_CODE=$?
  GATEWAY_PID=""

  if [ "$STOP_REQUESTED" -eq 1 ]; then
    exit 0
  fi

  if [ "$GATEWAY_EXIT_CODE" -eq 0 ]; then
    exit 0
  fi

  sleep 1
done
