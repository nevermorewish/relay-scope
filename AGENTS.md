# AGENTS.md

本文件给 AI 编程助手（OpenCode / Codex / Claude Code 等）使用，描述本仓库当前事实。

## 项目是什么

- 名称：RelayScope（LLM API 监测台）
- 用途：自托管的 AI API、中转站与模型服务监测面板（余额、价格、费用、延迟、模型测试、告警）
- 栈：Next.js 14.2.35 App Router + TypeScript + Prisma + SQLite + Tailwind
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
pnpm build
```

Windows 新用户可双击 `Setup RelayScope.cmd` 完成首次安装并生成桌面快捷方式；后续使用 `Start RelayScope.cmd` 启动、`Stop RelayScope.cmd` 关闭。

## 关键路径

| 区域 | 路径 |
| --- | --- |
| 页面 | `src/app/` |
| API | `src/app/api/` |
| 业务逻辑 | `src/lib/`（采集、告警、加密、适配器） |
| 费用观测 | `src/lib/cost-observation.ts`, `src/app/api/costs/`, `src/app/(dashboard)/costs/` |
| 模型资料库 | `src/lib/official-model-prices.ts`, `src/app/(dashboard)/models/` |
| 上游适配器 | `src/lib/adapters/` |
| 数据模型 | `prisma/schema.prisma`（provider = sqlite） |
| 初始化脚本 | `scripts/init-sqlite.mjs` |
| Windows 安装与启停 | `scripts/setup-windows.ps1`, `scripts/start-monitor.ps1`, `scripts/stop-monitor.ps1` |
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
3. **凭据**：上游 Key 用 `APP_ENCRYPTION_KEY` 加密存储；API/UI 不得回传明文密钥。
4. **认证**：生产关闭 `AUTH_DISABLED`；本地可用 `AUTH_DISABLED=true`。
5. **改 schema 后**：跑 `pnpm db:generate`，并按需要 `pnpm db:push` / `pnpm db:init`。
6. **风格**：跟随现有代码；不要无故加注释；不要擅自 commit。
7. **模型恢复语义**：轻量余额/模型列表检查不得覆盖最近一次真实模型测试失败；只有同一模型后续真实测试成功才恢复。
8. **部署边界**：官方默认配置仅面向本机或可信内网；Docker 只绑定 `127.0.0.1`，不得把免登录面板描述为适合直接暴露公网。
9. **费用口径**：站点总消费以建站后共享余额的相邻下降量为准，余额增加不抵消历史消费；当前只展示站点级费用，不采集或展示无法与余额严格对账的分组/模型费用。停服区间只能在恢复后按前后净余额差入账，不能还原消费时间；站点费用流水不受普通指标保留期清理。
10. **模型资料口径**：模型资料库是内置只读目录，价格统一为 USD / 100 万 Token，可按固定参考汇率仅作页面人民币估算展示；价格只使用厂商官方资料并随版本人工核验，聚合目录可用于发现候选模型及补充能力、模态和发布日期元数据，但不得作为价格权威来源；页面与费用计算必须共用 `src/lib/official-model-prices.ts`，不得建立第二套价格数据。
11. **详情测试并发语义**：站点详情的单模型手动测试按分组与模型建立独立执行通道，允许不同分组或模型并行；同一模型防止重复执行，自动采集和全站测试继续按凭证串行。

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
