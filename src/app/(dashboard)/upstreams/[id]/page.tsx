'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Zap, RefreshCw, Check, AlertTriangle, Wallet, Timer,
  KeyRound, Activity, Trash2, Loader2, Gauge, ServerCog, Plus, Pencil,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { StatusBadge } from '@/components/StatusBadge';
import { AddUpstreamGroupDialog } from '@/components/add-upstream-group-dialog';
import { useConfirm } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { beginLatestRequest } from '@/lib/request-sequence';
import { calculateSharedBalance, convertUsdCreditToCny } from '@/lib/upstream-query';
import { resolvedIncidentLabel } from '@/lib/incident-semantics';
import { formatLatencySeconds, latencySecondsValue, normalizeLatencyMessage } from '@/lib/latency-display';

// ============ 类型 ============

interface UpstreamKey {
  id: number;
  group: string;
  label: string | null;
  keyName: string | null;
  groupName: string | null;
  groupDescription: string | null;
  groupRateMultiplier: number | null;
  remoteKeyId: string | null;
  metadataSyncedAt: string | null;
  metadataError: string | null;
  status: string;
  lastBalance: number | null;
  lastLatencyMs: number | null;
  lastCollectedAt: string | null;
  latestModelTestLatencyMs: number | null;
  latestModelTestAt: string | null;
  latestModelTestModel: string | null;
  lastError: string | null;
  hasApiKey: boolean;
  hasAccessToken: boolean;
  userId: string | null;
  enabled: boolean;
  testModel: string | null;
  monitoredModels: Array<{
    id: number;
    modelName: string;
    officialInputPrice: number | null;
    officialOutputPrice: number | null;
    enabled: boolean;
    lastTestedAt: string | null;
  }>;
}

interface Upstream {
  id: number;
  name: string;
  baseUrl: string;
  type: string;
  status: string;
  enabled: boolean;
  priority: number;
  testModel: string | null;
  creditUsdPerCny: number;
  keys?: UpstreamKey[];
}

interface Metric {
  id: number;
  balance: number | null;
  latencyMs: number | null;
  modelTestOk: boolean | null;
  modelTestLatMs: number | null;
  success: boolean;
  errorMessage: string | null;
  recordedAt: string;
}

interface Incident {
  id: number;
  type: string;
  severity: string;
  message: string;
  resolved: boolean;
  createdAt: string;
  upstreamKey?: { id: number; group: string } | null;
}

type Range = '6h' | '24h' | '7d';

// ============ 页面 ============

export default function UpstreamDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [upstream, setUpstream] = useState<Upstream | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [range, setRange] = useState<Range>('24h');
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const [testingModelId, setTestingModelId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [groupEditor, setGroupEditor] = useState<UpstreamKey | null | undefined>(undefined);
  const [deletingKeyId, setDeletingKeyId] = useState<number | null>(null);
  const baseRequestSequence = useRef(0);
  const metricRequestSequence = useRef(0);
  const actionInFlight = useRef(false);

  const keys = useMemo(() => upstream?.keys || [], [upstream?.keys]);
  const activeKeyId = selectedKeyId || (keys[0]?.id != null ? String(keys[0].id) : '');
  const activeKeyIdRef = useRef(activeKeyId);
  const rangeRef = useRef(range);
  activeKeyIdRef.current = activeKeyId;
  rangeRef.current = range;

  // 加载上游 + 告警
  const fetchBase = useCallback(async () => {
    const isCurrent = beginLatestRequest(baseRequestSequence);
    const id = params.id;
    try {
      const [uRes, iRes] = await Promise.all([
        fetch(`/api/upstreams/${id}`, { cache: 'no-store' }),
        fetch(`/api/incidents?upstreamId=${id}&limit=50`, { cache: 'no-store' }),
      ]);
      const [nextUpstream, nextIncidents] = await Promise.all([
        uRes.json().catch(() => ({})),
        iRes.json().catch(() => []),
      ]);
      if (!uRes.ok) throw new Error(nextUpstream.error || '获取上游信息失败');
      if (!iRes.ok) throw new Error(nextIncidents.error || '获取告警历史失败');
      if (!isCurrent()) return false;
      setUpstream(nextUpstream);
      setSelectedKeyId((current) => {
        const nextKeys = Array.isArray(nextUpstream.keys) ? nextUpstream.keys : [];
        if (current && nextKeys.some((key: UpstreamKey) => String(key.id) === current)) return current;
        return nextKeys[0]?.id != null ? String(nextKeys[0].id) : '';
      });
      setIncidents(Array.isArray(nextIncidents) ? nextIncidents : []);
      return true;
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [params.id]);

  // 加载所选分组的指标
  const fetchMetrics = useCallback(async () => {
    const isCurrent = beginLatestRequest(metricRequestSequence);
    const keyId = activeKeyIdRef.current;
    const currentRange = rangeRef.current;
    if (!keyId) {
      if (!isCurrent()) return false;
      setMetrics([]);
      return true;
    }
    const qs = currentRange === '7d' ? 'days=7' : `hours=${currentRange === '6h' ? 6 : 24}`;
    const mRes = await fetch(`/api/metrics?upstreamKeyId=${keyId}&${qs}&limit=2000`, { cache: 'no-store' });
    const nextMetrics = await mRes.json().catch(() => []);
    if (!mRes.ok) throw new Error(nextMetrics.error || '获取指标失败');
    if (!isCurrent()) return false;
    setMetrics(Array.isArray(nextMetrics) ? nextMetrics : []);
    return true;
  }, []);

  useEffect(() => {
    void fetchBase().catch((error) => toast.error((error as Error).message));
  }, [fetchBase]);
  useEffect(() => {
    void fetchMetrics().catch((error) => toast.error((error as Error).message));
  }, [fetchMetrics, activeKeyId, range]);

  // 上游变化后，若未选择 key 则默认选第一个
  useEffect(() => {
    if (!selectedKeyId && keys.length > 0 && keys[0].id != null) {
      setSelectedKeyId(String(keys[0].id));
    }
  }, [keys, selectedKeyId]);

  async function handleTest() {
    if (!upstream || actionInFlight.current) return;
    actionInFlight.current = true;
    setTesting(true);
    const tid = toast.loading(`正在测试 ${upstream.name} 的所有分组…`);
    try {
      const res = await fetch(`/api/upstreams/${upstream.id}/test`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const ok = data.results?.filter((r: { status: string }) => r.status === 'ok').length || 0;
        const total = data.results?.length || 0;
        const fail = total - ok;
        toast.success(`${upstream.name} 测试完成：${ok} 成功${fail > 0 ? `，${fail} 失败` : ''}`, { id: tid });
        await fetchBase();
        await fetchMetrics();
      } else {
        toast.error(data.error || '测试失败', { id: tid });
      }
    } catch (e) {
      toast.error('请求失败: ' + (e as Error).message, { id: tid });
    } finally {
      setTesting(false);
      actionInFlight.current = false;
    }
  }

  async function handleTestModel(keyId: number, modelId: number, modelName: string) {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setTestingModelId(modelId);
    const tid = toast.loading(`正在测试 ${modelName}…`);
    try {
      const res = await fetch(`/api/keys/${keyId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitoredModelId: modelId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.errorMessage || `${modelName} 测试失败`);
      }
      const latency = data.modelTestLatMs != null ? `，延迟 ${formatLatencySeconds(data.modelTestLatMs)}` : '';
      toast.success(`${modelName} 测试成功${latency}`, { id: tid });
      setUpstream((current) => current ? {
        ...current,
        keys: current.keys?.map((key) => key.id === keyId ? {
          ...key,
          lastLatencyMs: data.latencyMs ?? key.lastLatencyMs,
          lastCollectedAt: data.recordedAt ?? key.lastCollectedAt,
          latestModelTestLatencyMs: data.modelTestLatMs ?? null,
          latestModelTestAt: data.recordedAt ?? new Date().toISOString(),
          latestModelTestModel: data.testModel ?? modelName,
        } : key),
      } : current);
      await fetchBase();
      if (activeKeyIdRef.current === String(keyId)) await fetchMetrics();
    } catch (error) {
      toast.error((error as Error).message, { id: tid });
    } finally {
      setTestingModelId(null);
      actionInFlight.current = false;
    }
  }

  async function handleRefresh() {
    if (!upstream || actionInFlight.current) return;
    actionInFlight.current = true;
    setRefreshing(true);
    const tid = toast.loading(`正在刷新 ${upstream.name}…`);
    try {
      const res = await fetch(`/api/upstreams/${upstream.id}/refresh`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || '刷新失败', { id: tid });
        return;
      }
      const total = data.results?.length || 0;
      const success = data.successCount ?? data.results?.filter((item: { status: string }) => item.status === 'ok').length ?? 0;
      const failed = data.failureCount ?? total - success;
      await Promise.all([fetchBase(), fetchMetrics()]);
      const message = `${upstream.name} 刷新完成：${success} 成功${failed > 0 ? `，${failed} 失败` : ''}`;
      if (success === 0) {
        toast.error(message, { id: tid });
      } else if (failed > 0) {
        toast.warning(message, { id: tid });
      } else {
        toast.success(message, { id: tid });
      }
    } catch (error) {
      toast.error('请求失败: ' + (error as Error).message, { id: tid });
    } finally {
      setRefreshing(false);
      actionInFlight.current = false;
    }
  }

  async function handleDelete() {
    if (!upstream) return;
    const ok = await confirm({
      title: `删除上游「${upstream.name}」？`,
      description: '该操作会删除该上游及其所有分组、指标和告警数据，不可恢复。',
      destructive: true,
      confirmText: '删除',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/upstreams/${upstream.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || '删除失败');
        return;
      }
      toast.success(`已删除 ${upstream.name}`);
      router.push('/upstreams');
    } catch (e) {
      toast.error('删除失败: ' + (e as Error).message);
    }
  }

  async function handleDeleteGroup(key: UpstreamKey) {
    if (!upstream || deletingKeyId != null) return;
    const ok = await confirm({
      title: `删除分组「${key.group}」？`,
      description: '该分组的监测模型、历史指标和关联数据将一并删除，不可恢复。',
      destructive: true,
      confirmText: '删除',
    });
    if (!ok) return;

    setDeletingKeyId(key.id);
    try {
      const response = await fetch(`/api/upstreams/${upstream.id}/keys/${key.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '删除分组失败');
      toast.success(`已删除分组 ${key.group}`);
      await fetchBase();
    } catch (deleteError) {
      toast.error((deleteError as Error).message);
    } finally {
      setDeletingKeyId(null);
    }
  }

  // ============ 派生数据 ============

  const totalBalance = useMemo(
    () => convertUsdCreditToCny(calculateSharedBalance(keys), upstream?.creditUsdPerCny),
    [keys, upstream?.creditUsdPerCny],
  );

  const chartData = useMemo(() => metrics.map((m) => ({
    time: new Date(m.recordedAt).toLocaleString('zh-CN', range === '7d'
      ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
      : { hour: '2-digit', minute: '2-digit' }),
    balance: convertUsdCreditToCny(m.balance, upstream?.creditUsdPerCny),
    latency: m.latencyMs == null ? null : latencySecondsValue(m.latencyMs),
    success: m.success ? 1 : 0,
  })), [metrics, range, upstream?.creditUsdPerCny]);
  const balanceChartData = useMemo(
    () => chartData.filter((point): point is typeof point & { balance: number } => point.balance != null),
    [chartData],
  );
  const latencyChartData = useMemo(
    () => chartData.filter((point): point is typeof point & { latency: number } => point.latency != null),
    [chartData],
  );
  const balanceDomain = useMemo(
    () => paddedDomain(balanceChartData.map((point) => point.balance)),
    [balanceChartData],
  );

  const successCount = metrics.filter((m) => m.success).length;
  const availability = metrics.length > 0 ? (successCount / metrics.length) * 100 : 0;
  const monitoredModelCount = keys.reduce(
    (count, key) => count + (key.monitoredModels?.filter((model) => model.enabled).length || (key.testModel ? 1 : 0)),
    0,
  );

  // ============ 渲染 ============

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中…
      </div>
    );
  }
  if (!upstream) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        上游不存在
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      {groupEditor !== undefined ? (
        <AddUpstreamGroupDialog
          upstreamId={upstream.id}
          upstreamType={upstream.type}
          baseUrl={upstream.baseUrl}
          keyData={groupEditor}
          onClose={() => setGroupEditor(undefined)}
          onSaved={() => {
            setGroupEditor(undefined);
            void fetchBase().catch((error) => toast.error((error as Error).message));
          }}
        />
      ) : null}
      {/* ====== 面包屑 ====== */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/upstreams">上游管理</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{upstream.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* ====== 页头 ====== */}
      <PageHeader
        icon={ServerCog}
        title={upstream.name}
        description={upstream.baseUrl}
        meta={
          <>
            <StatusBadge status={upstream.status} />
            <Badge variant="outline">{upstream.type}</Badge>
            {!upstream.enabled && <Badge variant="secondary">监测已暂停</Badge>}
          </>
        }
        actions={
          <>
            <Button size="sm" onClick={handleTest} disabled={testing || refreshing || testingModelId != null}>
              {testing ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Zap data-icon="inline-start" />
              )}
              {testing ? '测试中…' : '立即测试'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing || testing}>
              <RefreshCw data-icon="inline-start" className={cn(refreshing && 'animate-spin')} />
              {refreshing ? '刷新中…' : '刷新'}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/upstreams">
                <ArrowLeft data-icon="inline-start" />
                返回
              </Link>
            </Button>
            <Button size="sm" variant="destructive" onClick={handleDelete}>
              <Trash2 data-icon="inline-start" />
              删除
            </Button>
          </>
        }
        actionsClassName="grid w-full grid-cols-2 sm:flex sm:w-auto"
      />

      {/* ====== 汇总指标 ====== */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={<Wallet className="h-4 w-4" />} label="账户余额"
          value={totalBalance == null ? '—' : `¥${totalBalance.toFixed(2)}`} />
        <SummaryCard icon={<Gauge className="h-4 w-4" />} label={`${range} 可用率`}
          value={`${availability.toFixed(1)}%`}
          tone={availability >= 99 ? 'good' : availability >= 95 ? 'warn' : 'bad'} />
        <SummaryCard icon={<KeyRound className="h-4 w-4" />} label="分组数"
          value={String(keys.length)} />
        <SummaryCard icon={<Activity className="h-4 w-4" />} label="监测模型"
          value={String(monitoredModelCount)} />
      </div>

      {/* ====== 主体 Tabs ====== */}
      <Tabs defaultValue="groups" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-3 sm:inline-flex sm:w-auto">
          <TabsTrigger value="groups">分组详情</TabsTrigger>
          <TabsTrigger value="trends">趋势</TabsTrigger>
          <TabsTrigger value="incidents">告警历史</TabsTrigger>
        </TabsList>

        {/* ---- 分组详情 ---- */}
        <TabsContent value="groups" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setGroupEditor(null)}>
              <Plus data-icon="inline-start" />
              添加分组
            </Button>
          </div>
          {keys.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                该上游暂无分组，请点击上方“添加分组”完成配置
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {keys.map((k) => (
                <GroupCard
                  key={k.id}
                  k={k}
                  upstreamType={upstream.type}
                  testingModelId={testingModelId}
                  testDisabled={testing || refreshing || testingModelId != null}
                  deleting={deletingKeyId === k.id}
                  onEdit={() => setGroupEditor(k)}
                  onDelete={() => void handleDeleteGroup(k)}
                  onTestModel={handleTestModel}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---- 趋势 ---- */}
        <TabsContent value="trends" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">趋势图</CardTitle>
                <CardDescription>选择分组查看余额与延迟趋势</CardDescription>
              </div>
              <div className="w-full sm:w-auto">
                <Select value={activeKeyId} onValueChange={setSelectedKeyId}>
                  <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="选择分组" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {keys.map((k) => (
                        <SelectItem key={k.id} value={String(k.id)}>
                          {k.group}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 时间范围切换 */}
              <div className="flex gap-1">
                {(['6h', '24h', '7d'] as Range[]).map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant={range === r ? 'default' : 'outline'}
                    onClick={() => setRange(r)}
                  >
                    {r === '6h' ? '6小时' : r === '24h' ? '24小时' : '7天'}
                  </Button>
                ))}
              </div>

              {!activeKeyId ? (
                <div className="py-10 text-center text-sm text-muted-foreground">请选择分组</div>
              ) : metrics.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">该分组在所选范围内暂无数据</div>
              ) : (
                <>
                  {/* 余额趋势 */}
                  <div className="trend-chart min-w-0" onMouseDown={preventChartFocus}>
                    <div className="mb-2 text-sm font-medium">余额趋势</div>
                    {balanceChartData.length === 0 ? (
                      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                        所选范围内暂无余额数据
                      </div>
                    ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart
                        data={balanceChartData}
                        margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
                        accessibilityLayer={false}
                      >
                        <defs>
                          <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" strokeOpacity={0.5} />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={40} />
                        <YAxis
                          width={58}
                          tick={{ fontSize: 11 }}
                          tickFormatter={(value) => `¥${Number(value).toFixed(2)}`}
                          domain={balanceDomain}
                        />
                        <Tooltip
                          formatter={(v) => (typeof v === 'number' && v != null ? `¥${v.toFixed(2)}` : '—')}
                          contentStyle={tooltipStyle}
                          labelStyle={tooltipLabelStyle}
                          itemStyle={tooltipItemStyle}
                        />
                        <Area type="monotone" dataKey="balance" name="余额"
                          stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#balGrad)" connectNulls />
                      </AreaChart>
                    </ResponsiveContainer>
                    )}
                  </div>

                  {/* 延迟趋势 */}
                  <div className="trend-chart min-w-0" onMouseDown={preventChartFocus}>
                    <div className="mb-2 text-sm font-medium">基础接口延迟（秒）</div>
                    {latencyChartData.length === 0 ? (
                      <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
                        所选范围内暂无延迟数据
                      </div>
                    ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart
                        data={latencyChartData}
                        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                        accessibilityLayer={false}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" strokeOpacity={0.5} />
                        <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={40} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(v) => (typeof v === 'number' && v != null ? `${v.toFixed(2)}秒` : '—')}
                          contentStyle={tooltipStyle}
                          labelStyle={tooltipLabelStyle}
                          itemStyle={tooltipItemStyle}
                        />
                        <Line type="monotone" dataKey="latency" name="基础接口延迟"
                          stroke="hsl(var(--chart-2))" strokeWidth={1.5} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                    )}
                  </div>

                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- 告警历史 ---- */}
        <TabsContent value="incidents">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">告警历史</CardTitle>
              <CardDescription>展示该上游所有分组的历史告警</CardDescription>
            </CardHeader>
            <CardContent>
              {incidents.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">暂无告警记录</div>
              ) : (
                <div className="space-y-2">
                  {incidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="flex flex-col gap-2 border-b py-2 last:border-0 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={inc.severity} />
                          {inc.upstreamKey?.group && (
                            <Badge variant="outline" className="text-xs">{inc.upstreamKey.group}</Badge>
                          )}
                          {inc.resolved && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Check className="h-3 w-3" />{resolvedIncidentLabel(inc.type)}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 break-words text-sm">{normalizeLatencyMessage(inc.message)}</div>
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(inc.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ 子组件 ============

const tooltipStyle = {
  fontSize: '12px',
  borderRadius: '6px',
  border: '1px solid hsl(var(--border))',
  backgroundColor: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  boxShadow: '0 8px 24px rgb(0 0 0 / 0.18)',
} as const;

const tooltipLabelStyle = {
  color: 'hsl(var(--popover-foreground))',
  marginBottom: '4px',
} as const;

const tooltipItemStyle = {
  color: 'hsl(var(--popover-foreground))',
} as const;

function preventChartFocus(event: React.MouseEvent<HTMLDivElement>) {
  event.preventDefault();
  (document.activeElement as HTMLElement | null)?.blur();
}

function paddedDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const padding = span > 0 ? span * 0.08 : Math.max(Math.abs(min) * 0.01, 0.01);
  return [Math.max(0, min - padding), max + padding];
}

function SummaryCard({ icon, label, value, tone }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'good' | 'warn' | 'bad';
}) {
  const toneClass = tone === 'good'
    ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'warn'
      ? 'text-amber-600 dark:text-amber-400'
      : tone === 'bad'
        ? 'text-red-600 dark:text-red-400'
        : '';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}<span>{label}</span>
        </div>
        <div className={cn('mt-1 text-xl font-bold', toneClass)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function GroupCard({ k, upstreamType, testingModelId, testDisabled, deleting, onEdit, onDelete, onTestModel }: {
  k: UpstreamKey;
  upstreamType: string;
  testingModelId: number | null;
  testDisabled: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTestModel: (keyId: number, modelId: number, modelName: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-base" title={k.group}>
              {k.group}
            </CardTitle>
            {k.label && k.label !== k.group ? (
              <CardDescription>备注：{k.label}</CardDescription>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil data-icon="inline-start" />
            编辑
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-destructive"
            disabled={deleting}
            aria-label={`删除分组 ${k.group}`}
            title={`删除分组 ${k.group}`}
            onClick={onDelete}
          >
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
          <StatusBadge status={k.status} />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 border-y py-3">
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" />最近检测延迟
            </div>
            <div className="mt-0.5 font-mono text-sm font-semibold">
              {formatLatencySeconds(k.latestModelTestLatencyMs)}
            </div>
          </div>
          <div className="border-l pl-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Activity className="h-3 w-3" />最近检测
            </div>
            <div className="mt-0.5 text-sm font-semibold">
              {k.latestModelTestAt
                ? new Date(k.latestModelTestAt).toLocaleString('zh-CN', {
                    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })
                : '暂无记录'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(k.monitoredModels || []).filter((model) => model.enabled).map((model) => (
            <div key={model.id} className="flex items-center gap-1 rounded-md border pl-2">
              <span className="font-mono">{model.modelName}</span>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={testDisabled}
                aria-label={`单独测试 ${model.modelName}`}
                title="单独测试该模型，会消耗少量 Token"
                onClick={() => onTestModel(k.id, model.id, model.modelName)}
              >
                {testingModelId === model.id
                  ? <Loader2 className="animate-spin" />
                  : <Zap />}
              </Button>
            </div>
          ))}
          {!k.hasApiKey ? (
            <Badge variant="outline" className="gap-1 text-warning"><AlertTriangle className="h-3 w-3" />无 Key</Badge>
          ) : null}
          {upstreamType === 'NEW_API' ? (
            k.hasAccessToken
              ? null
              : <Badge variant="outline" className="gap-1 text-warning"><AlertTriangle className="h-3 w-3" />无令牌</Badge>
          ) : null}
          {!k.enabled ? <Badge variant="secondary">监测已暂停</Badge> : null}
        </div>

        {k.metadataError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span className="break-all">{k.metadataError}</span>
          </div>
        ) : null}

        {k.lastError ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="font-mono break-all">{k.lastError}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { variant: 'destructive' | 'secondary' | 'outline'; cls: string }> = {
    CRITICAL: { variant: 'destructive', cls: '' },
    WARNING: {
      variant: 'outline',
      cls: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400',
    },
    INFO: { variant: 'secondary', cls: '' },
  };
  const conf = map[severity] || map.INFO;
  return (
    <Badge variant={conf.variant} className={cn('gap-1 text-xs', conf.cls)}>
      {severity === 'CRITICAL' && <AlertTriangle className="h-3 w-3" />}
      {severity}
    </Badge>
  );
}
