#!/bin/bash
# Pre-commit quality gate: lint staged files + type checks
# Classifies errors as "introduced" (in staged files) vs "pre-existing" (elsewhere)
# Only blocks on introduced errors. Pre-existing errors are reported but don't block.
set -e

INPUT=$(cat)

# Safely extract command from JSON (handle jq not available)
if command -v jq &>/dev/null; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")
else
  COMMAND=""
fi

# Only run for git commit commands
if ! echo "$COMMAND" | grep -q "git commit"; then
  exit 0
fi

if [ -z "$CLAUDE_PROJECT_DIR" ]; then
  echo "Error: CLAUDE_PROJECT_DIR not set" >&2
  exit 1
fi

cd "$CLAUDE_PROJECT_DIR" || exit 1

INTRODUCED_ERRORS=""
PREEXISTING_ERRORS=""

# Get staged files (paths relative to git root)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || echo "")

if [ -z "$STAGED_FILES" ]; then
  echo "No staged files, skipping checks"
  exit 0
fi

# Helper: check if a file path is in the staged files list
is_staged_file() {
  local file_to_check="$1"
  echo "$STAGED_FILES" | grep -qF "$file_to_check"
}

# ── Frontend Lint ──────────────────────────────────────────────────────

FRONTEND_FILES=$(echo "$STAGED_FILES" | grep -E '^oci-ai-chat/apps/frontend/.*\.(ts|svelte|js)$' | sed 's|^oci-ai-chat/apps/frontend/||' || true)

if [ -n "$FRONTEND_FILES" ]; then
  echo "Linting staged frontend files..."
  if cd "oci-ai-chat/apps/frontend"; then
    while IFS= read -r f; do
      if [ -f "$f" ]; then
        LINT_OUTPUT=$(npx eslint "$f" 2>&1) || {
          INTRODUCED_ERRORS="${INTRODUCED_ERRORS}\nESLint: $f\n${LINT_OUTPUT}"
        }
      fi
    done <<< "$FRONTEND_FILES"
    cd "$CLAUDE_PROJECT_DIR" || exit 1
  fi
fi

# ── API Lint ───────────────────────────────────────────────────────────

API_FILES=$(echo "$STAGED_FILES" | grep -E '^oci-ai-chat/apps/api/.*\.(ts|js)$' | sed 's|^oci-ai-chat/apps/api/||' || true)

if [ -n "$API_FILES" ]; then
  echo "Linting staged API files..."
  if cd "oci-ai-chat/apps/api"; then
    while IFS= read -r f; do
      if [ -f "$f" ]; then
        LINT_OUTPUT=$(npx eslint "$f" 2>&1) || {
          INTRODUCED_ERRORS="${INTRODUCED_ERRORS}\nESLint: $f\n${LINT_OUTPUT}"
        }
      fi
    done <<< "$API_FILES"
    cd "$CLAUDE_PROJECT_DIR" || exit 1
  fi
fi

# ── svelte-check (informational — classify errors by file) ─────────────

HAS_FRONTEND_SRC=$(echo "$STAGED_FILES" | grep '^oci-ai-chat/apps/frontend/src/' | grep -cv '/tests/' 2>/dev/null || echo 0)
if [ "$HAS_FRONTEND_SRC" -gt 0 ]; then
  echo "Running svelte-check..."
  if cd "oci-ai-chat/apps/frontend"; then
    SVELTE_OUTPUT=$(npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1) || {
      # Parse svelte-check output to classify errors by file
      # Lines with errors look like: /path/to/file.ts:42:5 - error TS2345: ...
      INTRODUCED_COUNT=0
      PREEXISTING_COUNT=0
      while IFS= read -r line; do
        # Match lines that contain file paths with error indicators
        if echo "$line" | grep -qE '(Error|error)'; then
          # Extract the file path from the error line
          ERROR_FILE=$(echo "$line" | grep -oE '[^ ]+\.(ts|svelte|js)(:[0-9]+)?' | head -1 | sed 's/:.*//')
          if [ -n "$ERROR_FILE" ]; then
            # Check if this file is in our staged changes
            RELATIVE_FILE=$(echo "$ERROR_FILE" | sed "s|$CLAUDE_PROJECT_DIR/oci-ai-chat/apps/frontend/||" 2>/dev/null || echo "$ERROR_FILE")
            if echo "$FRONTEND_FILES" | grep -qF "$RELATIVE_FILE" 2>/dev/null; then
              INTRODUCED_COUNT=$((INTRODUCED_COUNT + 1))
            else
              PREEXISTING_COUNT=$((PREEXISTING_COUNT + 1))
            fi
          fi
        fi
      done <<< "$SVELTE_OUTPUT"

      if [ "$INTRODUCED_COUNT" -gt 0 ]; then
        INTRODUCED_ERRORS="${INTRODUCED_ERRORS}\nsvelte-check: ${INTRODUCED_COUNT} error(s) in staged files\n${SVELTE_OUTPUT}"
      fi
      if [ "$PREEXISTING_COUNT" -gt 0 ]; then
        PREEXISTING_ERRORS="${PREEXISTING_ERRORS}\nsvelte-check: ${PREEXISTING_COUNT} pre-existing error(s) in unstaged files (known baseline)"
      fi
    }
    cd "$CLAUDE_PROJECT_DIR" || exit 1
  fi
fi

# ── API tsc ────────────────────────────────────────────────────────────

HAS_API=$(echo "$STAGED_FILES" | grep -c '^oci-ai-chat/apps/api/' 2>/dev/null || echo 0)
if [ "$HAS_API" -gt 0 ] && [ -d "oci-ai-chat/apps/api" ]; then
  echo "Running tsc (apps/api)..."
  if cd "oci-ai-chat/apps/api"; then
    TSC_OUTPUT=$(npx tsc --noEmit 2>&1) || {
      # Parse tsc output: lines like "src/routes/foo.ts(42,5): error TS2345: ..."
      INTRODUCED_COUNT=0
      PREEXISTING_COUNT=0
      while IFS= read -r line; do
        if echo "$line" | grep -qE '^[^ ]+\.(ts|js)\([0-9]+'; then
          ERROR_FILE=$(echo "$line" | sed 's/(.*//')
          # Check if this file was staged
          FULL_PATH="oci-ai-chat/apps/api/$ERROR_FILE"
          if echo "$STAGED_FILES" | grep -qF "$FULL_PATH"; then
            INTRODUCED_COUNT=$((INTRODUCED_COUNT + 1))
          else
            PREEXISTING_COUNT=$((PREEXISTING_COUNT + 1))
          fi
        fi
      done <<< "$TSC_OUTPUT"

      if [ "$INTRODUCED_COUNT" -gt 0 ]; then
        INTRODUCED_ERRORS="${INTRODUCED_ERRORS}\ntsc (api): ${INTRODUCED_COUNT} error(s) in staged files\n${TSC_OUTPUT}"
      fi
      if [ "$PREEXISTING_COUNT" -gt 0 ]; then
        PREEXISTING_ERRORS="${PREEXISTING_ERRORS}\ntsc (api): ${PREEXISTING_COUNT} pre-existing error(s) in unstaged files"
      fi
    }
    cd "$CLAUDE_PROJECT_DIR" || exit 1
  fi
fi

# ── Shared tsc ─────────────────────────────────────────────────────────

HAS_SHARED=$(echo "$STAGED_FILES" | grep -c '^oci-ai-chat/packages/shared/' 2>/dev/null || echo 0)
if [ "$HAS_SHARED" -gt 0 ] && [ -d "oci-ai-chat/packages/shared" ]; then
  echo "Running tsc (packages/shared)..."
  if cd "oci-ai-chat/packages/shared"; then
    TSC_OUTPUT=$(npx tsc --noEmit 2>&1) || {
      INTRODUCED_COUNT=0
      PREEXISTING_COUNT=0
      while IFS= read -r line; do
        if echo "$line" | grep -qE '^[^ ]+\.(ts|js)\([0-9]+'; then
          ERROR_FILE=$(echo "$line" | sed 's/(.*//')
          FULL_PATH="oci-ai-chat/packages/shared/$ERROR_FILE"
          if echo "$STAGED_FILES" | grep -qF "$FULL_PATH"; then
            INTRODUCED_COUNT=$((INTRODUCED_COUNT + 1))
          else
            PREEXISTING_COUNT=$((PREEXISTING_COUNT + 1))
          fi
        fi
      done <<< "$TSC_OUTPUT"

      if [ "$INTRODUCED_COUNT" -gt 0 ]; then
        INTRODUCED_ERRORS="${INTRODUCED_ERRORS}\ntsc (shared): ${INTRODUCED_COUNT} error(s) in staged files\n${TSC_OUTPUT}"
      fi
      if [ "$PREEXISTING_COUNT" -gt 0 ]; then
        PREEXISTING_ERRORS="${PREEXISTING_ERRORS}\ntsc (shared): ${PREEXISTING_COUNT} pre-existing error(s) in unstaged files"
      fi
    }
    cd "$CLAUDE_PROJECT_DIR" || exit 1
  fi
fi

# ── Results ────────────────────────────────────────────────────────────

# Report pre-existing errors (informational, not blocking)
if [ -n "$PREEXISTING_ERRORS" ]; then
  echo ""
  echo "⚠ Pre-existing errors (not blocking commit):$PREEXISTING_ERRORS"
  echo ""
fi

# Block only on introduced errors
if [ -n "$INTRODUCED_ERRORS" ]; then
  echo "Pre-commit checks FAILED (errors in staged files):$INTRODUCED_ERRORS" >&2
  exit 2
fi

echo "Pre-commit checks passed"
exit 0
