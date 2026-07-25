'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Zap, RefreshCw, Check, AlertTriangle, Wallet, Timer,
  KeyRound, Activity, Trash2, Loader2, ServerCog, Pencil,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { StatusBadge } from '@/components/StatusBadge';
import { useConfirm } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { EditUpstreamDialog } from '@/components/edit-upstream-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { beginLatestRequest } from '@/lib/request-sequence';
import { calculateSharedBalance, convertUsdCreditToCny } from '@/lib/upstream-query';
import { resolvedIncidentLabel } from '@/lib/incident-semantics';
import { formatLatencySeconds, normalizeLatencyMessage } from '@/lib/latency-display';

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

interface Incident {
  id: number;
  type: string;
  severity: string;
  message: string;
  resolved: boolean;
  createdAt: string;
  upstreamKey?: { id: number; group: string } | null;
}

interface CostResponse {
  summary?: {
    todayCostCny?: number;
  };
}

// ============ 页面 ============

export default function UpstreamDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [upstream, setUpstream] = useState<Upstream | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [testing, setTesting] = useState(false);
  const [testingModelIds, setTestingModelIds] = useState<Set<number>>(() => new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingUpstream, setEditingUpstream] = useState(false);
  const [todayCostCny, setTodayCostCny] = useState<number | null>(null);
  const baseRequestSequence = useRef(0);
  const testingAllRef = useRef(false);
  const testingModelIdsRef = useRef<Set<number>>(new Set());

  const keys = useMemo(() => upstream?.keys || [], [upstream?.keys]);

  // 加载上游 + 告警
  const fetchBase = useCallback(async () => {
    const isCurrent = beginLatestRequest(baseRequestSequence);
    const id = params.id;
    try {
      const [uRes, iRes, costResult] = await Promise.all([
        fetch(`/api/upstreams/${id}`, { cache: 'no-store' }),
        fetch(`/api/incidents?upstreamId=${id}&limit=50`, { cache: 'no-store' }),
        fetch(
          `/api/costs?upstreamId=${id}&timezoneOffset=${new Date().getTimezoneOffset()}`,
          { cache: 'no-store' },
        )
          .then(async (response): Promise<CostResponse | null> => response.ok ? response.json() : null)
          .catch(() => null),
      ]);
      const [nextUpstream, nextIncidents] = await Promise.all([
        uRes.json().catch(() => ({})),
        iRes.json().catch(() => []),
      ]);
      if (!uRes.ok) throw new Error(nextUpstream.error || '获取上游信息失败');
      if (!iRes.ok) throw new Error(nextIncidents.error || '获取告警历史失败');
      if (!isCurrent()) return false;
      setUpstream(nextUpstream);
      setIncidents(Array.isArray(nextIncidents) ? nextIncidents : []);
      setTodayCostCny(costResult?.summary?.todayCostCny ?? null);
      return true;
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void fetchBase().catch((error) => toast.error((error as Error).message));
  }, [fetchBase]);

  async function handleTest() {
    if (!upstream || testingAllRef.current) return;
    testingAllRef.current = true;
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
      } else {
        toast.error(data.error || '测试失败', { id: tid });
      }
    } catch (e) {
      toast.error('请求失败: ' + (e as Error).message, { id: tid });
    } finally {
      setTesting(false);
      testingAllRef.current = false;
    }
  }

  async function handleTestModel(keyId: number, modelId: number, modelName: string) {
    if (testingModelIdsRef.current.has(modelId)) return;
    testingModelIdsRef.current.add(modelId);
    setTestingModelIds(new Set(testingModelIdsRef.current));
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
    } catch (error) {
      toast.error((error as Error).message, { id: tid });
    } finally {
      testingModelIdsRef.current.delete(modelId);
      setTestingModelIds(new Set(testingModelIdsRef.current));
    }
  }

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetchBase();
    } catch (error) {
      toast.error((error as Error).message || '刷新失败');
    } finally {
      setRefreshing(false);
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

  // ============ 派生数据 ============

  const totalBalance = useMemo(
    () => convertUsdCreditToCny(calculateSharedBalance(keys), upstream?.creditUsdPerCny),
    [keys, upstream?.creditUsdPerCny],
  );

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
      {editingUpstream && (
        <EditUpstreamDialog
          upstream={upstream}
          onClose={() => {
            setEditingUpstream(false);
            void fetchBase().catch((error) => toast.error((error as Error).message));
          }}
          onSaved={async () => {
            setEditingUpstream(false);
            await fetchBase();
          }}
        />
      )}
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
          <TooltipProvider delayDuration={300}>
            <ActionTooltip label="编辑站点信息、分组和模型">
              <Button size="sm" variant="outline" onClick={() => setEditingUpstream(true)}>
                <Pencil data-icon="inline-start" />
                编辑站点
              </Button>
            </ActionTooltip>
            <ActionTooltip label="完整测试所有启用分组，会消耗少量 Token">
              <Button size="sm" onClick={handleTest} disabled={testing}>
                {testing ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Zap data-icon="inline-start" />
                )}
                {testing ? '测试中…' : '立即测试'}
              </Button>
            </ActionTooltip>
            <ActionTooltip label="重新读取最新站点数据，不会主动采集站点或测试模型">
              <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing || loading}>
                <RefreshCw data-icon="inline-start" className={cn(refreshing && 'animate-spin')} />
                刷新
              </Button>
            </ActionTooltip>
            <ActionTooltip label="删除站点及其分组、指标和告警数据">
              <Button size="sm" variant="destructive" onClick={handleDelete}>
                <Trash2 data-icon="inline-start" />
                删除
              </Button>
            </ActionTooltip>
          </TooltipProvider>
        }
        actionsClassName="grid w-full grid-cols-2 sm:flex sm:w-auto"
      />

      {/* ====== 汇总指标 ====== */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={<Wallet className="h-4 w-4" />} label="账户余额"
          value={totalBalance == null ? '—' : `¥${totalBalance.toFixed(2)}`} />
        <SummaryCard icon={<Wallet className="h-4 w-4" />} label="今日消费"
          value={todayCostCny == null ? '—' : `¥${todayCostCny.toFixed(2)}`} />
        <SummaryCard icon={<KeyRound className="h-4 w-4" />} label="分组数"
          value={String(keys.length)} />
        <SummaryCard icon={<Activity className="h-4 w-4" />} label="监测模型"
          value={String(monitoredModelCount)} />
      </div>

      {/* ====== 主体 Tabs ====== */}
      <Tabs defaultValue="groups" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="groups">分组详情</TabsTrigger>
          <TabsTrigger value="incidents">告警历史</TabsTrigger>
        </TabsList>

          {/* ---- 分组详情 ---- */}
          <TabsContent value="groups" className="space-y-3">
            {keys.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center text-muted-foreground">
                  该上游暂无分组，请通过“编辑站点”完成配置
                </CardContent>
              </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {keys.map((k) => (
                <GroupCard
                  key={k.id}
                  k={k}
                    upstreamType={upstream.type}
                    testingModelIds={testingModelIds}
                    onTestModel={handleTestModel}
                  />
              ))}
            </div>
          )}
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

function ActionTooltip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <UiTooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex [&>button]:w-full sm:[&>button]:w-auto">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-72 text-center">
        {label}
      </TooltipContent>
    </UiTooltip>
  );
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

function GroupCard({ k, upstreamType, testingModelIds, onTestModel }: {
  k: UpstreamKey;
  upstreamType: string;
  testingModelIds: Set<number>;
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
                disabled={testingModelIds.has(model.id)}
                aria-label={`单独测试 ${model.modelName}`}
                title="单独测试该模型，会消耗少量 Token"
                onClick={() => onTestModel(k.id, model.id, model.modelName)}
              >
                {testingModelIds.has(model.id)
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
