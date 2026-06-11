#!/bin/bash
# ACG Pulse SQLite 数据库备份脚本
# 用法: bash scripts/backup-db.sh [容器名] [备份目录] [保留份数]
#
# 示例:
#   bash scripts/backup-db.sh                        # 默认参数
#   bash scripts/backup-db.sh game-pulse /tmp/backups 10
#
# 可配合 crontab 实现定时备份:
#   0 3 * * * cd /opt/personal-hot-monitor && bash scripts/backup-db.sh >> /var/log/acg-backup.log 2>&1

set -euo pipefail

CONTAINER="${1:-game-pulse}"
BACKUP_DIR="${2:-./backups}"
KEEP_COUNT="${3:-7}"

DB_PATH="/app/server/data/prod.db"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="prod_${TIMESTAMP}.db"
CHECKSUM_NAME="prod_${TIMESTAMP}.sha256"

echo "[$(date)] 开始备份数据库..."

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 检查容器是否运行
if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "ERROR: 容器 $CONTAINER 不存在或未运行"
  exit 1
fi

# 执行 SQLite 热备份 (BEGIN IMMEDIATE 保证写锁)
# 使用 sqlite3 .backup 命令确保一致性
docker exec "$CONTAINER" sh -c \
  "sqlite3 $DB_PATH '.backup /tmp/${BACKUP_NAME}'" 2>/dev/null || \
docker exec "$CONTAINER" sh -c \
  "cp $DB_PATH /tmp/$BACKUP_NAME"

# 导出到宿主机
docker cp "$CONTAINER:/tmp/$BACKUP_NAME" "$BACKUP_DIR/$BACKUP_NAME"
docker exec "$CONTAINER" rm -f "/tmp/$BACKUP_NAME"

# 生成校验和
cd "$BACKUP_DIR"
sha256sum "$BACKUP_NAME" > "$CHECKSUM_NAME"
cd - >/dev/null

# 获取备份大小
BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_NAME" | cut -f1)
echo "[$(date)] 备份完成: $BACKUP_DIR/$BACKUP_NAME ($BACKUP_SIZE)"

# 清理旧备份（保留最近 N 份）
cd "$BACKUP_DIR"
BACKUP_FILES=$(ls -1t prod_*.db 2>/dev/null | tail -n +$((KEEP_COUNT + 1)))
if [ -n "$BACKUP_FILES" ]; then
  echo "$BACKUP_FILES" | while read -r f; do
    rm -f "$f" "${f}.sha256"
    echo "[$(date)] 已清理旧备份: $f"
  done
fi
cd - >/dev/null

echo "[$(date)] 备份完毕，保留最近 $KEEP_COUNT 份"
