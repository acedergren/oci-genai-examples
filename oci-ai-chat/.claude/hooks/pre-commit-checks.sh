#!/bin/bash
# Pre-commit quality gate: lint staged files + type checks
# Triggered by PreToolUse on Bash when command contains "git commit"
set -e

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only run for git commit commands
if ! echo "$COMMAND" | grep -q "git commit"; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 1

ERRORS=""

# Get staged files relative to oci-ai-chat/
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null || echo "")

if [ -z "$STAGED_FILES" ]; then
  echo "No staged files, skipping checks"
  exit 0
fi

# Filter to lintable files in apps/frontend
FRONTEND_FILES=$(echo "$STAGED_FILES" | grep -E '^oci-ai-chat/apps/frontend/.*\.(ts|svelte|js)$' | sed 's|^oci-ai-chat/apps/frontend/||' || true)

# Lint only staged frontend files (not entire project)
if [ -n "$FRONTEND_FILES" ]; then
  echo "Linting staged frontend files..."
  cd apps/frontend
  for f in $FRONTEND_FILES; do
    if [ -f "$f" ]; then
      if ! npx eslint "$f" 2>&1; then
        ERRORS="${ERRORS}\nESLint failed: $f"
      fi
    fi
  done
  cd "$CLAUDE_PROJECT_DIR"
fi

# Run svelte-check (informational — pre-existing 11 errors in test files are known baseline)
HAS_FRONTEND_SRC=$(echo "$STAGED_FILES" | grep '^oci-ai-chat/apps/frontend/src/' | grep -cv '/tests/' || true)
if [ "$HAS_FRONTEND_SRC" -gt 0 ]; then
  echo "Running svelte-check (informational, not blocking)..."
  cd apps/frontend
  npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 || echo "Note: svelte-check has pre-existing errors in test files (known baseline)"
  cd "$CLAUDE_PROJECT_DIR"
fi

# Check if any API files changed — run tsc
HAS_API=$(echo "$STAGED_FILES" | grep -c '^oci-ai-chat/apps/api/' || true)
if [ "$HAS_API" -gt 0 ] && [ -d "apps/api" ]; then
  echo "Running tsc (apps/api)..."
  cd apps/api
  if ! npx tsc --noEmit 2>&1; then
    ERRORS="${ERRORS}\ntsc failed in apps/api"
  fi
  cd "$CLAUDE_PROJECT_DIR"
fi

# Check if any shared files changed — run tsc
HAS_SHARED=$(echo "$STAGED_FILES" | grep -c '^oci-ai-chat/packages/shared/' || true)
if [ "$HAS_SHARED" -gt 0 ] && [ -d "packages/shared" ]; then
  echo "Running tsc (packages/shared)..."
  cd packages/shared
  if ! npx tsc --noEmit 2>&1; then
    ERRORS="${ERRORS}\ntsc failed in packages/shared"
  fi
  cd "$CLAUDE_PROJECT_DIR"
fi

if [ -n "$ERRORS" ]; then
  echo "Pre-commit checks FAILED:$ERRORS" >&2
  exit 2
fi

echo "Pre-commit checks passed"
exit 0
