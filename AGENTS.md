# AGENTS.md

本文件给 AI 编程助手（OpenCode / Codex / Claude Code 等）使用，描述本仓库当前事实。

## 项目是什么

- 名称：relay-status-monitor（中转站监测）
- 用途：自托管的 AI API 中转站监控面板（余额、延迟、模型测试、告警）
- 栈：Next.js 14.2.35 App Router + TypeScript + Prisma + SQLite + Tailwind
- 包管理：pnpm
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

## 关键路径

| 区域 | 路径 |
| --- | --- |
| 页面 | `src/app/` |
| API | `src/app/api/` |
| 业务逻辑 | `src/lib/`（采集、告警、加密、适配器） |
| 上游适配器 | `src/lib/adapters/` |
| 数据模型 | `prisma/schema.prisma`（provider = sqlite） |
| 初始化脚本 | `scripts/init-sqlite.mjs` |
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
