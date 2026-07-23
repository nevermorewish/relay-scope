# 贡献指南

感谢参与 RelayScope。提交改动前，请先阅读 [README](README.md) 和 [系统架构](docs/architecture.md)。

## 开发环境

需要 Node.js 22.5 或更高版本，并使用项目固定的 pnpm 11.9.0。默认使用 SQLite，无需独立数据库服务。复制 `.env.example` 为 `.env.local`，填写 `APP_ENCRYPTION_KEY`、`ADMIN_PASSWORD` 与 `DATABASE_URL`，然后执行：

```bash
pnpm install
pnpm db:generate
pnpm db:init
ADMIN_PASSWORD='local-only-password' pnpm db:seed
```

需要完整界面数据时，按 README 使用 `pnpm db:seed:demo`。不要把真实上游凭证、生产数据库或运行日志放进工作区。

## 提交改动

1. Fork 仓库，从 `main` 创建功能分支。
2. 保持改动聚焦，必要时同步更新 README 或架构文档。
3. 对行为改动补充测试；至少运行 `pnpm lint`、`pnpm exec tsc --noEmit` 和 `pnpm build`。
4. 检查提交内容不含 `.env`、数据库导出、截图中的真实信息、日志或凭证。
5. 创建 Pull Request，说明背景、实现、验证命令和兼容性影响。

## Pull Request 要求

- 标题清楚描述改动，不使用无意义的“修复若干问题”。
- UI 改动附上脱敏前后截图，并说明桌面端和 390px 移动端检查结果。
- 数据库 schema 改动说明升级方式、回滚风险和备份要求。
- 适配器改动说明所需远端接口、超时策略和错误脱敏方式。

## 讨论行为

参与项目时请遵守 [行为准则](CODE_OF_CONDUCT.md)。
