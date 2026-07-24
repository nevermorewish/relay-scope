# RelayScope

**LLM API 监测台：自托管的 AI API、中转站与模型服务监测面板。**

RelayScope 面向需要同时使用多个 AI API 的个人和小团队，集中查看余额、人民币费用、价格倍率、真实生成成功率、平均延迟、模型状态和告警。支持 New API、SUB2API 与通用 OpenAI Compatible 服务，适用于中转站监测、模型 API 监测和大模型接口可用性检查。

> [!IMPORTANT]
> RelayScope 会在本机保存 API 凭证和账户数据。官方配置只建议在个人电脑或可信内网运行，不建议把管理面板直接暴露到公网。

## 功能

- **多站点统一比较**：按站点、分组和模型筛选，比较人民币价格、倍率、余额、成功率与延迟。
- **低成本真实测试**：轻量检查不发送生成请求；真实测试只生成极少 Token，并在同一 API 凭证上自动串行。
- **多分组与多模型**：一个站点可配置多套 API Key，每个分组可轮换监测多个模型。
- **动态价格观测**：支持官方价格、充值比例和分组倍率计算，也能根据 New API/A6API 消费日志还原动态路由价格。
- **费用观测**：按建站后的余额下降汇总实际人民币消费、时间趋势和站点费用排行。
- **状态与告警**：区分轻量连通异常和真实模型失败，跟踪恢复，支持逐条或一键确认告警以及飞书 Webhook。
- **原地配置管理**：可在上游列表或站点详情直接编辑站点信息，并在详情页维护分组和模型。
- **本地数据与备份**：SQLite 单文件存储，按保留天数清理历史，提供一致性快照备份。
- **响应式界面**：支持浅色/深色主题、桌面端和移动端查看。

## Windows 快速开始

要求：Windows 10/11、[Node.js 22.5 或更高版本](https://nodejs.org/)和可访问 npm 的网络。

1. 在 GitHub Release 下载并解压 Source code。
2. 双击 `Setup RelayScope.cmd`。
3. 脚本会生成仅保存在本机的随机密钥、安装依赖、初始化 SQLite、完成生产构建并打开网页。
4. 安装完成后，桌面会出现 `Start RelayScope` 和 `Stop RelayScope` 两个快捷方式。
5. 双击启动快捷方式会运行服务并打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)；双击关闭快捷方式会停止服务和自动监测。

首次安装脚本不会打印生成的密钥，也不会覆盖已有 `.env.local` 或数据库。项目移动到其他目录后，需要重新运行安装脚本以更新桌面快捷方式。也可在项目目录中直接双击 `Start RelayScope.cmd` 或 `Stop RelayScope.cmd`。

## Docker

要求：Docker Desktop 或 Docker Engine with Compose。

```bash
cp .env.docker.example .env
# 将 .env 中两个占位值替换为彼此不同的随机字符串
docker compose up -d --build
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.docker.example .env
docker compose up -d --build
```

打开 [http://127.0.0.1:3000](http://127.0.0.1:3000)。SQLite 数据保存在 Docker volume `monitor_data`，应用默认只监听本机地址。

停止服务：

```bash
docker compose down
```

不要在需要保留数据时执行 `docker compose down -v`，它会删除数据卷。

## macOS、Linux 与手动安装

项目固定使用 pnpm 11.9.0：

```bash
corepack enable
corepack prepare pnpm@11.9.0 --activate
cp .env.example .env.local
# 编辑 .env.local，替换 APP_ENCRYPTION_KEY、CRON_SECRET 和 ADMIN_PASSWORD
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:init
pnpm build
pnpm start
```

开发模式使用 `pnpm dev`。生产使用应先执行 `pnpm build`，再运行 `pnpm start`。

## 使用流程

1. 在“上游管理”添加站点，填写名称、API 地址和充值比例。
2. 为站点添加分组、专用监测 API Key 和至少一个模型。
3. 执行单模型测试，确认模型名称、流式响应和凭证兼容。
4. 根据需要补充 Access Token 与用户 ID，以读取部分 New API 平台的余额、日志和动态倍率。
5. 开启自动监测。网站服务停止后，本机调度也会随之停止。

页面内置“使用帮助”，包含配置关系、测试成本、价格公式、状态口径、告警、备份和常见问题。

## 监测与 Token 消耗

| 类型 | 默认频率 | 内容 | 模型 Token |
| --- | --- | --- | --- |
| 轻量检查 | 每分钟 | 余额、模型列表、基础连通性 | 不发送生成请求 |
| 自动真实测试 | 每 15 分钟 | 每个启用分组轮换测试一个模型 | 少量 |
| 手动模型测试 | 用户点击 | 指定凭证与模型的真实生成 | 少量 |

真实请求最多生成 5 Token。不同 API 凭证可以并行，同一站点地址与 API Key 的任务会自动排队，避免自身并发冲突。

> [!WARNING]
> 自动真实测试和手动模型测试都会向上游发送真实 API 请求，产生少量 Token 消耗和费用；轻量余额、模型列表与基础连通检查不发送生成请求。

## 指标口径

- **余额**：站点账户的共享余额，按照“1 元人民币获得的美元额度”统一换算成人民币，不按分组重复相加。
- **价格**：输入、输出、缓存读取和缓存写入均按每 100 万 Token 保存。
- **人民币价格**：`官方美元价格 × 分组倍率 ÷（1 元人民币获得的美元额度）`。
- **成功率**：最近 24 小时真实模型测试成功次数占比。
- **平均延迟**：最近 24 小时真实模型测试的完整响应耗时，界面以秒显示。
- **模型恢复**：真实测试失败后保持异常，只有同一模型下次真实测试成功才恢复；每分钟轻量检查不能覆盖模型异常。
- **最近探测**：对应最近一次真实生成测试，不是余额或模型列表检查。

New API/A6API 等动态路由平台会优先读取真实消费日志，还原本次路由的模型、输入、输出、缓存和分组倍率。日志读取本身不消耗模型 Token；实际数据优先于公开价格目录。

## 费用观测

侧栏“费用观测”提供今日、近 7 天、近 30 天、全部和自定义时间范围。主金额逐段累计站点共享余额的下降量，并使用消费发生时的充值比例换算为实际人民币；余额增加只更新新基线，不会抵消历史消费。首个成功余额快照作为零基线，因此不会计入添加站点前的消费。消费趋势会按范围自动选择粒度：短范围按 15 分钟、近 7 天按 6 小时、近 30 天按天，更长范围按周或月；选择单个站点时主趋势自动切换为该站点。

费用观测只展示能够由余额下降统一核对的站点级费用，不展示分组或模型费用，也不会根据局部日志推测未知消费的归属。站点费用流水不随普通监测指标的保留期清理；删除站点时，对应费用流水一并删除。

费用趋势依赖 RelayScope 运行期间取得的余额快照。服务停止期间不会采样；重新启动后发现的余额净下降会集中记在首个新快照，能够补到账户净消费，但不能还原真实消费时间。如果停机期间同时发生充值和消费，只能观察到两者的净余额变化。

## 安全边界

- API Key 和 Access Token 使用 `APP_ENCRYPTION_KEY` 经 AES-256-GCM 加密后写入 SQLite。
- 浏览器常规接口不会返回密钥明文；只有用户显式点击小眼睛时才通过专用端点读取单个凭证。
- `.env`、`.env.local`、数据库、备份、日志和本地 Agent 目录均不得提交 Git。
- 默认 Docker 端口绑定为 `127.0.0.1:3000`，免登录模式只适合本机或可信内网。
- 如果自行改造为公网服务，需要自行启用登录保护、HTTPS、防火墙、访问控制、速率限制和凭证轮换。

公开 GitHub 源码不会包含部署者自己的 API 数据；风险来自错误上传运行数据，或把正在运行的管理面板直接暴露给他人。

## 登录保护

本机默认启用免登录模式。需要登录时：

1. 将 `.env.local` 中 `AUTH_DISABLED` 和 `NEXT_PUBLIC_AUTH_DISABLED` 改为 `false`。
2. 设置安全的 `ADMIN_PASSWORD`。
3. 执行 `pnpm db:seed` 创建用户名为 `admin` 的管理员。
4. 重新执行 `pnpm build` 并启动服务。

## 备份与恢复

Git 只保存源码，不保存 SQLite、凭证或本机配置。手动完整备份：

```bash
pnpm db:backup
```

备份位于 Git 忽略的 `backups/<时间>/`，包含 SQLite 一致性快照、`.env.local` 和清单。它同时包含数据库与解密材料，属于敏感数据，不能上传或分享。

恢复时：

1. 停止 RelayScope。
2. 备份当前数据。
3. 用目标备份的 `dev.db` 替换 `prisma/dev.db`。
4. 用目标备份的 `.env.local` 替换项目根目录同名文件。
5. 删除旧的 `prisma/dev.db-wal` 和 `prisma/dev.db-shm`。
6. 重新启动服务。

## 开发与验证

技术栈：Next.js 14.2.35 App Router、TypeScript、Prisma、SQLite、Tailwind CSS。

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

架构和扩展边界参见 [docs/architecture.md](docs/architecture.md)，贡献流程参见 [CONTRIBUTING.md](CONTRIBUTING.md)，安全问题请阅读 [SECURITY.md](SECURITY.md)。

## 项目来源与许可证

RelayScope 基于 [yigehaozi/relay-status-monitor](https://github.com/yigehaozi/relay-status-monitor) 的 MIT 许可代码进行二次开发，并在此基础上扩展了多模型监测、价格与倍率观测、动态路由计价、并发队列、本地备份、帮助文档和响应式管理体验。

本项目继续采用 [MIT License](LICENSE)。你可以自行使用、修改和重新部署，但应保留许可证及原项目版权声明。
