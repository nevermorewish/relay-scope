'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Server, Wallet, TrendingUp, Bell, RefreshCw, LayoutDashboard, AlertCircle, Filter, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusDot } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { beginLatestRequest } from '@/lib/request-sequence';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculateDashboardFilterSummary } from '@/lib/dashboard-filter-summary';

interface DashboardItem {
  keyId: number;
  monitoredModelId: number | null;
  upstreamId: number;
  upstreamName: string;
  upstreamStatus: string;
  baseUrl: string;
  type: string;
  group: string;
  label: string | null;
  keyName: string | null;
  groupName: string | null;
  groupDescription: string | null;
  groupRateMultiplier: number | null;
  remoteKeyId: string | null;
  hasApiKey: boolean;
  hasAccessToken: boolean;
  status: string;
  balance: number | null;
  latencyMs: number | null;
  testModel: string | null;
  lastCollectedAt: string | null;
  lastError: string | null;
  openIncidents: number;
  resolvedIncidents: number;
  upstreamOpenIncidents: number;
  upstreamResolvedIncidents: number;
  lightSuccessCount24h: number;
  lightSampleCount24h: number;
  availability24h: number | null;
  generationSuccess24h: number | null;
  sampleCount24h: number;
  averageLatencyMs: number | null;
  recentProbes: boolean[];
  price: { currency: string; inputPrice: number | null; outputPrice: number | null; cacheReadPrice: number | null; source: string } | null;
}

interface DashboardData {
  summary: {
    total: number; online: number; degraded: number; offline: number;
    totalKeys: number; totalBalance: number; availability: number; openIncidents: number; resolvedIncidents: number;
  };
  items: DashboardItem[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState('ALL');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [modelFilter, setModelFilter] = useState('ALL');
  const requestSequence = useRef(0);

  const fetchData = useCallback(async () => {
    const isCurrent = beginLatestRequest(requestSequence);
    setError(null);
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '获取总览失败');
      if (!isCurrent()) return;
      setData(json);
    } catch (fetchError) {
      if (isCurrent()) setError((fetchError as Error).message || '获取总览失败');
    } finally {
      if (isCurrent()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void fetchData();
    };
    const timer = window.setInterval(refreshWhenVisible, 30000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [fetchData]);

  const pageHeader = (
    <PageHeader
      icon={LayoutDashboard}
      title="总览"
      actions={(
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setRefreshing(true); fetchData(); }}
          disabled={refreshing || loading}
        >
          <RefreshCw className={cn(refreshing && 'animate-spin')} data-icon="inline-start" />
          刷新
        </Button>
      )}
    />
  );

  if (loading && !data) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <DashboardSkeleton />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <Card>
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{error || '总览数据暂时不可用'}</p>
            <Button size="sm" variant="outline" onClick={() => { setLoading(true); fetchData(); }}>
              <RefreshCw data-icon="inline-start" />
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const siteOptions = uniqueBy(data.items, (item) => String(item.upstreamId));
  const groupOptions = uniqueBy(
    data.items.filter((item) => siteFilter === 'ALL' || String(item.upstreamId) === siteFilter),
    (item) => item.group,
  );
  const modelOptions = Array.from(new Set(
    data.items
      .filter((item) => siteFilter === 'ALL' || String(item.upstreamId) === siteFilter)
      .filter((item) => groupFilter === 'ALL' || item.group === groupFilter)
      .map((item) => item.testModel)
      .filter((model): model is string => Boolean(model)),
  )).sort();
  const filteredItems = data.items
    .filter((item) => siteFilter === 'ALL' || String(item.upstreamId) === siteFilter)
    .filter((item) => groupFilter === 'ALL' || item.group === groupFilter)
    .filter((item) => modelFilter === 'ALL' || item.testModel === modelFilter);
  const hasFilters = siteFilter !== 'ALL' || groupFilter !== 'ALL' || modelFilter !== 'ALL';
  const summary = hasFilters
    ? calculateDashboardFilterSummary(
        filteredItems,
        groupFilter !== 'ALL' || modelFilter !== 'ALL',
      )
    : data.summary;

  return (
    <div className="space-y-6">
      {pageHeader}

      {/* 统计卡 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="上游/分组" value={`${summary.total}/${summary.totalKeys}`} sub={`${summary.online} 在线 · ${summary.degraded} 降级 · ${summary.offline} 离线`} icon={Server} href="/upstreams" />
        <StatCard label="总余额" value={`¥${summary.totalBalance.toFixed(2)}`} sub="按各站点充值汇率折算" icon={Wallet} />
        <StatCard label="整体可用率" value={`${summary.availability}%`} sub="最近 24 小时" icon={TrendingUp}
          highlight={summary.availability >= 99 ? 'good' : summary.availability >= 95 ? 'warn' : 'bad'} />
        <StatCard label="待处理告警" value={String(summary.openIncidents)} sub={`已处理 ${summary.resolvedIncidents}`} icon={Bell}
          highlight={summary.openIncidents === 0 ? 'good' : 'bad'}
          href="/incidents" />
      </div>

      {/* 同模型、同口径的横向决策表 */}
      <div>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><Filter className="size-4" />站点使用对比</h2>
          <div className="grid flex-1 grid-cols-1 gap-2 sm:ml-auto sm:flex sm:justify-end">
            <Select value={siteFilter} onValueChange={(value) => { setSiteFilter(value); setGroupFilter('ALL'); setModelFilter('ALL'); }}>
              <SelectTrigger className="w-full sm:w-40" aria-label="筛选站点"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup><SelectItem value="ALL">全部站点</SelectItem>{siteOptions.map((item) => <SelectItem key={item.upstreamId} value={String(item.upstreamId)}>{item.upstreamName}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            <Select value={groupFilter} onValueChange={(value) => { setGroupFilter(value); setModelFilter('ALL'); }}>
              <SelectTrigger className="w-full sm:w-40" aria-label="筛选分组"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup><SelectItem value="ALL">全部分组</SelectItem>{groupOptions.map((item) => <SelectItem key={item.group} value={item.group}>{item.group}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            <Select value={modelFilter} onValueChange={setModelFilter}>
              <SelectTrigger className="w-full sm:w-48" aria-label="筛选模型"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup><SelectItem value="ALL">全部模型</SelectItem>{modelOptions.map((model) => <SelectItem key={model} value={model}>{model}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            {hasFilters ? <Button size="icon-sm" variant="ghost" aria-label="清除筛选" title="清除筛选" onClick={() => { setSiteFilter('ALL'); setGroupFilter('ALL'); setModelFilter('ALL'); }}><X /></Button> : null}
          </div>
        </div>
        {data.items.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            暂无监控数据，去
            <Link href="/upstreams" className="ml-1 text-primary hover:underline">添加上游</Link>
          </CardContent></Card>
        ) : (
          filteredItems.length === 0 ? (
            <div className="border-y py-12 text-center text-sm text-muted-foreground">没有符合筛选条件的项目</div>
          ) : <div className="overflow-x-auto border-y">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>
                {['站点','分组','模型','输入价格','输出价格','倍率','24小时成功率','平均延迟','最近探测','余额','最后采集'].map((label) => <th key={label} className="whitespace-nowrap px-3 py-3 text-left font-medium">{label}</th>)}
              </tr></thead>
              <tbody>{filteredItems.map((item) => <tr key={`${item.keyId}:${item.testModel}`} className="border-t transition-colors hover:bg-muted/30">
                <td className="px-3 py-3"><Link href={`/upstreams/${item.upstreamId}`} className="block"><div className="flex items-center gap-2 font-semibold"><StatusDot status={item.status} />{item.upstreamName}</div></Link></td>
                <td className="max-w-40 px-3 py-3 text-xs" title={item.group}>
                  <div className="truncate font-medium">{item.group}</div>
                  {item.label && item.label !== item.group ? <div className="mt-1 truncate text-muted-foreground">备注：{item.label}</div> : null}
                </td>
                <td className="max-w-44 truncate px-3 py-3 font-mono text-xs" title={item.testModel || ''}>{item.testModel || '未配置'}</td>
                <td className="px-3 py-3"><PriceValue price={item.price} field="inputPrice" /></td>
                <td className="px-3 py-3"><PriceValue price={item.price} field="outputPrice" /></td>
                <td className="px-3 py-3 tabular-nums">{formatMultiplier(item.groupRateMultiplier)}</td>
                <td className="px-3 py-3"><div className={cn('font-semibold tabular-nums', rateColor(item.generationSuccess24h))}>{item.generationSuccess24h == null ? '—' : `${item.generationSuccess24h}%`}</div><div className="text-xs text-muted-foreground">{item.sampleCount24h} 次真实生成</div></td>
                <td className="px-3 py-3 tabular-nums">{formatMs(item.averageLatencyMs)}</td>
                <td className="px-3 py-3"><ProbeStrip values={item.recentProbes} /></td>
                <td className="px-3 py-3 tabular-nums">{item.balance == null ? '—' : `¥${item.balance.toFixed(2)}`}</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{item.lastCollectedAt ? timeAgo(item.lastCollectedAt) : '从未'}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <CardContent className="flex flex-col gap-3 p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-full max-w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-20" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-48 w-full" />
          ))}
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, sub, icon: Icon, highlight, href }: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: 'good' | 'warn' | 'bad';
  href?: string;
}) {
  const color = highlight === 'good' ? 'text-success' : highlight === 'warn' ? 'text-warning' : highlight === 'bad' ? 'text-destructive' : 'text-foreground';
  const card = (
    <Card className={cn(href && 'transition-colors hover:border-primary/50 hover:bg-muted/30')}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 opacity-60" />
        </div>
        <div className={cn('mt-2 text-2xl font-bold', color)}>{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{card}</Link> : card;
}

function PriceValue({ price, field }: { price: DashboardItem['price']; field: 'inputPrice' | 'outputPrice' }) {
  if (!price) return <Link href="/prices" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">未录入</Link>;
  const symbol = price.currency === 'CNY' ? '¥' : '$';
  const value = price[field];
  return <span className="tabular-nums" title={price.source === 'CALCULATED' ? '按官方价格、倍率和充值比例自动计算' : `价格来源：${price.source}`}>{value == null ? '—' : `${symbol}${value.toFixed(4)}`}</span>;
}

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function ProbeStrip({ values }: { values: boolean[] }) {
  if (!values.length) return <span className="text-muted-foreground">—</span>;
  return <div className="flex w-[92px] gap-1" title={`最近 ${values.length} 次真实生成`}>
    {values.map((ok, index) => <span key={index} className={cn('h-5 min-w-1 flex-1 rounded-sm', ok ? 'bg-success' : 'bg-destructive')} />)}
  </div>;
}

function rateColor(value: number | null) {
  if (value == null) return 'text-muted-foreground';
  if (value >= 99) return 'text-success';
  if (value >= 95) return 'text-warning';
  return 'text-destructive';
}

function formatMs(value: number | null) {
  return value == null ? '—' : value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${value}ms`;
}

function formatMultiplier(value: number | null) {
  return value == null ? '未提供' : value.toFixed(2);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  return `${Math.floor(hr / 24)}天前`;
}
