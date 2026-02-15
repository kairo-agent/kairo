#!/usr/bin/env bash
# Pre-commit hook: Block above-BMP Unicode characters (emojis) in staged files.
# These characters cause "no low surrogate in string" errors in Claude Code sessions.
# All UI icons now use SVG components (see src/components/icons/LeadIcons.tsx).

# Get staged files (only added/modified, skip deleted)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

FOUND_EMOJI=0

for FILE in $STAGED_FILES; do
  # Skip if file doesn't exist (deleted)
  if [ ! -f "$FILE" ]; then
    continue
  fi

  # Skip binary files
  if file "$FILE" 2>/dev/null | grep -q "binary"; then
    continue
  fi

  # Check for emoji/symbol Unicode ranges using grep -P (PCRE)
  # Covers: Supplementary Multilingual Plane emojis, Dingbats, Misc Symbols, Variation Selectors
  MATCHES=$(grep -Pn '[\x{1F000}-\x{1FAFF}\x{2702}-\x{27B0}\x{2600}-\x{26FF}\x{FE0F}]' "$FILE" 2>/dev/null)

  if [ -n "$MATCHES" ]; then
    if [ "$FOUND_EMOJI" -eq 0 ]; then
      echo ""
      echo "ERROR: Above-BMP Unicode characters (emojis) detected in staged files."
      echo "These cause 'no low surrogate in string' errors in Claude Code."
      echo "Replace emojis with ASCII text labels or SVG icons."
      echo "See: src/components/icons/LeadIcons.tsx for icon components."
      echo ""
    fi
    echo "  $FILE:"
    echo "$MATCHES" | head -5 | sed 's/^/    /'
    FOUND_EMOJI=1
  fi
done

if [ "$FOUND_EMOJI" -eq 1 ]; then
  echo ""
  echo "Commit blocked. Fix the above files and try again."
  echo "To bypass (emergencies only): git commit --no-verify"
  exit 1
fi

exit 0
