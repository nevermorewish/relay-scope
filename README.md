# 中转站监控

面向个人自用的 AI API 中转站监控面板。支持 New API、SUB2API 和通用 OpenAI Compatible 站点，自动比较价格、倍率、余额、真实生成成功率、平均延迟和最近探测状态。

基于 [relay-status-monitor](https://github.com/yigehaozi/relay-status-monitor)（MIT）二次开发，见 [LICENSE](./LICENSE)。


## 本地运行

要求 Node.js 20 或更高版本。

```bash
pnpm install
pnpm db:generate
pnpm db:init
pnpm dev
```

默认打开 [http://localhost:3000](http://localhost:3000)。本地配置默认启用免登录模式，数据库保存在 `prisma/dev.db`，不需要 PostgreSQL。

## Docker

复制 `.env.docker.example` 为 `.env`，替换密钥后运行：

```bash
docker compose up -d
```

应用监听 `http://localhost:3000`，SQLite 数据保存在 Docker volume `monitor_data`。

## 使用流程

1. 在“上游管理”添加站点，选择 New API、SUB2API 或 OpenAI 兼容类型。
2. 编辑站点并添加专用监测 Key，设置该分组使用的测试模型。New API 站点新增分组时会自动继承本站已保存的余额访问令牌和用户 ID；新增并启用的模型保存后会立即执行一次真实测试。
3. 先执行一次完整测试，确认模型列表、流式响应和余额接口兼容。
4. 在“模型价格”自动同步 New API 价格；其他站点手工录入输入、输出和缓存价格。
5. 启动网站服务后会自动开始监测，停止网站服务后监测也随之停止；真实生成探测频率在设置页配置，默认每 15 分钟执行。

## 指标口径

- 轻量探测：余额与 `/v1/models`，不发送生成请求。
- 真实生成探测：发送一次最多生成 5 Token 的短请求，同时记录成功率和完整响应延迟。
- 站点详情：分组卡片显示最近一次真实模型测试的延迟和时间，手动单模型测试完成后立即更新。
- 延迟：界面统一以秒显示；内部仍以毫秒保存和计算。真实模型测试默认等待 30 秒后才判定超时，可在系统设置中调整。
- 价格：输入、输出、缓存读取和缓存写入均按每 100 万 Token 保存。
- SUB2API 自动测价：累计 Token 或 `actual_cost` 变化时才保存记录，按初始基准自动验证倍率和实付价格；变化超过 5% 生成事件。
- 总览：可使用默认顺序，或按价格、成功率、延迟、倍率和余额排序；支持分页，并可按住整行实时拖动调整默认顺序（顺序保存在当前浏览器）。
- 数据清理：每天自动删除超过设置中“数据保留天数”的探测明细、旧计价记录和已结束告警，并始终保留每个模型最新的计价依据。

## 安全

免登录模式只适合本机或受信任内网，不应直接暴露公网。API Key 和 Access Token 仍使用 AES-256-GCM 加密保存；`APP_ENCRYPTION_KEY` 必须使用至少 32 位随机值，且不能与数据库一起公开。

需要恢复登录保护时，将 `AUTH_DISABLED` 和 `NEXT_PUBLIC_AUTH_DISABLED` 设为 `false`，再通过 `pnpm db:seed` 创建管理员。

## 手动备份与恢复

Git 只保存源码，不保存 SQLite 数据库、站点凭证或 `.env.local`。需要建立本机完整备份时手动执行：

```bash
pnpm db:backup
```

命令使用 SQLite 一致性快照，在 `backups/<时间>/` 中生成 `dev.db`、`.env.local` 和备份清单。该目录包含可解密 API Key 的完整材料，已被 Git 忽略，仍必须作为敏感数据保管。命令不会自动运行，也不会自动删除旧备份。

恢复时：先停止监测服务，备份当前数据，再用目标备份中的 `dev.db` 替换 `prisma/dev.db`、用 `.env.local` 替换项目根目录同名文件，并移除旧的 `prisma/dev.db-wal` 和 `prisma/dev.db-shm`，然后重新启动服务。

## 验证

```bash
pnpm test
pnpm lint
pnpm build
```

## License

MIT，详见 [LICENSE](LICENSE)。

## 聚合平台动态价格

New API/A6API 等会动态路由的聚合平台，在重量采集轮到某个模型时读取 `/api/log/self` 中最近一次真实路由日志，按日志里的模型、输出、缓存和分组倍率还原实际价格；日志读取不消耗模型 Token。累计用量中的 `actual_cost` 也可结合内置官方价格反推出该模型的有效倍率，真实日志和实测价格优先于公开价格目录。价格没有变化时不会重复写入，超过 24 小时会刷新一次基准；单次变化达到 5% 会生成价格变化事件，告警直接显示倍率旧值和新值，两位小数相同时不告警。
