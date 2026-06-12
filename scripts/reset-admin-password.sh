#!/usr/bin/env bash
set -euo pipefail

# reset-admin-password.sh — Safely update ADMIN_PASSWORD and ADMIN_JWT_SECRET in .env.
# Usage: bash scripts/reset-admin-password.sh [path-to-env]
#
# This script:
#   1. Backs up the current .env
#   2. Prompts for a new password (no echo)
#   3. Generates a new ADMIN_JWT_SECRET (invalidates all existing tokens)
#   4. Updates the .env file in-place
#   5. Prints a reminder to restart the service
#
# Security: Never prints the password or secret to stdout.

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  exit 1
fi

echo "=== ACG Pulse Admin Password Reset ==="
echo ""

# Backup
BACKUP="${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
cp "$ENV_FILE" "$BACKUP"
echo "Backup saved to: $BACKUP"

# Prompt for new password (no echo)
echo ""
read -rsp "Enter new ADMIN_PASSWORD: " NEW_PASS
echo ""
if [ -z "$NEW_PASS" ]; then
  echo "ERROR: Password cannot be empty."
  exit 1
fi
if [ ${#NEW_PASS} -lt 8 ]; then
  echo "ERROR: Password must be at least 8 characters."
  exit 1
fi

# Generate new JWT secret
NEW_JWT_SECRET=$(openssl rand -hex 32)

# Update .env using sed (portable)
# Replace ADMIN_PASSWORD=... (first occurrence)
if grep -q '^ADMIN_PASSWORD=' "$ENV_FILE"; then
  sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=__REDACTED__|" "$ENV_FILE"
  # Now write the real value (avoids sed escaping issues with special chars)
  python3 -c "
import sys
lines = open(sys.argv[1], 'r').readlines()
for i, line in enumerate(lines):
    if line.startswith('ADMIN_PASSWORD='):
        lines[i] = 'ADMIN_PASSWORD=' + sys.argv[2] + '\n'
        break
open(sys.argv[1], 'w').writelines(lines)
" "$ENV_FILE" "$NEW_PASS" 2>/dev/null || {
    # Fallback: use awk
    awk -v pass="$NEW_PASS" '/^ADMIN_PASSWORD=/{$0="ADMIN_PASSWORD="pass}1' "$ENV_FILE" > "${ENV_FILE}.tmp" && mv "${ENV_FILE}.tmp" "$ENV_FILE"
  }
else
  echo "ADMIN_PASSWORD=${NEW_PASS}" >> "$ENV_FILE"
fi

# Replace ADMIN_JWT_SECRET=...
if grep -q '^ADMIN_JWT_SECRET=' "$ENV_FILE"; then
  sed -i "s|^ADMIN_JWT_SECRET=.*|ADMIN_JWT_SECRET=${NEW_JWT_SECRET}|" "$ENV_FILE"
else
  echo "ADMIN_JWT_SECRET=${NEW_JWT_SECRET}" >> "$ENV_FILE"
fi

echo ""
echo "ADMIN_PASSWORD and ADMIN_JWT_SECRET have been updated."
echo "All existing admin tokens are now invalid."
echo ""
echo "Next steps:"
echo "  Docker:   sudo docker compose up -d --force-recreate app"
echo "  Local:    Restart the backend process"
echo ""
echo "Verify with:"
echo "  curl -s -X POST http://localhost:3001/api/admin/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"password\":\"<your-new-password>\"}'"
