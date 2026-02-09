#!/bin/bash
# Unified Bash PreToolUse dispatcher — single JSON parse, routes to handlers.
# Replaces 4 separate hooks (pre-commit, pre-push, block-bulk-staging, doc-drift)
# to avoid redundant JSON parsing on every Bash call.
set -e

INPUT=$(cat)

# Single JSON parse
if command -v jq &>/dev/null; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")
else
  COMMAND=""
fi

# Empty command — nothing to check
if [ -z "$COMMAND" ]; then
  exit 0
fi

# Extract the first command (before && or ;) for pattern matching
FIRST_CMD=$(echo "$COMMAND" | head -1 | sed 's/&&.*//' | sed 's/;.*//')

# ── Route: git commit ────────────────────────────────────────────────
if echo "$FIRST_CMD" | grep -q "git commit"; then
  exec "$CLAUDE_PROJECT_DIR/.claude/hooks/pre-commit-checks.sh" <<< "$INPUT"
fi

# ── Route: git push ──────────────────────────────────────────────────
if echo "$COMMAND" | grep -q "git push"; then
  # Run both pre-push security and doc-drift warning
  "$CLAUDE_PROJECT_DIR/.claude/hooks/pre-push-security.sh" <<< "$INPUT"
  PUSH_EXIT=$?
  # Doc-drift is advisory (always exits 0), run regardless
  "$CLAUDE_PROJECT_DIR/.claude/hooks/doc-drift-warning.sh" <<< "$INPUT" || true
  exit $PUSH_EXIT
fi

# ── Route: git add ───────────────────────────────────────────────────
if echo "$FIRST_CMD" | grep -q "git add"; then
  exec "$CLAUDE_PROJECT_DIR/.claude/hooks/block-bulk-staging.sh" <<< "$INPUT"
fi

# No matching route — allow the command
exit 0
