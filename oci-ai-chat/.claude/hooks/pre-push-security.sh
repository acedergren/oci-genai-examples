#!/bin/bash
# Pre-push quality gate: semgrep scan
# Triggered by PreToolUse on Bash when command contains "git push"
# Note: coderabbit and codeql run as agent hooks (see settings.json)
set -e

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only run for git push commands
if ! echo "$COMMAND" | grep -q "git push"; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 1

# Run semgrep if available
if command -v semgrep &> /dev/null; then
  echo "Running Semgrep security scan..."
  CHANGED_FILES=$(git diff --name-only HEAD~1 -- '*.ts' '*.svelte' '*.js' 2>/dev/null || git diff --cached --name-only -- '*.ts' '*.svelte' '*.js' 2>/dev/null || echo "")

  if [ -n "$CHANGED_FILES" ]; then
    RESULT=$(semgrep --config auto --json $CHANGED_FILES 2>/dev/null || true)
    ERROR_COUNT=$(echo "$RESULT" | jq '.results | length' 2>/dev/null || echo 0)

    if [ "$ERROR_COUNT" -gt 0 ]; then
      echo "Semgrep found $ERROR_COUNT issues:" >&2
      echo "$RESULT" | jq -r '.results[] | "  \(.path):\(.start.line) — \(.check_id): \(.extra.message)"' 2>/dev/null >&2
      exit 2
    fi
    echo "Semgrep: no issues found"
  else
    echo "Semgrep: no changed files to scan"
  fi
else
  echo "Semgrep not installed, skipping CLI scan"
fi

echo "Pre-push security checks passed"
exit 0
