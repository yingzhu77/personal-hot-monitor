# ACG Pulse 部署指南

## 服务器信息

- **系统**: Ubuntu 24.04
- **配置**: 2核 CPU / 2GB 内存 / 30GB 磁盘（推荐）
- **区域**: 新加坡
- **域名**: acg.yingzhu.xyz

## 一键部署（推荐）

SSH 到服务器后执行：

```bash
curl -sL https://raw.githubusercontent.com/yingzhu77/personal-hot-monitor/master/auto-deploy.sh | bash
```

部署完成后：
1. 访问 `http://服务器IP:3001`
2. 登录管理后台（密码：acg2026）
3. 在「B站 Cookie 配置」中填入 Cookie
4. 重启服务

## 手动部署

## 部署步骤

### 1. SSH 连接服务器

```bash
ssh root@你的服务器IP
```

### 2. 安装 Docker

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# 安装 Docker Compose
apt install docker-compose-plugin -y
```

### 3. 配置防火墙

```bash
ufw allow 3001/tcp  # ACG Pulse
ufw allow 1200/tcp  # RSSHub（可选）
ufw allow 22/tcp    # SSH
ufw enable
```

### 4. 上传代码

```bash
cd /opt
git clone https://github.com/yingzhu77/personal-hot-monitor.git
cd personal-hot-monitor
```

### 5. 配置环境变量

```bash
cp .env.production.example .env
nano .env
```

必填配置：

```bash
ADMIN_PASSWORD=你的密码
ADMIN_JWT_SECRET=随机字符串
# AI Provider 三选一：
# 方案 A - OpenRouter：
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=你的key
# 方案 B - DeepSeek：
# AI_PROVIDER=deepseek
# DEEPSEEK_API_KEY=你的key
# 方案 C - Xiaomi MiMo Token Plan：
# AI_PROVIDER=mimo
# MIMO_API_KEY=tp-xxxxx
# MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1  # 中国集群（默认）
# MIMO_MODEL=mimo-v2.5
MAX_FEED_ITEMS=2000
```

### 6. 启动服务

```bash
docker compose up -d
```

### 7. 验证

```bash
# 检查容器状态
docker compose ps

# 访问测试
curl http://localhost:3001/api/public/stats
```

## 更新部署

```bash
cd /opt/personal-hot-monitor
git pull origin master
docker compose up -d --build
```

## 数据备份

### 手动备份

```bash
# 使用备份脚本（推荐）
bash scripts/backup-db.sh

# 备份到指定目录，保留最近 10 份
bash scripts/backup-db.sh game-pulse /opt/backups 10

# 手动方式
docker exec game-pulse cp /app/server/data/prod.db /app/server/data/prod.db.bak
docker cp game-pulse:/app/server/data/prod.db ./backup/
```

### 定时备份（推荐）

```bash
# 每天凌晨 3 点自动备份，保留 7 份
crontab -e
# 添加：
0 3 * * * cd /opt/personal-hot-monitor && bash scripts/backup-db.sh >> /var/log/acg-backup.log 2>&1
```

### 恢复数据库

```bash
# 从备份恢复
bash scripts/restore-db.sh ./backups/prod_20260612_030000.db

# 恢复脚本会自动：校验 SHA256 → 创建回退快照 → 停止服务 → 替换数据库 → 重启服务
```

## 源健康监控

源健康历史每 30 分钟自动记录。查看健康状态：

```bash
# 查看源健康历史统计
curl http://localhost:3001/api/public/source-health-history

# 查看服务状态（包含 checker 运行状态）
curl http://localhost:3001/api/health
```

健康历史接口返回：
- `recentLogs`：最近 24 小时的检查日志
- `sourceStats`：每个源的失败率统计
- `totalChecks24h` / `totalFailures24h`：24 小时总检查/失败次数

## 常见问题

### 内存不足
```bash
# 检查内存使用
docker stats

# 限制容器内存
# 在 docker-compose.yml 中添加
deploy:
  resources:
    limits:
      memory: 512M
```

### RSSHub 连接失败
```bash
# 检查 RSSHub 容器
docker compose logs rsshub

# 重启 RSSHub
docker compose restart rsshub
```

### 数据库锁定
```bash
# 检查数据库文件
ls -la /app/server/data/

# 如果锁定，重启应用
docker compose restart app
```
