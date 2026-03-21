#!/usr/bin/env bash
# ========================================
#   PLUGA OPERATIONS SECURITY CHECK
# ========================================
# Scans src/ for common security anti-patterns.
# Exit codes: 0 = clean, 1 = medium issues, 2 = critical/high issues

set -euo pipefail

SRC_DIR="src"
CRITICAL=0
HIGH=0
MEDIUM=0

RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "========================================"
echo "  PLUGA OPERATIONS SECURITY CHECK"
echo "========================================"
echo ""

# Helper: search and report
check() {
  local severity="$1"
  local description="$2"
  local pattern="$3"
  local glob="${4:-*.ts,*.tsx}"
  local exclude="${5:-node_modules}"

  local matches
  matches=$(grep -rn --include="*.ts" --include="*.tsx" -E "$pattern" "$SRC_DIR" 2>/dev/null | grep -v "$exclude" || true)

  if [ -n "$matches" ]; then
    case "$severity" in
      CRITICAL) echo -e "${RED}[CRITICAL]${NC} $description"; CRITICAL=$((CRITICAL + 1)) ;;
      HIGH)     echo -e "${YELLOW}[HIGH]${NC} $description"; HIGH=$((HIGH + 1)) ;;
      MEDIUM)   echo -e "${CYAN}[MEDIUM]${NC} $description"; MEDIUM=$((MEDIUM + 1)) ;;
    esac
    echo "$matches" | while IFS= read -r line; do
      echo "  $line"
    done
    echo ""
  fi
}

# ===== CRITICAL checks =====

# 1. Hardcoded Google API keys
check "CRITICAL" "Hardcoded Google API key found" "AIzaSy[a-zA-Z0-9_-]{33}"

# 2. eval / innerHTML / dangerouslySetInnerHTML
check "CRITICAL" "Dangerous DOM manipulation (eval/innerHTML)" "(dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\s*\(|new\s+Function\s*\()"

# 3. Hardcoded secrets/passwords
check "CRITICAL" "Hardcoded secret or password" "(password|secret|private.?key)\s*[:=]\s*['\"][^'\"]{8,}" "*.ts,*.tsx" "node_modules|\.example"

# ===== HIGH checks =====

# 4. Firestore writes without permission check
# Check files that have setDoc/updateDoc/deleteDoc but don't import requireEditPermission
for f in $(grep -rl --include="*.ts" --include="*.tsx" -E "(setDoc|updateDoc|deleteDoc|writeBatch)" "$SRC_DIR" 2>/dev/null | grep -v node_modules | grep -v "check-permission" || true); do
  # Skip files that are purely query/read hooks or the permission bootstrap
  if grep -qE "export async function (add|update|delete|assign|unassign|return|set|remove|apply)" "$f" 2>/dev/null; then
    if ! grep -q "requireEditPermission\|requireAdminPermission" "$f" 2>/dev/null; then
      echo -e "${YELLOW}[HIGH]${NC} Firestore writes without permission check"
      echo "  $f"
      echo ""
      HIGH=$((HIGH + 1))
    fi
  fi
done

# 5. Wildcard file accept attribute
check "HIGH" "Wildcard file accept (allows any file type)" "accept=['\"]?\*['\"]?" "*.tsx" "node_modules"

# 6. setDoc/updateDoc without stripUndefined
for f in $(grep -rl --include="*.ts" --include="*.tsx" -E "(setDoc|updateDoc)" "$SRC_DIR" 2>/dev/null | grep -v node_modules | grep -v ".d.ts" || true); do
  if grep -qE "export async function (add|update|assign|set)" "$f" 2>/dev/null; then
    if ! grep -q "stripUndefined" "$f" 2>/dev/null; then
      echo -e "${YELLOW}[HIGH]${NC} Firestore writes without stripUndefined"
      echo "  $f"
      echo ""
      HIGH=$((HIGH + 1))
    fi
  fi
done

# ===== MEDIUM checks =====

# 7. Unvalidated JSON.parse with type assertion
check "MEDIUM" "JSON.parse with type assertion (no Zod validation)" "JSON\.parse\(.*\)\s*as\s" "*.ts,*.tsx" "node_modules"

# 8. Console.log with potentially sensitive data
check "MEDIUM" "Console output with potentially sensitive data" "console\.(log|warn|error)\(.*\b(password|token|secret|apiKey|phoneNumber|medicalNotes)\b" "*.ts,*.tsx" "node_modules"

# ===== Summary =====
echo "========================================"
TOTAL=$((CRITICAL + HIGH + MEDIUM))
if [ $TOTAL -eq 0 ]; then
  echo -e "  ${GREEN}ALL CHECKS PASSED${NC}"
  echo "========================================"
  exit 0
else
  echo -e "  SUMMARY: ${RED}${CRITICAL} CRITICAL${NC}, ${YELLOW}${HIGH} HIGH${NC}, ${CYAN}${MEDIUM} MEDIUM${NC}"
  echo "========================================"
  if [ $CRITICAL -gt 0 ] || [ $HIGH -gt 0 ]; then
    exit 2
  fi
  exit 1
fi
