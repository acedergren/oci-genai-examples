#!/bin/bash
# Post-commit auto-push: runs tests + lint, then pushes if all pass.
# Triggered by PostToolUse on Bash after a successful "git commit".
set -e

INPUT=$(cat)

# Extract command and exit code from JSON
if command -v jq &>/dev/null; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")
  EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_result.exit_code // empty' 2>/dev/null || echo "")
else
  COMMAND=""
  EXIT_CODE=""
fi

# Only run after successful git commit
if ! echo "$COMMAND" | grep -q "git commit"; then
  exit 0
fi
if [ "$EXIT_CODE" != "0" ] && [ -n "$EXIT_CODE" ]; then
  exit 0
fi

if [ -z "$CLAUDE_PROJECT_DIR" ]; then
  echo "Error: CLAUDE_PROJECT_DIR not set" >&2
  exit 1
fi

cd "$CLAUDE_PROJECT_DIR" || exit 1

# Determine which workspaces have changes in the last commit
CHANGED=$(git diff --name-only HEAD~1 2>/dev/null || echo "")
HAS_FRONTEND=$(echo "$CHANGED" | grep -c '^oci-ai-chat/apps/frontend/' 2>/dev/null || echo 0)
HAS_API=$(echo "$CHANGED" | grep -c '^oci-ai-chat/apps/api/' 2>/dev/null || echo 0)
HAS_SHARED=$(echo "$CHANGED" | grep -c '^oci-ai-chat/packages/shared/' 2>/dev/null || echo 0)

ERRORS=""

# ── 1. Lint changed workspaces ──────────────────────────────────────────

if [ "$HAS_FRONTEND" -gt 0 ] && [ -d "oci-ai-chat/apps/frontend" ]; then
  echo "Lint: apps/frontend..."
  if ! (cd oci-ai-chat/apps/frontend && npx eslint src --quiet 2>&1 | tail -5); then
    ERRORS="${ERRORS}\nESLint failed in apps/frontend"
  fi
fi

if [ "$HAS_API" -gt 0 ] && [ -d "oci-ai-chat/apps/api" ]; then
  echo "Lint: apps/api..."
  if ! (cd oci-ai-chat/apps/api && npx eslint src --quiet 2>&1 | tail -5); then
    ERRORS="${ERRORS}\nESLint failed in apps/api"
  fi
fi

# ── 2. Type check changed workspaces ────────────────────────────────────

if [ "$HAS_API" -gt 0 ] && [ -d "oci-ai-chat/apps/api" ]; then
  echo "Typecheck: apps/api..."
  if ! (cd oci-ai-chat/apps/api && npx tsc --noEmit 2>&1 | tail -5); then
    ERRORS="${ERRORS}\ntsc failed in apps/api"
  fi
fi

if [ "$HAS_SHARED" -gt 0 ] && [ -d "oci-ai-chat/packages/shared" ]; then
  echo "Typecheck: packages/shared..."
  if ! (cd oci-ai-chat/packages/shared && npx tsc --noEmit 2>&1 | tail -5); then
    ERRORS="${ERRORS}\ntsc failed in packages/shared"
  fi
fi

# ── 3. Run tests for changed workspaces ─────────────────────────────────

if [ "$HAS_FRONTEND" -gt 0 ] || [ "$HAS_API" -gt 0 ] || [ "$HAS_SHARED" -gt 0 ]; then
  echo "Tests: running vitest..."
  if ! (cd oci-ai-chat && npx vitest run --reporter=dot 2>&1 | tail -20); then
    ERRORS="${ERRORS}\nVitest failed"
  fi
fi

# ── 4. Push if all gates pass ───────────────────────────────────────────

if [ -n "$ERRORS" ]; then
  echo ""
  echo "Post-commit checks FAILED — NOT pushing:$ERRORS" >&2
  echo "Fix issues and push manually."
  # Exit 0 so we don't block the already-completed commit
  exit 0
fi

# Check if we have a remote tracking branch
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ -z "$BRANCH" ]; then
  echo "Post-commit: could not determine branch, skipping push"
  exit 0
fi

UPSTREAM=$(git rev-parse --abbrev-ref "@{u}" 2>/dev/null || echo "")

echo "All checks passed — pushing $BRANCH..."
if [ -n "$UPSTREAM" ]; then
  git push 2>&1
else
  git push -u origin "$BRANCH" 2>&1
fi

echo "Auto-push complete."
exit 0
