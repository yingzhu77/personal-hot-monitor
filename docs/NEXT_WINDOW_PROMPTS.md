# 后续小窗口任务提示词

> 用法：按优先级从上到下分配给新的 Codex/Claude Code 窗口。每个窗口只做一个任务，完成后必须更新本文件对应状态、补充踩坑记录，并运行该任务要求的验证命令。
>
> 通用约束：先读 `README.md`、`docs/AGENT_WORKFLOW.md`、`docs/ROADMAP.md`、`docs/LESSONS.md`、`docs/DECISIONS.md`。不要重构无关代码，不要覆盖其他窗口未提交改动。涉及 UI 必须做桌面和移动端截图验证。涉及后端必须补测试或说明为什么不能补。

## P0-1 社区风向冷启动加载速度

**状态**：待执行

**提示词**：

```text
你在 D:\111222333\personal-hot-monitor 项目中工作。目标：优化“社区风向”页面冷启动加载速度，优先解决 /api/community/topics 在没有新鲜缓存时等待 refreshCommunityData 导致 30-60s 阻塞的问题。

请先阅读 README.md、docs/AGENT_WORKFLOW.md、docs/ROADMAP.md、docs/LESSONS.md，然后重点查看：
- server/src/gamepulse/routes/community.ts
- server/src/gamepulse/services/communityService.ts
- server/src/gamepulse/adapters/community.ts
- client/src/components/CommunityPanel.tsx
- server/prisma/schema.prisma

任务要求：
1. API 先返回已有数据库快照或空状态，不要让首屏等待完整刷新。
2. 当数据过期时在后台触发刷新，并避免多个请求重复刷新。
3. 响应中保留或新增足够前端提示的数据状态，例如 isRefreshing、lastUpdated、isStale；保持旧字段兼容。
4. 前端在后台刷新时显示轻量状态，不阻塞已有内容浏览。
5. 增加或更新测试覆盖 stale-first/background refresh 行为。
6. 更新 docs/ROADMAP.md 和 docs/NEXT_WINDOW_PROMPTS.md 状态；如发现新坑，更新 docs/LESSONS.md。

验收：
- npm --prefix server test
- npm --prefix server run build
- npm --prefix client run build
- 启动本地服务后分别用桌面和移动端截图确认社区风向页面不会长时间空白。
```

## P1-1 FTS5 生命周期与触发器自愈

**状态**：待执行

**提示词**：

```text
你在 D:\111222333\personal-hot-monitor 项目中工作。目标：加固 SQLite FTS5 全文搜索生命周期，避免 feed_item_fts 表存在但 trigger 缺失、损坏或迁移不完整时无法自愈。

请先阅读协作文档，再重点查看：
- server/src/gamepulse/search.ts
- server/src/gamepulse/routes/stories.ts
- server/src/gamepulse/index.ts
- server/prisma/schema.prisma
- server/src/**/*.test.ts

任务要求：
1. ensureFTS5 需要分别检查虚表、insert/update/delete triggers，而不是只因表存在就返回。
2. 缺失 trigger 时自动补齐；结构异常时给出明确日志。
3. 增加真实 SQLite 测试：创建数据、搜索、更新、删除后 FTS 结果一致。
4. 评估是否需要 admin rebuild FTS 入口；如果实现，必须有鉴权和测试。
5. 更新 docs/ROADMAP.md、docs/NEXT_WINDOW_PROMPTS.md；记录踩坑。

验收：
- npm --prefix server test
- npm --prefix server run build
- npm --prefix client run build
```

## P1-2 AI 分析队列一致性

**状态**：待执行

**提示词**：

```text
你在 D:\111222333\personal-hot-monitor 项目中工作。目标：修正 AI 分析队列的一致性风险，让批量重分析、失败重试和后台 worker 都通过同一套持久化队列路径。

请重点查看：
- server/src/gamepulse/analysisQueue.ts
- server/src/gamepulse/routes/admin.ts
- server/src/gamepulse/ai/analyzer.ts
- server/prisma/schema.prisma
- client/src/hooks/useAdmin.ts
- client/src/components/AdminDrawer.tsx

任务要求：
1. 检查 reanalyze-all 是否绕过持久化队列；若绕过，改为批量 enqueue。
2. 降低 app 层 open-task 检查的竞态风险；能用数据库唯一约束或事务 claim 就优先使用。
3. 失败重试、批量重试、运行中任务恢复要有清晰状态流转。
4. 前端管理后台显示不应误导：队列数量、失败任务和运行状态保持准确。
5. 增加后端测试覆盖重复入队、失败重试和并发 claim。
6. 更新相关文档。

验收：
- npm --prefix server test
- npm --prefix server run build
- npm --prefix client run build
```

## P1-3 管理后台运维与密码重置体验

**状态**：待执行

**提示词**：

```text
你在 D:\111222333\personal-hot-monitor 项目中工作。目标：进一步完善管理后台鉴权和运维体验，减少忘记密码、token 失效、本地/部署环境差异造成的困扰。

请重点查看：
- client/src/hooks/useAdmin.ts
- client/src/components/AdminDrawer.tsx
- server/src/gamepulse/routes/admin.ts
- server/src/gamepulse/config.ts
- docs/deployment-troubleshooting.md
- .env.production.example

任务要求：
1. 检查 token 失效后的前端交互是否稳定；必要时补充测试或抽出统一 401 处理。
2. 明确本地开发和 Docker 部署分别读取哪个 .env，以及修改 ADMIN_PASSWORD 后如何重启生效。
3. 增加一个安全的配置检查脚本或文档命令，避免 docker compose config 因缺少 env 误报。
4. 评估是否需要“重置管理员密码”的运维脚本；如实现，不要打印敏感值。
5. 更新 docs/deployment-troubleshooting.md、README.md 和本任务状态。

验收：
- npm --prefix server test
- npm --prefix server run build
- npm --prefix client run build
- 使用错误 token 打开设置面板，确认会回到登录态而不是报错卡住。
```

## P2-1 源健康历史保留策略

**状态**：待执行

**提示词**：

```text
你在 D:\111222333\personal-hot-monitor 项目中工作。目标：为 SourceHealthLog 增加保留策略，避免长期运行后数据库无限增长。

请重点查看：
- server/prisma/schema.prisma
- server/src/gamepulse/checker.ts
- server/src/gamepulse/jobs/*
- server/src/gamepulse/routes/stories.ts 或 source health routes

任务要求：
1. 增加可配置保留天数，默认例如 30 或 60 天。
2. 在定时任务或采集结束后清理过期日志，避免影响主流程。
3. 后台统计不能因日志清理而报错。
4. 增加测试覆盖清理逻辑。
5. 更新 docs/ROADMAP.md 和 docs/NEXT_WINDOW_PROMPTS.md。

验收：
- npm --prefix server test
- npm --prefix server run build
```

## P2-2 报告日期时区正确性

**状态**：待执行

**提示词**：

```text
你在 D:\111222333\personal-hot-monitor 项目中工作。目标：修正日报/周报日期范围依赖服务器本地时区的问题，确保 Docker/服务器 UTC 环境下仍按目标时区生成报告。

请重点查看：
- server/src/gamepulse/routes/reports.ts
- client/src/components/ReportExportButton.tsx
- docs/DECISIONS.md
- .env.production.example

任务要求：
1. 增加 REPORT_TIMEZONE 或明确固定 Asia/Shanghai 的日期边界策略。
2. 日报/周报查询范围使用目标时区的自然日/自然周。
3. 增加测试覆盖 UTC 服务器时区下的边界日期。
4. 前端导出文案若涉及日期，保持和后端一致。
5. 更新文档。

验收：
- npm --prefix server test
- npm --prefix server run build
- npm --prefix client run build
```

## P2-3 FTS 搜索深分页与召回

**状态**：待执行

**提示词**：

```text
你在 D:\111222333\personal-hot-monitor 项目中工作。目标：优化 FTS 搜索当前先取 1000 个匹配再叠加过滤的召回风险，避免广泛查询下漏掉后续符合筛选条件的结果。

请重点查看：
- server/src/gamepulse/search.ts
- server/src/gamepulse/routes/stories.ts
- server/src/gamepulse/routes/stories.test.ts

任务要求：
1. 评估使用 SQLite raw query join、临时匹配表或分页 FTS 查询的方案。
2. 保持现有 API 响应兼容，修正 total/facets 与最终过滤一致。
3. 增加测试构造超过 1000 条 FTS 命中且筛选目标在后段的场景。
4. 注意性能，不要回退到全量内存扫描。
5. 更新文档。

验收：
- npm --prefix server test
- npm --prefix server run build
```
