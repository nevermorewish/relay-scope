'use client';

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
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
import { getPaginationItems, PAGE_SIZE_OPTIONS } from '@/lib/pagination';
import { formatLatencySeconds } from '@/lib/latency-display';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  applyDashboardItemOrder,
  dashboardItemId,
  moveDashboardItem,
  sortDashboardItems,
  type DashboardSortMode,
} from '@/lib/dashboard-item-order';

const DASHBOARD_ORDER_STORAGE_KEY = 'relay-monitor:dashboard-order';

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
  price: { currency: string; inputPrice: number | null; outputPrice: number | null; cacheReadPrice: number | null; source: string; multiplier: number | null } | null;
}

interface DashboardData {
  summary: {
    total: number; online: number; degraded: number; offline: number;
    totalKeys: number; totalBalance: number; availability: number; openIncidents: number; resolvedIncidents: number;
  };
  items: DashboardItem[];
}

interface DashboardPointerSession {
  itemId: string;
  pointerId: number;
  startX: number;
  startY: number;
  grabOffsetY: number;
  lastClientY: number;
  translateY: number;
  source: HTMLTableRowElement;
  dragging: boolean;
  moveHandler: (event: PointerEvent) => void;
  endHandler: (event: PointerEvent) => void;
  cancelHandler: () => void;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState('ALL');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [modelFilter, setModelFilter] = useState('ALL');
  const [sortMode, setSortMode] = useState<DashboardSortMode>('default');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [orderLoaded, setOrderLoaded] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const manualOrderRef = useRef<string[]>([]);
  const draggedIdRef = useRef<string | null>(null);
  const pointerSession = useRef<DashboardPointerSession | null>(null);
  const suppressClick = useRef(false);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const rowAnimations = useRef(new Map<string, Animation>());
  const rowPositionsBeforeMove = useRef<Map<string, number> | null>(null);

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

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DASHBOARD_ORDER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
          manualOrderRef.current = parsed;
          setManualOrder(parsed);
        }
      }
    } catch {
      // Ignore invalid or unavailable browser storage and use the server order.
    } finally {
      setOrderLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!orderLoaded) return;
    window.localStorage.setItem(DASHBOARD_ORDER_STORAGE_KEY, JSON.stringify(manualOrder));
  }, [manualOrder, orderLoaded]);

  useEffect(() => {
    document.documentElement.classList.toggle('dashboard-row-dragging', draggedId != null);
    return () => document.documentElement.classList.remove('dashboard-row-dragging');
  }, [draggedId]);

  useEffect(() => () => {
    const session = pointerSession.current;
    if (!session) return;
    window.removeEventListener('pointermove', session.moveHandler, true);
    window.removeEventListener('pointerup', session.endHandler, true);
    window.removeEventListener('pointercancel', session.endHandler, true);
    window.removeEventListener('blur', session.cancelHandler);
    pointerSession.current = null;
  }, []);

  useLayoutEffect(() => {
    const previous = rowPositionsBeforeMove.current;
    rowPositionsBeforeMove.current = null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rowRefs.current.forEach((element, id) => {
      if (id === draggedIdRef.current) {
        rowAnimations.current.get(id)?.cancel();
        rowAnimations.current.delete(id);
        const session = pointerSession.current;
        if (session?.dragging) positionDraggedRow(session, session.lastClientY);
        return;
      }
      if (!previous || reduceMotion) return;
      const oldTop = previous.get(id);
      if (oldTop == null) return;
      rowAnimations.current.get(id)?.cancel();
      rowAnimations.current.delete(id);
      const distance = oldTop - element.getBoundingClientRect().top;
      if (Math.abs(distance) < 1) return;
      const animation = element.animate(
        [{ transform: `translateY(${distance}px)` }, { transform: 'translateY(0)' }],
        { duration: 170, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
      rowAnimations.current.set(id, animation);
      animation.addEventListener('finish', () => {
        if (rowAnimations.current.get(id) === animation) rowAnimations.current.delete(id);
      }, { once: true });
    });
  }, [manualOrder]);

  const pageHeader = (
    <PageHeader
      icon={LayoutDashboard}
      title="总览"
      actions={<TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setRefreshing(true); fetchData(); }}
              disabled={refreshing || loading}
            >
              <RefreshCw className={cn(refreshing && 'animate-spin')} data-icon="inline-start" />
              刷新
            </Button>
          </TooltipTrigger>
          <TooltipContent>重新读取最新总览数据，不会主动采集站点或测试模型</TooltipContent>
        </Tooltip>
      </TooltipProvider>}
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
  const completeManualOrder = mergeDashboardOrder(manualOrder, data.items.map(dashboardItemId));
  const displayedItems = sortMode === 'default'
    ? applyDashboardItemOrder(filteredItems, completeManualOrder)
    : sortDashboardItems(filteredItems, sortMode);
  const totalPages = Math.max(1, Math.ceil(displayedItems.length / pageSize));
  const visiblePage = Math.min(currentPage, totalPages);
  const pagedItems = displayedItems.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);
  const hasFilters = siteFilter !== 'ALL' || groupFilter !== 'ALL' || modelFilter !== 'ALL';
  const summary = hasFilters
    ? calculateDashboardFilterSummary(
        filteredItems,
        groupFilter !== 'ALL' || modelFilter !== 'ALL',
      )
    : data.summary;

  const updateManualOrder = (next: string[]) => {
    manualOrderRef.current = next;
    setManualOrder(next);
  };

  const beginPointerDrag = (itemId: string) => {
    let baseOrder = completeManualOrder;
    if (sortMode !== 'default') {
      baseOrder = replaceVisibleDashboardOrder(baseOrder, displayedItems.map(dashboardItemId));
      setSortMode('default');
      updateManualOrder(baseOrder);
    } else {
      manualOrderRef.current = baseOrder;
    }
    rowAnimations.current.get(itemId)?.cancel();
    rowAnimations.current.delete(itemId);
    const session = pointerSession.current;
    if (session) session.source.style.willChange = 'transform';
    draggedIdRef.current = itemId;
    document.documentElement.classList.add('dashboard-row-dragging');
    setDraggedId(itemId);
  };

  const movePointerDrag = (clientY: number) => {
    const activeId = draggedIdRef.current;
    if (!activeId) return;
    const activeIndex = manualOrderRef.current.indexOf(activeId);
    if (activeIndex < 0) return;
    const threshold = 4;
    const upwardTargets: Array<{ id: string; index: number }> = [];
    const downwardTargets: Array<{ id: string; index: number }> = [];
    rowRefs.current.forEach((element, id) => {
      if (id === activeId) return;
      const index = manualOrderRef.current.indexOf(id);
      if (index < 0) return;
      const bounds = element.getBoundingClientRect();
      const midpoint = bounds.top + bounds.height / 2;
      if (index < activeIndex && clientY < midpoint - threshold) {
        upwardTargets.push({ id, index });
      }
      if (index > activeIndex && clientY > midpoint + threshold) {
        downwardTargets.push({ id, index });
      }
    });
    upwardTargets.sort((left, right) => left.index - right.index);
    downwardTargets.sort((left, right) => right.index - left.index);
    const target = upwardTargets[0] ?? downwardTargets[0];
    if (!target) return;
    rowPositionsBeforeMove.current = new Map(
      Array.from(rowRefs.current, ([id, element]) => [id, element.getBoundingClientRect().top]),
    );
    const next = moveDashboardItem(manualOrderRef.current, activeId, target.id);
    if (next === manualOrderRef.current) return;
    updateManualOrder(next);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLTableRowElement>, itemId: string) => {
    if (event.button !== 0 || event.pointerType !== 'mouse') return;
    suppressClick.current = false;
    const bounds = event.currentTarget.getBoundingClientRect();
    const session: DashboardPointerSession = {
      itemId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      grabOffsetY: event.clientY - bounds.top,
      lastClientY: event.clientY,
      translateY: 0,
      source: event.currentTarget,
      dragging: false,
      moveHandler: () => undefined,
      endHandler: () => undefined,
      cancelHandler: () => undefined,
    };
    session.moveHandler = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== session.pointerId || pointerSession.current !== session) return;
      if (!session.dragging) {
        const distance = Math.hypot(pointerEvent.clientX - session.startX, pointerEvent.clientY - session.startY);
        if (distance < 5) return;
        session.dragging = true;
        suppressClick.current = true;
        beginPointerDrag(session.itemId);
        positionDraggedRow(session, pointerEvent.clientY);
        pointerEvent.preventDefault();
        return;
      }
      pointerEvent.preventDefault();
      positionDraggedRow(session, pointerEvent.clientY);
      movePointerDrag(pointerEvent.clientY);
    };
    session.endHandler = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId === session.pointerId) finishPointerInteraction(session.pointerId);
    };
    session.cancelHandler = () => finishPointerInteraction(session.pointerId);
    pointerSession.current = session;
    window.addEventListener('pointermove', session.moveHandler, true);
    window.addEventListener('pointerup', session.endHandler, true);
    window.addEventListener('pointercancel', session.endHandler, true);
    window.addEventListener('blur', session.cancelHandler);
  };

  const finishPointerInteraction = (pointerId: number) => {
    const session = pointerSession.current;
    if (!session || session.pointerId !== pointerId) return;
    pointerSession.current = null;
    window.removeEventListener('pointermove', session.moveHandler, true);
    window.removeEventListener('pointerup', session.endHandler, true);
    window.removeEventListener('pointercancel', session.endHandler, true);
    window.removeEventListener('blur', session.cancelHandler);
    draggedIdRef.current = null;
    document.documentElement.classList.remove('dashboard-row-dragging');
    setDraggedId(null);
    if (session.dragging) {
      const distance = session.translateY;
      session.source.style.transform = '';
      session.source.style.willChange = '';
      if (Math.abs(distance) > 0.5 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const animation = session.source.animate(
          [{ transform: `translate3d(0, ${distance}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }],
          { duration: 130, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        );
        rowAnimations.current.set(session.itemId, animation);
        animation.addEventListener('finish', () => {
          if (rowAnimations.current.get(session.itemId) === animation) rowAnimations.current.delete(session.itemId);
        }, { once: true });
      }
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    }
  };

  return (
    <div className="space-y-6">
      {pageHeader}

      {/* 统计卡 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="上游/分组" value={`${summary.total}/${summary.totalKeys}`} sub={`${summary.online} 在线 · ${summary.degraded} 降级 · ${summary.offline} 离线`} icon={Server} href="/upstreams" />
        <StatCard label="总余额" value={`¥${summary.totalBalance.toFixed(2)}`} sub="按各站点充值汇率折算" icon={Wallet} href="/costs" />
        <StatCard label="整体可用率" value={`${summary.availability}%`} sub="最近 24 小时" icon={TrendingUp}
          highlight={summary.availability >= 95 ? 'good' : summary.availability >= 80 ? 'warn' : 'bad'} />
        <StatCard label="待处理告警" value={String(summary.openIncidents)} sub={`已处理 ${summary.resolvedIncidents}`} icon={Bell}
          highlight={summary.openIncidents === 0 ? 'good' : 'bad'}
          href="/incidents" />
      </div>

      {/* 同模型、同口径的横向决策表 */}
      <div>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><Filter className="size-4" />站点使用对比</h2>
          <div className="grid flex-1 grid-cols-1 gap-2 sm:ml-auto sm:flex sm:flex-wrap sm:justify-end">
            <Select value={sortMode} onValueChange={(value) => { setSortMode(value as DashboardSortMode); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-44" aria-label="排序方式"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                <SelectItem value="default">默认顺序</SelectItem>
                <SelectItem value="price">价格低到高</SelectItem>
                <SelectItem value="success">成功率高到低</SelectItem>
                <SelectItem value="latency">延迟低到高</SelectItem>
                <SelectItem value="multiplier">倍率低到高</SelectItem>
                <SelectItem value="balance">余额高到低</SelectItem>
              </SelectGroup></SelectContent>
            </Select>
            <Select value={siteFilter} onValueChange={(value) => { setSiteFilter(value); setGroupFilter('ALL'); setModelFilter('ALL'); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-40" aria-label="筛选站点"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup><SelectItem value="ALL">全部站点</SelectItem>{siteOptions.map((item) => <SelectItem key={item.upstreamId} value={String(item.upstreamId)}>{item.upstreamName}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            <Select value={groupFilter} onValueChange={(value) => { setGroupFilter(value); setModelFilter('ALL'); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-40" aria-label="筛选分组"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup><SelectItem value="ALL">全部分组</SelectItem>{groupOptions.map((item) => <SelectItem key={item.group} value={item.group}>{item.group}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            <Select value={modelFilter} onValueChange={(value) => { setModelFilter(value); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-48" aria-label="筛选模型"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup><SelectItem value="ALL">全部模型</SelectItem>{modelOptions.map((model) => <SelectItem key={model} value={model}>{model}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            {hasFilters ? <Button size="icon-sm" variant="ghost" aria-label="清除筛选" title="清除筛选" onClick={() => { setSiteFilter('ALL'); setGroupFilter('ALL'); setModelFilter('ALL'); setCurrentPage(1); }}><X /></Button> : null}
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
          ) : <div
            className="border-y"
            onClickCapture={(event) => {
              if (!suppressClick.current) return;
              event.preventDefault();
              event.stopPropagation();
              suppressClick.current = false;
            }}
          >
            <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>
                {['站点','分组','模型','输入价格','输出价格','倍率','24小时成功率','24小时平均延迟','最近探测','余额','最后采集'].map((label) => <th key={label} className="whitespace-nowrap px-3 py-3 text-left font-medium">{label}</th>)}
              </tr></thead>
              <tbody>{pagedItems.map((item) => {
                const itemId = dashboardItemId(item);
                return <tr
                  key={itemId}
                  ref={(element) => {
                    if (element) rowRefs.current.set(itemId, element);
                    else rowRefs.current.delete(itemId);
                  }}
                  onPointerDown={(event) => handlePointerDown(event, itemId)}
                  className={cn(
                    'cursor-grab select-none border-t transition-[background-color,box-shadow,opacity] duration-150 hover:bg-muted/30',
                    draggedId === itemId && 'pointer-events-none relative z-20 bg-background opacity-90 shadow-xl',
                  )}
                >
                <td className="px-3 py-3"><Link draggable={false} href={`/upstreams/${item.upstreamId}`} className="block"><div className="flex items-center gap-2 font-semibold"><StatusDot status={item.status} />{item.upstreamName}</div></Link></td>
                <td className="max-w-40 px-3 py-3 text-xs" title={item.group}>
                  <div className="truncate font-medium">{item.group}</div>
                  {item.label && item.label !== item.group ? <div className="mt-1 truncate text-muted-foreground">备注：{item.label}</div> : null}
                </td>
                <td className="max-w-44 truncate px-3 py-3 font-mono text-xs" title={item.testModel || ''}>{item.testModel || '未配置'}</td>
                <td className="px-3 py-3"><PriceValue price={item.price} field="inputPrice" /></td>
                <td className="px-3 py-3"><PriceValue price={item.price} field="outputPrice" /></td>
                <td
                  className="px-3 py-3 tabular-nums"
                  title={item.price?.multiplier != null ? '按最新价格和本站充值汇率换算的实际倍率' : '按本站充值汇率换算的分组倍率'}
                >
                  {formatMultiplier(item.price?.multiplier ?? item.groupRateMultiplier)}
                </td>
                <td className="px-3 py-3"><div className={cn('font-semibold tabular-nums', rateColor(item.generationSuccess24h))}>{item.generationSuccess24h == null ? '—' : `${item.generationSuccess24h}%`}</div><div className="text-xs text-muted-foreground">{item.sampleCount24h} 次真实生成</div></td>
                <td className="px-3 py-3 tabular-nums">{formatLatencySeconds(item.averageLatencyMs)}</td>
                <td className="px-3 py-3"><ProbeStrip values={item.recentProbes} /></td>
                <td className="px-3 py-3 tabular-nums">
                  <Link
                    draggable={false}
                    href={`/costs?upstreamId=${item.upstreamId}`}
                    className="inline-flex rounded-sm font-medium underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {item.balance == null ? '—' : `¥${item.balance.toFixed(2)}`}
                  </Link>
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{item.lastCollectedAt ? timeAgo(item.lastCollectedAt) : '从未'}</td>
              </tr>})}</tbody>
            </table>
            </div>
            <DashboardPagination
              total={displayedItems.length}
              page={visiblePage}
              pageSize={pageSize}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardPagination({ total, page, pageSize, totalPages, onPageChange, onPageSizeChange }: {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>共 {total} 条</span>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="h-8 w-24" aria-label="每页数量"><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>
            {PAGE_SIZE_OPTIONS.map((size) => <SelectItem key={size} value={String(size)}>{size} 条/页</SelectItem>)}
          </SelectGroup></SelectContent>
        </Select>
      </div>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={page <= 1}
              className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
              tabIndex={page <= 1 ? -1 : undefined}
              onClick={(event) => { event.preventDefault(); if (page > 1) onPageChange(page - 1); }}
            />
          </PaginationItem>
          <PaginationItem className="px-2 text-sm text-muted-foreground sm:hidden">第 {page} / {totalPages} 页</PaginationItem>
          {getPaginationItems(page, totalPages).map((item, index) => (
            <PaginationItem key={`${item}-${index}`} className="hidden sm:block">
              {item === 'ellipsis' ? <PaginationEllipsis /> : (
                <PaginationLink
                  href="#"
                  isActive={item === page}
                  onClick={(event) => { event.preventDefault(); onPageChange(item); }}
                >
                  {item}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={page >= totalPages}
              className={page >= totalPages ? 'pointer-events-none opacity-50' : undefined}
              tabIndex={page >= totalPages ? -1 : undefined}
              onClick={(event) => { event.preventDefault(); if (page < totalPages) onPageChange(page + 1); }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
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
  if (price.source === 'WAITING') return <span className="text-muted-foreground" title="已读取站点公开目录，等待下一次真实模型测试获取实际路由价格">等待实测</span>;
  const symbol = price.currency === 'CNY' ? '¥' : '$';
  const value = price[field];
  const sourceLabel = price.source === 'OBSERVED'
    ? '最近一次真实路由日志'
    : price.source === 'MEASURED'
      ? '实际扣费反推'
      : price.source === 'AUTO'
        ? '站点公开价格目录（仅供参考）'
        : price.source === 'CALCULATED'
          ? '按官方价格、倍率和充值比例自动计算'
          : `价格来源：${price.source}`;
  return <span className="tabular-nums" title={sourceLabel}>{value == null ? '—' : `${symbol}${value.toFixed(4)}`}</span>;
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

function mergeDashboardOrder(savedOrder: string[], currentIds: string[]) {
  const current = new Set(currentIds);
  const merged = savedOrder.filter((id) => current.has(id));
  const known = new Set(merged);
  currentIds.forEach((id) => {
    if (!known.has(id)) merged.push(id);
  });
  return merged;
}

function replaceVisibleDashboardOrder(baseOrder: string[], visibleIds: string[]) {
  const visible = new Set(visibleIds);
  let index = 0;
  return baseOrder.map((id) => visible.has(id) ? visibleIds[index++] : id);
}

function positionDraggedRow(session: DashboardPointerSession, clientY: number) {
  session.lastClientY = clientY;
  const visualTop = session.source.getBoundingClientRect().top;
  const layoutTop = visualTop - session.translateY;
  session.translateY = clientY - session.grabOffsetY - layoutTop;
  session.source.style.transform = `translate3d(0, ${session.translateY}px, 0)`;
}

function ProbeStrip({ values }: { values: boolean[] }) {
  if (!values.length) return <span className="text-muted-foreground">—</span>;
  return <div className="flex w-[92px] gap-1" title={`最近 ${values.length} 次真实生成`}>
    {values.map((ok, index) => <span key={index} className={cn('h-5 min-w-1 flex-1 rounded-sm', ok ? 'bg-success' : 'bg-destructive')} />)}
  </div>;
}

function rateColor(value: number | null) {
  if (value == null) return 'text-muted-foreground';
  return value >= 90 ? 'text-success' : 'text-destructive';
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
