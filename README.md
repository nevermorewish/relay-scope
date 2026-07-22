# 中转站监控

面向个人自用的 AI API 中转站监控面板。支持 New API、SUB2API 和通用 OpenAI Compatible 站点，自动比较价格、倍率、余额、真实生成成功率、平均延迟和最近探测状态。

项目基于 MIT 许可的 [relay-status-monitor](https://github.com/yigehaozi/relay-status-monitor) 二次开发，保留原项目许可证。

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
2. 编辑站点并添加专用监测 Key，设置该分组使用的测试模型。
3. 先执行一次完整测试，确认模型列表、流式响应和余额接口兼容。
4. 在“模型价格”自动同步 New API 价格；其他站点手工录入输入、输出和缓存价格。
5. 启动网站服务后会自动开始监测，停止网站服务后监测也随之停止；真实生成探测频率在设置页配置，默认每 15 分钟执行。

## 指标口径

- 轻量探测：余额与 `/v1/models`，不发送生成请求。
- 真实生成探测：发送一次最多生成 5 Token 的短请求，同时记录成功率和完整响应延迟。
- 价格：输入、输出、缓存读取和缓存写入均按每 100 万 Token 保存。
- SUB2API 自动测价：累计 Token 或 `actual_cost` 变化时才保存记录，按初始基准自动验证倍率和实付价格；变化超过 5% 生成事件。
- 数据清理：每天自动删除超过设置中“数据保留天数”的探测明细、旧计价记录和已结束告警，并始终保留每个模型最新的计价依据。

## 安全

免登录模式只适合本机或受信任内网，不应直接暴露公网。API Key 和 Access Token 仍使用 AES-256-GCM 加密保存；`APP_ENCRYPTION_KEY` 必须使用至少 32 位随机值，且不能与数据库一起公开。

需要恢复登录保护时，将 `AUTH_DISABLED` 和 `NEXT_PUBLIC_AUTH_DISABLED` 设为 `false`，再通过 `pnpm db:seed` 创建管理员。

## 验证

```bash
pnpm test
pnpm lint
pnpm build
```

## License

MIT，详见 [LICENSE](LICENSE)。
