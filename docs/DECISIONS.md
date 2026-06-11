# 架构决策记录

本文档记录对长期维护有影响的项目决策。新增决策按时间倒序追加。

## 2026-06-12：日报/周报 Markdown 导出方案

**决策**：先实现 Markdown 格式的日报/周报导出，暂不引入 PDF 导出。

**原因**：
- Markdown 是纯文本，无需额外依赖，生成和消费成本最低。
- 复用现有 `/api/public/stories` 的查询和聚合逻辑，只加一层格式化。
- 前端通过 `window.open` 直接触发浏览器下载，无需额外状态管理。
- PDF 导出依赖重量级库（如 puppeteer、html2pdf.js），对 Docker 镜像大小和运行时内存有显著影响，需要独立评估。

**技术选型**：
1. **后端**：新增 `server/src/gamepulse/reports/markdownExport.ts` 生成 Markdown，`routes/handlers/reports.ts` 提供 API。
2. **API 边界**：`GET /api/public/reports/daily`（JSON）、`GET /api/public/reports/weekly`（JSON）、`GET /api/public/reports/export`（Markdown 下载）。
3. **筛选**：复用现有 `game`、`category`、`importance`、`visibility` 参数，时间范围通过 `date`（日报）或 `weekStart`（周报）控制。
4. **前端**：`ReportExportButton` 组件嵌入 SummaryColumn，提供"今日日报"和"本周周报"两个快捷下载项。

**影响**：
- 新增 3 个公开 API 端点，不影响现有接口。
- 前端 SummaryColumn 顶部新增导出按钮，不影响主页面布局。
- 后续 PDF 导出可基于同一数据源，用浏览器端方案（html2pdf.js）或服务端方案（puppeteer），独立评估后再实施。

## 2026-06-12：SQLite FTS5 全文搜索方案

**决策**：使用 SQLite FTS5 虚拟表实现全文搜索，替代 Prisma 的 LIKE '%keyword%' 查询。

**原因**：
- LIKE 查询全表扫描，10 万+ 数据量时延迟明显（200ms+）。
- FTS5 使用倒排索引，搜索延迟稳定在 10ms 以下。
- FTS5 是 SQLite 内置功能，无需外部依赖。

**技术选型**：
1. **不使用 content=FeedItem 模式**：Prisma 使用 UUID 主键，与 FTS5 的 rowid 关联复杂。
2. **独立 FTS5 表**：直接存储 feedItemId 和搜索字段，通过触发器自动同步。
3. **UNINDEXED 字段**：feedItemId 不参与搜索，只用于关联查询。
4. **降级方案**：FTS5 不可用时自动降级到 LIKE，保证功能连续性。

**影响**：
- 搜索性能显著提升（10 万+ 数据从 200ms+ 降至 10ms 以下）。
- 新增 FTS5 虚拟表和触发器，需要维护数据同步。
- 管理端新增 `/api/admin/search-index/rebuild` 接口用于重建索引。
- 部署后首次启动会自动创建 FTS5 索引。

## 2026-06-12：SQLite 备份采用脚本方案 + 源健康历史表 + checker 互斥锁

**决策**：
1. SQLite 备份/恢复用 shell 脚本实现，不引入外部队列或 cron 容器。
2. 新增 `SourceHealthLog` 表记录每次源检查结果，保留最近 24 小时统计。
3. `runGamePulseCheck` 增加内存互斥锁，未完成时跳过下一次触发。

**原因**：
- 备份脚本简单可靠，`sqlite3 .backup` 保证热备一致性，无需额外依赖。
- 源健康历史让运维可见"哪个源在什么时候失败、失败率多少"，而不只是当前状态。
- 定时任务互斥防止采集重叠导致重复数据或资源竞争，社区刷新已有类似 `fetchPromise` 模式。

**影响**：
- 部署后需要执行 Prisma schema 同步，确保 `SourceHealthLog` 表存在。
- 备份脚本可配合 crontab 实现定时备份。
- `/api/health` 接口现在包含 `checker.running` 状态。
- 新增 `/api/public/source-health-history` 接口提供健康历史统计。

## 2026-06-12：AI 分析队列先基于 Prisma/SQLite 持久化

**决策**：AI 分析队列从进程内数组迁移为 `AnalysisTask` 数据库任务表，先保留单进程 worker 和 5 秒节流，不引入 Redis/BullMQ 等外部队列。

**原因**：

- 当前部署以 SQLite/Prisma 为主，新增外部队列会显著增加部署和运维复杂度。
- 分析任务的核心痛点是重启丢任务、失败不可见和不可重试，数据库任务表已经能覆盖短期稳定性目标。
- `Analysis` 表继续表示对 feed item 的分析结果；`AnalysisTask` 只负责调度、重试、错误和耗时等运行态信息，避免改变公开 feed item/analysis API 行为。

**影响**：

- 新内容写入后创建 `pending` 任务，由后台 worker 消费并写回 `Analysis`。
- 服务启动时会把遗留 `running` 任务恢复为 `pending`，避免进程退出后卡死。
- 管理端可查看队列统计、最近任务和失败原因，并可手动重试单个或全部失败任务。
- 部署升级需要执行 Prisma schema 同步命令，确保 SQLite 中存在 `AnalysisTask` 表。

## 2026-06-12：项目级 Agent 协作规则放入 `docs/`

**决策**：项目级协作规则、路线图、踩坑记录和架构决策统一放在 `docs/` 下并进入 Git。根目录 `CLAUDE.md`、`AGENTS.md` 和 `.claude/` 保留为本地工具配置或个人偏好。

**原因**：

- `.claude/` 可能包含本地权限和工具状态，不适合作为共享事实来源。
- 根目录 `CLAUDE.md`、`AGENTS.md` 已被忽略，适合本地覆盖，不适合作为团队规范。
- `docs/` 已有部署、路线图和踩坑记录，适合成为跨 Agent 接力入口。

**影响**：

- 新 Agent 进入项目时优先读取 `README.md`、`docs/AGENT_WORKFLOW.md`、`docs/ROADMAP.md`、`docs/LESSONS.md`。
- 重大协作规则变化更新本文档。

## 2026-06-11：第一阶段先做基础治理

**决策**：在继续做性能和产品能力前，先完成 UTF-8 约定、Zod 输入校验、测试范围收敛和路线图沉淀。

**原因**：

- 项目已进入可部署阶段，主要风险从“能否跑通”转为“是否稳定、可维护、可接力”。
- 输入边界、测试重复执行和文档分散会放大后续 Agent 协作成本。

**影响**：

- 管理端写接口和公开查询接口优先使用 `server/src/gamepulse/validation.ts`。
- 测试只运行 `src/**/*.test.ts`，避免构建产物重复执行。
- 第二阶段集中处理性能、队列持久化、运维可观测性。

## 2026-06-09：AI 分类必须有代码层兜底

**决策**：AI 分类结果不能只依赖 prompt，必须在代码层做边界修正和 fallback。

**原因**：

- 不同 provider 的输出稳定性不同。
- 官方源和关注投稿存在明确分类边界，AI 可能跨组输出。

**影响**：

- `ensureAnalysis` 保留分类后处理。
- provider 接入必须验证 JSON 解析、超时、重试和 fallback。
