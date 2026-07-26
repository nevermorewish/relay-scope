'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CircleDollarSign,
  CircleHelp,
  Database,
  ExternalLink,
  Gauge,
  KeyRound,
  Network,
  Rocket,
  Search,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const GITHUB_URL = 'https://github.com/dante1007108174-droid/relay-scope';

interface HelpSectionDefinition {
  id: string;
  title: string;
  summary: string;
  keywords: string;
  icon: LucideIcon;
  content: ReactNode;
}

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const sections = useMemo(() => createHelpSections(), []);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSections = normalizedQuery
    ? sections.filter((section) => (
        `${section.title} ${section.summary} ${section.keywords}`.toLowerCase().includes(normalizedQuery)
      ))
    : sections;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BookOpen}
        title="使用帮助"
        description="了解如何在本机添加站点、执行测试、查看价格和处理告警"
        actions={(
          <Button variant="outline" size="sm" asChild>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              <ExternalLink data-icon="inline-start" />
              GitHub 文档
            </a>
          </Button>
        )}
      />

      <Card className="overflow-hidden border-primary/20 bg-primary/[0.03]">
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div>
            <Badge variant="outline" className="mb-3 border-primary/30 text-primary">第一次使用</Badge>
            <h2 className="text-xl font-bold">5 分钟完成第一个站点监测</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              创建站点后添加分组、API Key 和模型，先手动测试确认接口可用，再开启自动监测。真实模型测试会消耗少量 Token，余额和模型列表检查不会发送生成请求。
            </p>
            <div className="mt-3">
              <Notice icon={ShieldCheck}>本项目默认用于本机或可信内网。面板包含可操作的 API 凭证和账户数据，不建议直接暴露到公网。</Notice>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" asChild><Link href="/upstreams">前往上游管理</Link></Button>
              <Button size="sm" variant="outline" asChild><a href="#quick-start">查看完整步骤</a></Button>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1.5 text-center text-xs text-muted-foreground">
            {['添加站点', '添加分组', '选择模型', '手动测试', '自动监测'].map((label, index) => (
              <div key={label} className="min-w-0">
                <span className="mx-auto flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span>
                <div className="mt-2 break-words">{label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索：倍率、测试、Token、告警、备份……"
          className="pl-9"
          aria-label="搜索使用帮助"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <nav className="sticky top-6 space-y-1 rounded-lg border p-2" aria-label="帮助目录">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              return (
                <a key={section.id} href={`#${section.id}`} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Icon className="size-4 shrink-0" />
                  {section.title}
                </a>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 space-y-4">
          {visibleSections.length > 0 ? visibleSections.map((section) => (
            <HelpSection key={section.id} section={section} />
          )) : (
            <Card><CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
              <CircleHelp className="size-7 opacity-50" />
              <p>没有找到相关帮助内容</p>
              <Button size="sm" variant="ghost" onClick={() => setQuery('')}>清除搜索</Button>
            </CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}

function HelpSection({ section }: { section: HelpSectionDefinition }) {
  const Icon = section.icon;
  return (
    <Card id={section.id} className="scroll-mt-6">
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"><Icon className="size-4" /></span>
          <div>
            <CardTitle className="text-base">{section.title}</CardTitle>
            <CardDescription className="mt-1 leading-5">{section.summary}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-6">{section.content}</CardContent>
    </Card>
  );
}

function createHelpSections(): HelpSectionDefinition[] {
  return [
    {
      id: 'quick-start',
      title: '快速开始',
      summary: '从空白系统到完成第一次真实模型测试。',
      keywords: '开始 添加站点 分组 API Key 模型 自动监测',
      icon: Rocket,
      content: (
        <ol className="space-y-3">
          <Step number={1} title="添加站点">在“上游管理”点击“添加上游”，填写名称、API 地址和充值比例。API 地址通常填写服务商提供的 OpenAI 兼容地址。</Step>
          <Step number={2} title="添加分组">一个分组代表一套 API 凭证和计价倍率。同一站点可添加多个分组，但站点余额是共享的，不会按分组重复相加。</Step>
          <Step number={3} title="添加模型">每个分组至少添加一个监测模型。内置价格库能匹配时会自动填入官方价格，未匹配时需要手动填写。</Step>
          <Step number={4} title="执行单模型测试">点击模型右侧闪电按钮，验证这套 API Key 是否能真实生成内容。测试会发送一个极短请求并消耗少量 Token。</Step>
          <Step number={5} title="开启自动监测">在上游管理开启自动监测。只有网站服务正在运行且开关已开启时，后台调度才会工作。</Step>
        </ol>
      ),
    },
    {
      id: 'structure',
      title: '站点、分组与模型',
      summary: '理解三层关系后，配置和排查会更直观。',
      keywords: '上游 站点 分组 模型 Key 凭证 余额 New API SUB2API',
      icon: Network,
      content: (
        <div className="grid gap-3 md:grid-cols-3">
          <Definition title="站点" description="一个中转服务商或 API 地址。保存站点名称、基础地址、充值比例和共享余额。" />
          <Definition title="分组" description="站点下的一套 API Key、倍率和分组名称。不同分组可以有不同价格与可用模型。" />
          <Definition title="模型" description="分组中需要真实测试的模型。同一分组可以监测多个模型，并可单独点击测试。" />
          <div className="md:col-span-3 rounded-lg border border-dashed p-3 text-muted-foreground">
            关系示例：wawaapi（站点）→ gpt监测（分组/API Key）→ gpt-5.6-sol（模型）。余额属于站点账户，因此多个分组不会重复累加余额。
          </div>
        </div>
      ),
    },
    {
      id: 'credentials',
      title: '凭证分别有什么用',
      summary: 'API Key 负责模型请求，部分平台还需要账户凭证读取余额和日志。',
      keywords: 'API Key Access Token 用户 ID 小眼睛 掩码 需配置 New API',
      icon: KeyRound,
      content: (
        <div className="space-y-3">
          <Definition title="API Key" description="真实模型测试的核心凭证，通常是 sk- 开头。默认以星号掩码保存，点击小眼睛才会读取完整内容。" />
          <Definition title="Access Token 与用户 ID" description="主要用于部分 New API 平台读取账户余额、消费日志和动态倍率。缺少它们时，API Key 仍可能正常完成模型测试，但账户信息会提示“需配置”。" />
          <Notice icon={ShieldCheck}>凭证使用 APP_ENCRYPTION_KEY 加密写入本机 SQLite。不要上传数据库、环境文件或备份，也不要把运行中的面板直接暴露到公网。</Notice>
        </div>
      ),
    },
    {
      id: 'testing',
      title: '监测与测试逻辑',
      summary: '区分无生成请求的轻量检查和会消耗 Token 的真实测试。',
      keywords: '轻量 重量 真实测试 测试全部 自动测试 Token 超时 并发',
      icon: Zap,
      content: (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground"><tr><th className="py-2 pr-3">操作</th><th className="py-2 pr-3">检查内容</th><th className="py-2 pr-3">消耗 Token</th><th className="py-2">执行方式</th></tr></thead>
            <tbody className="divide-y">
              <HelpTableRow name="轻量检查" detail="余额、模型列表和基础连通性" token="不会发送生成请求" execution="默认每分钟" />
              <HelpTableRow name="单模型测试" detail="指定 API Key 与指定模型的真实生成" token="少量" execution="手动点击" />
              <HelpTableRow name="站点立即测试" detail="该站点每个启用分组测试一个模型" token="少量" execution="优先选择最久未测试的模型" />
              <HelpTableRow name="测试全部" detail="所有站点的每个启用分组测试一个模型" token="少量" execution="不同凭证可并行，同凭证串行" />
              <HelpTableRow name="自动真实测试" detail="每轮为每个启用分组测试一个模型" token="少量" execution="默认每 15 分钟轮换模型" />
            </tbody>
          </table>
          <p className="mt-3 text-muted-foreground">测试超时默认 30 秒，可在“设置 → 系统配置”中调整。提高超时时间不会增加 Token，只会更晚判定请求失败。手动测试碰到同一 API Key 的自动任务时会等待前序任务结束，不会再因为其他站点正在检测而直接失败。</p>
        </div>
      ),
    },
    {
      id: 'pricing',
      title: '价格、倍率与充值比例',
      summary: '统一比较不同站点真实购买成本。',
      keywords: '价格 倍率 充值率 官方价格 输入 输出 A6API 动态价格 人民币 美元',
      icon: CircleDollarSign,
      content: (
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/50 p-4 font-mono text-sm">人民币价格 = 官方美元价格 × 分组倍率 ÷（1 元人民币获得的美元额度）</div>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>官方价格按每 100 万 Token 保存，输入和输出价格分别计算。</li>
            <li>侧栏“模型数据”可以按名称或厂商查询官方输入、输出、缓存价格、上下文和资料来源，点击列标题可切换排序；人民币优先显示厂商官方人民币价，缺失时才按固定参考汇率估算。版本化目录随 RelayScope 发布并在构建时自动校验，不会联网覆盖。</li>
            <li>“1 元人民币获得的美元额度”填写 1，表示 ¥1 获得 $1 额度；填写 10，表示 ¥1 获得 $10 额度。</li>
            <li>A6API 等动态路由平台会优先使用真实消费日志反推实际倍率和价格，公开目录价格仅作参考。</li>
            <li>价格或倍率按两位小数显示后没有发生变化时，不会重复创建价格告警。</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'metrics',
      title: '指标和状态说明',
      summary: '了解成功率、延迟、最近探测以及不同状态的判断含义。',
      keywords: '在线 降级 离线 未知 需配置 成功率 延迟 最近探测 状态',
      icon: Gauge,
      content: (
        <div className="grid gap-3 sm:grid-cols-2">
          <Definition title="24 小时成功率" description="最近 24 小时真实模型生成成功次数占比。90% 及以上显示绿色，低于 90% 显示红色。" />
          <Definition title="平均延迟" description="最近 24 小时真实模型测试的完整响应耗时，界面统一以秒显示。" />
          <Definition title="在线" description="基础连接正常，并且每个启用模型最近一次真实测试均未发现异常。" />
          <Definition title="降级" description="基础连接仍可用，但某个模型最近一次真实生成失败、超时或当前延迟明显偏高。轻量检查成功不会覆盖模型异常。" />
          <Definition title="离线" description="余额和基础连通检查都无法成功，通常需要检查地址、凭证或站点状态。" />
          <Definition title="未知 / 需配置" description="未知表示尚无有效检查；需配置表示缺少完整监测或账户读取信息，可点击进入编辑。" />
        </div>
      ),
    },
    {
      id: 'costs',
      title: '费用观测',
      summary: '查看全部站点总费用、站点排行以及单站点费用趋势。',
      keywords: '费用 成本 消费 趋势 站点 人民币',
      icon: CircleDollarSign,
      content: (
        <div className="space-y-3">
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>站点总消费逐段累计共享账户余额的下降量；充值、退款或其他余额增加只更新新基线，不会抵消历史消费。</li>
            <li>首个成功余额快照只建立基线，因此从站点加入 RelayScope 后开始统计。</li>
            <li>可筛选昨日、近 7 天、全部或自定义范围；主卡片同时固定显示今日消费、滚动近 30 天消费和不受时间范围影响的当前余额。</li>
            <li>趋势按范围自动使用 15 分钟、6 小时、天、周或月粒度；选择单个站点时主趋势自动切换为该站点。</li>
            <li>费用观测只展示能够由余额下降统一核对的站点级费用，不展示无法准确对账的分组或模型金额。</li>
            <li>人民币成本按消费发生时保存的充值比例换算；调整充值比例不会改写历史流水。</li>
          </ul>
          <Notice icon={AlertTriangle}>站点总消费是余额采样间的推算值。如果同一采集间隔内同时发生充值和消费，只能观察到净余额变化。</Notice>
        </div>
      ),
    },
    {
      id: 'incidents',
      title: '告警事件',
      summary: '区分需要自动恢复的运行异常和需要人工确认的价格变化。',
      keywords: '告警 恢复 确认 价格变化 倍率 异常 飞书 通知',
      icon: Bell,
      content: (
        <div className="space-y-3">
          <Definition title="运行异常" description="包括不可用、真实测试失败和延迟过高。连通异常可由后续轻量检查恢复；模型失败只有同一模型再次真实测试成功后才恢复。" />
          <Definition title="价格变化" description="表示倍率或价格基准发生变化，不存在技术意义上的“恢复”，需要用户点击“确认”。" />
          <Definition title="通知渠道" description="可在设置中配置飞书 Webhook。告警生成或运行异常恢复时，会向启用的渠道发送通知。" />
        </div>
      ),
    },
    {
      id: 'storage',
      title: '数据、备份与安全',
      summary: '监测记录会增长，但系统会按照保留天数自动清理。',
      keywords: '数据库 SQLite 硬盘 备份 恢复 清理 retention APP_ENCRYPTION_KEY 安全',
      icon: Database,
      content: (
        <div className="space-y-3">
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>SQLite 默认位于 <code className="rounded bg-muted px-1">prisma/dev.db</code>，普通指标明细默认保留 30 天；成本流水长期保留。</li>
            <li>执行 <code className="rounded bg-muted px-1">pnpm db:backup</code> 可备份数据库和 <code className="rounded bg-muted px-1">.env.local</code>。</li>
            <li>备份包含能够解密 API Key 的材料，不能上传 GitHub，也不能公开分享。</li>
            <li>源码 Git 版本不能替代数据备份；Git 不会保存数据库、站点凭证和本机配置。</li>
          </ul>
          <Notice icon={AlertTriangle}>官方版本只建议在本机或可信内网运行，并默认让 Docker 仅监听 127.0.0.1。若用户自行修改为远程访问，需要自行承担认证、HTTPS、防火墙和访问控制配置。</Notice>
        </div>
      ),
    },
    {
      id: 'faq',
      title: '常见问题',
      summary: '快速排查最常见的配置、超时和数据显示问题。',
      keywords: '常见问题 FAQ 超时 OpenCode 余额 未录入 自动监测 无数据',
      icon: CircleHelp,
      content: (
        <div className="space-y-2">
          <Faq question="为什么在其他客户端能用，监测却显示超时？">客户端通常使用流式响应，收到首段内容就开始展示；监测等待完整响应。还可能受到路由波动影响，可适当提高测试超时后再观察。</Faq>
          <Faq question="为什么能测试模型，却仍提示需配置？">API Key 足以完成生成测试，但部分 New API 平台还需要 Access Token 和用户 ID 才能读取余额、消费日志和动态倍率。</Faq>
          <Faq question="为什么价格显示未录入？">内置价格库没有匹配模型名称，或动态平台尚未产生可用于反推价格的消费日志。请检查模型名称格式或手动填写官方价格。</Faq>
          <Faq question="自动监测为什么没有运行？">确认网站服务正在运行、自动监测开关已开启、站点和分组没有暂停。关闭网站服务后，本机后台调度也会停止。</Faq>
          <Faq question="Windows 如何完全关闭 RelayScope？">右键系统托盘中的 RelayScope 图标并选择“退出 RelayScope”，或运行项目目录中的 <code>Stop RelayScope.cmd</code>。只关闭监测窗口不会停止服务；停止服务后自动监测也会停止。</Faq>
          <Faq question="监测数据会一直占用硬盘吗？">会持续产生少量指标记录，但系统每天清理超过数据保留天数的明细。可在设置中调整保留天数。</Faq>
          <Faq question="可以把监测面板直接放到公网吗？">不建议。面板包含 API 凭证、余额和测试操作，官方配置只面向本机或可信内网。源码可以自行修改，但远程部署的认证和网络安全需要部署者自行负责。</Faq>
        </div>
      ),
    },
  ];
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return <li className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{number}</span><div><div className="font-medium">{title}</div><div className="mt-0.5 text-muted-foreground">{children}</div></div></li>;
}

function Definition({ title, description }: { title: string; description: string }) {
  return <div className="rounded-lg border p-3"><div className="font-medium">{title}</div><p className="mt-1 text-muted-foreground">{description}</p></div>;
}

function Notice({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-muted-foreground"><Icon className="mt-1 size-4 shrink-0 text-warning" /><div>{children}</div></div>;
}

function HelpTableRow({ name, detail, token, execution }: { name: string; detail: string; token: string; execution: string }) {
  return <tr><td className="py-2.5 pr-3 font-medium">{name}</td><td className="py-2.5 pr-3 text-muted-foreground">{detail}</td><td className="py-2.5 pr-3 text-muted-foreground">{token}</td><td className="py-2.5 text-muted-foreground">{execution}</td></tr>;
}

function Faq({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg border px-3 py-2.5 open:bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">
        <span>{question}</span><span className="text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-2 border-t pt-2 text-muted-foreground">{children}</div>
    </details>
  );
}
