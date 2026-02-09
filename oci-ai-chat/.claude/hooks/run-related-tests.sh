#!/bin/bash
# Post-edit: run related test file when a source file is edited
# Maps src/lib/server/foo.ts → src/tests/**/foo.test.ts (or colocated .test.ts)
# Debounce: skips if the same file was tested within 30 seconds
set -e

INPUT=$(cat)

# Extract file path
if command -v jq &>/dev/null; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")
else
  FILE_PATH=""
fi

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only for TypeScript source files (not test files themselves, not .svelte)
if ! echo "$FILE_PATH" | grep -qE '\.ts$'; then
  exit 0
fi
if echo "$FILE_PATH" | grep -qE '\.(test|spec)\.ts$'; then
  exit 0
fi

# ── Debounce: skip if tested within 30 seconds ────────────────────────
DEBOUNCE_DIR="/tmp/claude-test-debounce"
mkdir -p "$DEBOUNCE_DIR" 2>/dev/null || true
# Use md5/shasum of file path as the debounce key (safe filename)
if command -v md5sum &>/dev/null; then
  DEBOUNCE_KEY=$(echo -n "$FILE_PATH" | md5sum | cut -d' ' -f1)
elif command -v md5 &>/dev/null; then
  DEBOUNCE_KEY=$(echo -n "$FILE_PATH" | md5)
else
  DEBOUNCE_KEY=$(echo -n "$FILE_PATH" | shasum | cut -d' ' -f1)
fi
DEBOUNCE_FILE="$DEBOUNCE_DIR/$DEBOUNCE_KEY"

if [ -f "$DEBOUNCE_FILE" ]; then
  LAST_RUN=$(cat "$DEBOUNCE_FILE" 2>/dev/null || echo 0)
  NOW=$(date +%s)
  ELAPSED=$((NOW - LAST_RUN))
  if [ "$ELAPSED" -lt 30 ]; then
    exit 0
  fi
fi

# Determine the base name without extension
BASENAME=$(basename "$FILE_PATH" .ts)
DIR=$(dirname "$FILE_PATH")

# Strategy 1: Colocated test (same directory)
COLOCATED="$DIR/$BASENAME.test.ts"
if [ -f "$COLOCATED" ]; then
  echo "Running colocated test: $COLOCATED"
  date +%s > "$DEBOUNCE_FILE"
  npx vitest run "$COLOCATED" --reporter=verbose 2>&1 | tail -20
  exit 0
fi

# Strategy 2: Search in tests/ directories for matching name
if [ -n "$CLAUDE_PROJECT_DIR" ]; then
  FOUND=$(find "$CLAUDE_PROJECT_DIR" -name "$BASENAME.test.ts" -not -path "*/node_modules/*" 2>/dev/null | head -1)
  if [ -n "$FOUND" ]; then
    echo "Running related test: $FOUND"
    date +%s > "$DEBOUNCE_FILE"
    npx vitest run "$FOUND" --reporter=verbose 2>&1 | tail -20
    exit 0
  fi
fi

# No matching test found — that's fine, not every file has one
exit 0
