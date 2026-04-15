#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

start_ollama() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    return 0
  fi

  local ollama_app=""
  if [[ -d "/Applications/Ollama.app" ]]; then
    ollama_app="/Applications/Ollama.app"
  elif [[ -d "$HOME/Applications/Ollama.app" ]]; then
    ollama_app="$HOME/Applications/Ollama.app"
  fi

  if [[ -n "$ollama_app" ]]; then
    open "$ollama_app" >/dev/null 2>&1 || true
    return 0
  fi

  if command -v ollama >/dev/null 2>&1; then
    if ! pgrep -x ollama >/dev/null 2>&1; then
      ollama serve >/dev/null 2>&1 &
      OLLAMA_PID=$!
    fi
    return 0
  fi

  osascript -e 'display dialog "Ollama is not installed. Download it for cheap local AI. Resume Matcher will continue starting normally." buttons {"OK"} default button "OK" with icon caution' >/dev/null 2>&1 || true
}

cleanup() {
  if [[ -n "${OLLAMA_PID:-}" ]]; then
    kill "$OLLAMA_PID" 2>/dev/null || true
  fi
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

start_ollama

"$ROOT_DIR/scripts/run-backend.sh" &
BACKEND_PID=$!

"$ROOT_DIR/scripts/run-frontend.sh" &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
