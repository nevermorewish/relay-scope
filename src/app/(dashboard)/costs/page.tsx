'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertCircle,
  CalendarDays,
  CircleDollarSign,
  Coins,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type SiteBreakdown = {
  upstreamId: number;
  upstreamName: string;
  type: string;
  costCny: number;
  costUsdCredit: number;
};
type TrendGranularity = '15m' | '6h' | 'day' | 'week' | 'month';
type TrendPoint = { bucketStart: string; costCny: number; costUsdCredit: number };
type CostsData = {
  summary: {
    costCny: number;
    costUsdCredit: number;
    todayCostCny: number;
    last30DaysCostCny: number;
    currentBalanceCny: number | null;
  };
  trendGranularity: TrendGranularity;
  trend: TrendPoint[];
  breakdown: SiteBreakdown[];
  coverage: Array<{
    upstreamId: number;
    upstreamName: string;
    coverageStartedAt: string;
    lastProcessedAt: string;
  }>;
  options: Array<{ id: number; name: string; type: string }>;
};
type Preset = 'yesterday' | '7d' | 'all' | 'custom';

export default function CostsPage() {
  const [data, setData] = useState<CostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>('all');
  const [upstreamId, setUpstreamId] = useState('ALL');
  const [customFrom, setCustomFrom] = useState(formatDateInput(monthStart(new Date())));
  const [customTo, setCustomTo] = useState(formatDateInput(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const range = getRange(preset, customFrom, customTo);
      const query = new URLSearchParams({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        timezoneOffset: String(new Date().getTimezoneOffset()),
      });
      if (upstreamId !== 'ALL') query.set('upstreamId', upstreamId);
      const response = await fetch(`/api/costs?${query}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '费用数据加载失败');
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [preset, customFrom, customTo, upstreamId]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('upstreamId');
    if (requested) setUpstreamId(requested);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const coverage = useMemo(
    () => new Map(data?.coverage.map((item) => [item.upstreamId, item]) || []),
    [data?.coverage],
  );

  return <div className="space-y-6">
    <PageHeader
      icon={CircleDollarSign}
      title="费用观测"
      description="总消费按建站后的共享账户余额下降量计算；充值和余额增加不会抵消历史消费。模型测试会产生少量费用。"
      actions={<TooltipProvider delayDuration={300}>
        <UiTooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin' : ''} />刷新
            </Button>
          </TooltipTrigger>
          <TooltipContent>重新读取当前筛选条件下的最新费用数据</TooltipContent>
        </UiTooltip>
      </TooltipProvider>}
    />

    <div className="flex flex-wrap gap-2">
      {([
        ['yesterday', '昨日'], ['7d', '近 7 天'], ['all', '全部'], ['custom', '自定义'],
      ] as Array<[Preset, string]>).map(([value, label]) => (
        <Button
          key={value}
          size="sm"
          variant={preset === value ? 'default' : 'outline'}
          onClick={() => setPreset(value)}
        >{label}</Button>
      ))}
    </div>

    <div className="flex flex-wrap gap-3">
      <Select value={upstreamId} onValueChange={setUpstreamId}>
        <SelectTrigger className="w-full md:w-[320px]"><SelectValue placeholder="全部站点" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">全部站点</SelectItem>
          {data?.options.map((site) => <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {preset === 'custom'
        ? <div className="flex max-w-md gap-2">
            <Input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
            <Input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
          </div>
        : null}
    </div>

    {error && <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="h-4 w-4" />{error}
    </div>}

    {loading && !data
      ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28" />)}</div>
      : data && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label={presetSummaryLabel(preset)} value={formatCny(data.summary.costCny)} icon={CircleDollarSign} />
          <SummaryCard label="今日消费" value={formatCny(data.summary.todayCostCny)} icon={Coins} />
          <SummaryCard label="近 30 天消费" value={formatCny(data.summary.last30DaysCostCny)} icon={CalendarDays} />
          <SummaryCard label="当前余额" value={data.summary.currentBalanceCny == null ? '—' : formatCny(data.summary.currentBalanceCny)} icon={Wallet} />
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="mb-4">
              <div className="font-medium">消费趋势</div>
              <div className="text-xs text-muted-foreground">
                逐段累计余额下降，{granularityLabel(data.trendGranularity)}汇总；无消费的时间段显示为 0
              </div>
            </div>
            {data.trend.length
              ? <div className="h-72 w-full">
                  <CostTrendChart data={data.trend} granularity={data.trendGranularity} id="allCost" />
                </div>
              : <EmptyState text="所选范围暂无余额下降记录" />}
          </CardContent>
        </Card>

        {upstreamId === 'ALL' && <Card>
          <CardContent className="p-0">
            <div className="border-b px-5 py-4">
              <div className="font-medium">站点消费排行</div>
              <div className="text-xs text-muted-foreground">比较各站点总消费；使用上方站点筛选查看单站点汇总与趋势</div>
            </div>
            {data.breakdown.length
              ? <SiteRanking
                  sites={data.breakdown}
                  coverage={coverage}
                  allSitesTotal={data.summary.costCny}
                />
              : <EmptyState text="暂无站点成本数据" />}
          </CardContent>
        </Card>}
      </>}
  </div>;
}

function SiteRanking({ sites, coverage, allSitesTotal }: {
  sites: SiteBreakdown[];
  coverage: Map<number, CostsData['coverage'][number]>;
  allSitesTotal: number;
}) {
  return <div className="divide-y">{sites.map((site) => {
    const siteCoverage = coverage.get(site.upstreamId);
    return <div key={site.upstreamId} className="flex flex-wrap items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{site.upstreamName}</span>
          <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
            {site.type}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {siteCoverage?.coverageStartedAt
            ? `从 ${new Date(siteCoverage.coverageStartedAt).toLocaleString('zh-CN')} 开始统计`
            : '尚未取得余额基线'}
        </div>
      </div>
      <div className="grid w-[300px] shrink-0 grid-cols-2 gap-4 text-right text-sm max-lg:w-[240px] max-sm:w-full">
        <Metric value={formatCny(site.costCny)} label="站点总消费" strong />
        <Metric value={allSitesTotal > 0 ? `${(site.costCny / allSitesTotal * 100).toFixed(1)}%` : '0%'} label="占全部站点" />
      </div>
    </div>;
  })}</div>;
}

function CostTrendChart({ data, granularity, id }: {
  data: TrendPoint[];
  granularity: TrendGranularity;
  id: string;
}) {
  return <div className="h-full w-full [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="bucketStart"
          minTickGap={24}
          tick={{ fontSize: 11 }}
          tickFormatter={(value) => formatTrendTick(String(value), granularity)}
        />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `¥${formatCompact(value)}`} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            borderColor: 'hsl(var(--border))',
            borderRadius: 'var(--radius)',
            color: 'hsl(var(--popover-foreground))',
          }}
          itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
          labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
          labelFormatter={(value) => formatTrendTooltip(String(value), granularity)}
          formatter={(value) => [formatCny(Number(value)), '消费']}
        />
        <Area type="monotone" dataKey="costCny" stroke="hsl(var(--primary))" fill={`url(#${id})`} />
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}

function Metric({ value, label, strong = false }: { value: string; label: string; strong?: boolean }) {
  return <div><div className={cn('tabular-nums', strong && 'font-semibold')}>{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
}

function SummaryCard({ label, value, icon: Icon, warning = false }: {
  label: string;
  value: string;
  icon: typeof CircleDollarSign;
  warning?: boolean;
}) {
  return <Card><CardContent className="flex items-start justify-between pt-6">
    <div><div className="text-sm text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div></div>
    <Icon className={cn('h-5 w-5 text-muted-foreground', warning && 'text-amber-500')} />
  </CardContent></Card>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-16 text-center text-sm text-muted-foreground">{text}</div>;
}

function getRange(preset: Preset, customFrom: string, customTo: string) {
  const now = new Date();
  if (preset === 'yesterday') {
    const today = dayStart(now);
    return { from: offsetDays(today, -1), to: today };
  }
  if (preset === '7d') return { from: offsetDays(dayStart(now), -6), to: now };
  if (preset === 'all') return { from: new Date(0), to: now };
  const from = dateInputStart(customFrom) || monthStart(now);
  const end = dateInputStart(customTo);
  return { from, to: end ? offsetDays(end, 1) : now };
}

function presetSummaryLabel(preset: Preset) {
  return {
    yesterday: '昨日消费',
    '7d': '近 7 天消费',
    all: '全部消费',
    custom: '自定义范围消费',
  }[preset];
}

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function offsetDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function dateInputStart(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCny(value: number) {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: value < 0.01 ? 6 : 2 })}`;
}

function granularityLabel(granularity: TrendGranularity) {
  return {
    '15m': '按 15 分钟',
    '6h': '按 6 小时',
    day: '按天',
    week: '按周',
    month: '按月',
  }[granularity];
}

function formatTrendTick(value: string, granularity: TrendGranularity) {
  const date = new Date(value);
  if (granularity === '15m' || granularity === '6h') {
    return date.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return date.toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    ...(granularity === 'month' ? { year: '2-digit' } : {}),
  });
}

function formatTrendTooltip(value: string, granularity: TrendGranularity) {
  const date = new Date(value);
  if (granularity === '15m' || granularity === '6h') {
    return date.toLocaleString('zh-CN', { hour12: false });
  }
  return date.toLocaleDateString('zh-CN');
}

function formatCompact(value: number) {
  return Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}
