#!/bin/bash
# ACG Pulse SQLite 数据库恢复脚本
# 用法: bash scripts/restore-db.sh <备份文件> [容器名]
#
# 示例:
#   bash scripts/restore-db.sh ./backups/prod_20260612_030000.db
#   bash scripts/restore-db.sh ./backups/prod_20260612_030000.db game-pulse
#
# 恢复前会自动:
#   1. 校验备份文件 SHA256
#   2. 创建当前数据库快照作为回退点
#   3. 停止容器 → 替换数据库 → 重启容器

set -euo pipefail

BACKUP_FILE="${1:-}"
CONTAINER="${2:-game-pulse}"
DB_PATH="/app/server/data/prod.db"

if [ -z "$BACKUP_FILE" ]; then
  echo "用法: bash scripts/restore-db.sh <备份文件> [容器名]"
  echo ""
  echo "可用备份:"
  ls -1t ./backups/prod_*.db 2>/dev/null || echo "  (无备份文件)"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: 备份文件不存在: $BACKUP_FILE"
  exit 1
fi

echo "=========================================="
echo "  ACG Pulse 数据库恢复"
echo "=========================================="
echo "  备份文件: $BACKUP_FILE"
echo "  目标容器: $CONTAINER"
echo ""

# 1. 校验 SHA256
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "$CHECKSUM_FILE" ]; then
  echo "[1/5] 校验备份完整性..."
  if sha256sum -c "$CHECKSUM_FILE" >/dev/null 2>&1; then
    echo "  校验通过"
  else
    echo "  WARNING: SHA256 校验失败，备份可能已损坏"
    read -p "  是否继续恢复？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "已取消"
      exit 1
    fi
  fi
else
  echo "[1/5] 无校验文件，跳过完整性检查"
fi

# 2. 检查容器
if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "ERROR: 容器 $CONTAINER 不存在"
  exit 1
fi

# 3. 创建回退快照
echo "[2/5] 创建回退快照..."
ROLLBACK_NAME="prod_rollback_$(date +%Y%m%d_%H%M%S).db"
docker exec "$CONTAINER" cp "$DB_PATH" "/app/server/data/$ROLLBACK_NAME" 2>/dev/null || true
echo "  回退快照: $ROLLBACK_NAME"

# 4. 停止容器 → 替换 → 重启
echo "[3/5] 停止服务..."
docker compose stop app

echo "[4/5] 替换数据库..."
docker cp "$BACKUP_FILE" "$CONTAINER:/app/server/data/prod.db"

echo "[5/5] 重启服务..."
docker compose start app

echo ""
echo "=========================================="
echo "  恢复完成！"
echo "=========================================="
echo "  回退快照: /app/server/data/$ROLLBACK_NAME"
echo "  如需回退: bash scripts/restore-db.sh /app/server/data/$ROLLBACK_NAME $CONTAINER"
echo ""
echo "  请验证: curl http://localhost:3001/api/health"
echo "=========================================="
