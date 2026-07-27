# AGENTS.md

本文件给 AI 编程助手（OpenCode / Codex / Claude Code 等）使用，描述本仓库当前事实。

## 项目是什么

- 名称：RelayScope（LLM API 监测台）
- 用途：自托管的 AI API、中转站与模型服务监测面板（余额、价格、费用、延迟、模型测试、告警）
- 栈：Next.js 15.5.21 App Router + TypeScript + Prisma + SQLite + Tailwind
- 运行时：Node.js >= 22.5（初始化脚本使用 `node:sqlite`）
- 包管理：pnpm 11.9.0
- 默认端口：3000

## 本地常用命令

```bash
pnpm install
cp .env.example .env.local   # 填 APP_ENCRYPTION_KEY / ADMIN_PASSWORD / DATABASE_URL
pnpm db:generate
pnpm db:init
pnpm db:seed                 # 或 pnpm db:seed:demo（demo 需进程环境传入 DEMO_*）
pnpm db:backup               # 手动完整备份 SQLite 与 .env.local
pnpm dev
pnpm lint
pnpm test
pnpm catalog:validate
pnpm build
pnpm clean:build-residue     # 手动删除可重建的 Next/Prisma 构建残留
```

Windows 新用户可双击 `Setup RelayScope.cmd` 完成首次安装并生成单个 `RelayScope` 桌面快捷方式；服务已运行时快捷方式通过 Windows UI Automation 聚焦 Edge、Chrome、Brave、Vivaldi、Firefox 或 Opera 中已有的 RelayScope 标签，找不到才打开新标签，服务未运行时并行显示或聚焦本地启动页、预启动服务和初始化后台托盘，再由原标签进入监测台。托盘“打开监测台”复用同一单标签入口；连续启动由命名互斥锁合并。托盘右键可打开或退出，退出会关闭浏览器当前显示的 RelayScope 标签并同步停止服务；最小化时通过 Chromium 后台命令关闭标签但不恢复浏览器，退出过程中再次启动会立即显示启动页，等待关闭完成后自动接管并重启。`Start RelayScope.cmd` 与 `Stop RelayScope.cmd` 保留为无托盘备用入口。

浏览器启动页与监测台共用 RelayScope favicon；客户端 React 挂载后主动结束浏览器仍挂起的文档加载，再揭示监测台完整界面，避免内容已显示但标签仍呈现加载状态。

## 关键路径

| 区域 | 路径 |
| --- | --- |
| 页面 | `src/app/` |
| API | `src/app/api/` |
| 业务逻辑 | `src/lib/`（采集、告警、加密、适配器） |
| 费用观测 | `src/lib/cost-observation.ts`, `src/app/api/costs/`, `src/app/(dashboard)/costs/` |
| 模型数据 | `data/model-catalog.json`, `src/lib/official-model-prices.ts`, `src/lib/model-catalog-schema.ts`, `src/lib/model-catalog-validation.ts`, `src/app/(dashboard)/models/` |
| 上游适配器 | `src/lib/adapters/` |
| 管理 API 边界 | `src/lib/admin-api-input.ts`, `src/lib/alert-rule-semantics.ts` |
| 数据模型 | `prisma/schema.prisma`（provider = sqlite） |
| 初始化脚本 | `scripts/init-sqlite.mjs` |
| 构建残留清理 | `scripts/clear-build-residue.mjs` |
| Windows 安装与启停 | `scripts/setup-windows.ps1`, `scripts/launch-relayscope.ps1`, `scripts/tray-monitor.ps1`, `scripts/start-monitor.ps1`, `scripts/stop-monitor.ps1` |
| 文档 | `README.md`, `docs/architecture.md` |

## 环境变量（事实）

- `DATABASE_URL`：默认 `file:./dev.db`
- `APP_ENCRYPTION_KEY`：AES-256-GCM 密钥材料（代码中的正式名称，不是 ENCRYPTION_KEY）
- `CRON_SECRET`：采集调度鉴权
- `AUTH_DISABLED` / `NEXT_PUBLIC_AUTH_DISABLED`：本地可免登录；生产勿开
- `ADMIN_PASSWORD`：`pnpm db:seed` 创建 admin
- `DEMO_ADMIN_PASSWORD` / `DEMO_CRON_SECRET`：仅 demo seed，且须进程环境传入

## 硬约束

1. **不要提交密钥**：`.env`, `.env.local`, `backups/*`, 真实 API Key、Webhook。
2. **默认数据库是 SQLite**，不是 PostgreSQL；`DATABASE_URL` 形如 `file:./dev.db`。
3. **凭据**：上游 Key 用 `APP_ENCRYPTION_KEY` 加密存储；API/UI 常规响应不得回传明文密钥。API Key、Access Token 与 CRON_SECRET 仅在用户显式操作时通过专用端点读取；通知渠道列表只返回脱敏 Webhook 摘要。
4. **认证**：生产关闭 `AUTH_DISABLED`；本地可用 `AUTH_DISABLED=true`。
5. **改 schema 后**：跑 `pnpm db:generate`，并按需要 `pnpm db:push` / `pnpm db:init`。
6. **风格**：跟随现有代码；不要无故加注释；不要擅自 commit。
7. **模型恢复语义**：详情模型状态、最近检测和检测异常只认真实模型测试。轻量余额/模型列表检查不得覆盖最近一次真实模型测试失败；只有同一模型后续真实测试成功才恢复，手动真实测试结果需立即反映到详情页。
8. **部署边界**：官方默认配置仅面向本机或可信内网；Docker 只绑定 `127.0.0.1`，不得把免登录面板描述为适合直接暴露公网。
9. **费用口径**：站点总消费以建站后共享余额的相邻下降量为准，余额增加不抵消历史消费；当前只展示站点级费用，不采集或展示无法与余额严格对账的分组/模型费用。停服区间只能在恢复后按前后净余额差入账，不能还原消费时间；站点费用流水不受普通指标保留期清理。
10. **模型资料口径**：`data/model-catalog.json` 是模型数据的唯一内置只读快照，必须维护 `schemaVersion`、`catalogVersion`、`updatedAt` 并通过 `pnpm catalog:validate`。厂商官方 USD 与 CNY 价格均按每 100 万 Token 保存在同一价格记录中；人民币展示优先使用官方 CNY，缺失时才按固定参考汇率估算。价格只使用厂商官方资料并随版本人工核验，可确认的分档价格必须优先保存为数字化 tiers，只有数字不完整时才使用说明。聚合目录可用于发现与 models.dev 对齐的主流厂商近 6 个月通用大语言模型候选项及补充能力、模态和发布日期元数据；不收录专门图片生成或编辑型号，也不得把聚合目录作为价格权威来源。页面、自动填价与费用计算必须通过 `src/lib/official-model-prices.ts` 共用该 JSON，不得建立第二套价格数据。当前不得在未明确设计版本校验、缓存和内置回退前加入联网自动覆盖。
11. **详情测试并发语义**：站点详情的单模型手动测试按分组与模型建立独立执行通道，允许不同分组或模型并行；同一模型防止重复执行，自动采集和全站测试继续按凭证串行。
12. **站点状态语义**：任一启用分组在线时站点为在线；没有在线分组时再按降级、离线、未知聚合。自动监测的“检测中”只表示耗费 Token 的重量测试，轻量轮次不显示。
13. **告警事件语义**：倍率/价格变化使用 `PRICE_CHANGED`，需要用户确认；状态变更、凭证失效、连续 3 次限流和模型不可用属于可自动恢复的运行提醒，按事件类型去重，不应每轮采集重复创建。
13. **管理 API 输入**：系统设置、告警规则和通知渠道写接口必须使用服务端字段白名单与范围校验，不得把任意请求体直接传给 Prisma。
14. **Docker 构建上下文**：`.dockerignore` 必须持续排除本机环境文件、数据库、备份、依赖、构建产物和本地 Agent 目录；Docker 安装依赖前必须复制 `pnpm-workspace.yaml` 与 `.npmrc`，确保安全覆盖和 frozen lockfile 一致。
15. **构建缓存**：生产构建成功后必须运行 `scripts/clear-build-residue.mjs`，只删除 `.next/cache`、项目内 Prisma 下载缓存和临时引擎，不得删除 `.next/server`、`.next/static`、数据库、环境文件或备份。

## 文档同步

改行为、命令、环境变量或架构边界时，同步：

- `README.md`（用户入口）
- `docs/architecture.md`（系统边界）
- 本文件 `AGENTS.md`（给 AI 的事实）

## 不要做的事

- 不要把 `backups/`、`error.log`、截图、`.next/` 当源码提交
- 不要引入未在 package.json 出现的依赖而不说明
- 不要假设远程数据库或多实例部署是当前范围
- 不要把本地 agent 目录（`.agents/`、`.codex/`）当项目规范源提交
