#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PID_EXCHANGE=""
PID_RECORDING=""

run_in_dir() {
  local target_dir="$1"
  shift
  (
    cd "$target_dir"
    "$@"
  )
}

check_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

ensure_file() {
  local file_path="$1"

  if [ ! -f "$file_path" ]; then
    echo "Missing required file: $file_path" >&2
    exit 1
  fi
}

setup_oracles() {
  echo "Running setup:local for the oracles..."
  echo "Setup Exchange Oracle"
  run_in_dir "$PROJECT_ROOT/exchange-oracle/server" yarn setup:local

  echo "Setup Recording Oracle"
  run_in_dir "$PROJECT_ROOT/recording-oracle" yarn setup:local
}

run_exchange_oracle() {
  run_in_dir "$PROJECT_ROOT/exchange-oracle/server" env NODE_ENV=local yarn migration:run
  run_in_dir "$PROJECT_ROOT/exchange-oracle/server" env NODE_ENV=local yarn start:dev
}

run_recording_oracle() {
  run_in_dir "$PROJECT_ROOT/recording-oracle" env NODE_ENV=local yarn migration:run
  run_in_dir "$PROJECT_ROOT/recording-oracle" env NODE_ENV=local yarn start:dev
}

shutdown() {
  local exit_code="${1:-0}"

  trap - INT TERM EXIT

  echo ""
  echo "Shutting down local marketing stack..."

  if [ -n "$PID_EXCHANGE" ]; then
    kill -INT "$PID_EXCHANGE" 2>/dev/null || true
  fi

  if [ -n "$PID_RECORDING" ]; then
    kill -INT "$PID_RECORDING" 2>/dev/null || true
  fi

  sleep 3

  if [ -n "$PID_EXCHANGE" ] && kill -0 "$PID_EXCHANGE" 2>/dev/null; then
    kill -KILL "$PID_EXCHANGE" 2>/dev/null || true
  fi

  if [ -n "$PID_RECORDING" ] && kill -0 "$PID_RECORDING" 2>/dev/null; then
    kill -KILL "$PID_RECORDING" 2>/dev/null || true
  fi

  echo "Shutdown finished"
  exit "$exit_code"
}

main() {
  check_command yarn

  ensure_file "$PROJECT_ROOT/exchange-oracle/server/.env.local"
  ensure_file "$PROJECT_ROOT/recording-oracle/.env.local"

  setup_oracles

  echo "Starting Exchange Oracle..."
  run_exchange_oracle &
  PID_EXCHANGE=$!

  echo "Starting Recording Oracle..."
  run_recording_oracle &
  PID_RECORDING=$!

  echo "Local stack is running. Press Ctrl+C to stop everything."
  wait
}

trap 'shutdown $?' INT TERM EXIT

main
