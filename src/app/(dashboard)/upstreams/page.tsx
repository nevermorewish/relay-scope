'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, Zap, KeyRound, RefreshCw, Server, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { StatusDot } from '@/components/StatusBadge';
import { useConfirm } from '@/components/confirm-dialog';
import { toast } from 'sonner';
import { formatGroupMultiplier, getKeyDisplayName, getKeyGroupLabel } from '@/lib/key-display';
import { beginLatestRequest } from '@/lib/request-sequence';
import {
  UpstreamsDataTable,
  type UpstreamTableQuery,
  type UpstreamTableSorting,
} from '@/components/upstreams-data-table';
import type { UpstreamKeyRow, UpstreamRow } from '@/components/upstreams-columns';
import { AddUpstreamGroupDialog } from '@/components/add-upstream-group-dialog';
import { buildUpstreamListSearchParams } from '@/lib/upstream-query';
import { PageHeader } from '@/components/page-header';
import { getOfficialModelPrice } from '@/lib/official-model-prices';

type UpstreamKey = UpstreamKeyRow;
type Upstream = UpstreamRow;

interface EditableModel {
  clientId: string;
  modelName: string;
  officialInputPrice: string;
  officialOutputPrice: string;
  enabled: boolean;
}

interface DraftGroup {
  clientId: string;
  group: string;
  label: string;
  apiKey: string;
  showApiKey: boolean;
  accessToken: string;
  userId: string;
  groupRateMultiplier: string;
  models: EditableModel[];
  availableModels: string[];
  loadingModels: boolean;
}

interface MonitorStatus {
  enabled: boolean;
  running: boolean;
  nextRunAt: string | null;
  nextHeavyRunAt: string | null;
}

function emptyEditableModel(): EditableModel {
  return {
    clientId: `new-${Date.now()}-${Math.random()}`,
    modelName: '',
    officialInputPrice: '',
    officialOutputPrice: '',
    enabled: true,
  };
}

function emptyDraftGroup(): DraftGroup {
  return {
    clientId: `group-${Date.now()}-${Math.random()}`,
    group: '',
    label: '',
    apiKey: '',
    showApiKey: false,
    accessToken: '',
    userId: '',
    groupRateMultiplier: '',
    models: [emptyEditableModel()],
    availableModels: [],
    loadingModels: false,
  };
}

function validateDraftGroups(groups: DraftGroup[]) {
  if (groups.length === 0) throw new Error('请至少添加一个分组');

  const groupNames = new Set<string>();
  groups.forEach((draft, groupIndex) => {
    const groupName = draft.group.trim();
    if (!groupName) throw new Error(`分组 ${groupIndex + 1}：请填写分组名`);
    if (groupNames.has(groupName)) throw new Error(`分组名「${groupName}」重复`);
    groupNames.add(groupName);

    if (!draft.apiKey.trim()) throw new Error(`分组「${groupName}」：请填写 API Key`);
    if (draft.groupRateMultiplier !== '') {
      const multiplier = Number(draft.groupRateMultiplier);
      if (!Number.isFinite(multiplier) || multiplier < 0) {
        throw new Error(`分组「${groupName}」：倍率必须是大于或等于 0 的数字`);
      }
    }

    const enabledModels = draft.models.filter((model) => model.enabled);
    if (enabledModels.length === 0) throw new Error(`分组「${groupName}」：请至少启用一个监测模型`);
    const modelNames = new Set<string>();
    enabledModels.forEach((model) => {
      const modelName = model.modelName.trim();
      if (!modelName) throw new Error(`分组「${groupName}」：请填写启用模型的名称`);
      if (modelNames.has(modelName)) throw new Error(`分组「${groupName}」中的模型「${modelName}」重复`);
      modelNames.add(modelName);

      if (!getOfficialModelPrice(modelName)) {
        const inputPrice = Number(model.officialInputPrice);
        const outputPrice = Number(model.officialOutputPrice);
        if (model.officialInputPrice === '' || !Number.isFinite(inputPrice) || inputPrice < 0) {
          throw new Error(`模型「${modelName}」未匹配内置价格，请填写官方输入价`);
        }
        if (model.officialOutputPrice === '' || !Number.isFinite(outputPrice) || outputPrice < 0) {
          throw new Error(`模型「${modelName}」未匹配内置价格，请填写官方输出价`);
        }
      }
    });
  });
}

function draftGroupRequest(draft: DraftGroup) {
  return {
    group: draft.group.trim(),
    label: draft.label.trim(),
    apiKey: draft.apiKey.trim(),
    accessToken: draft.accessToken.trim(),
    userId: draft.userId.trim(),
    groupRateMultiplier: draft.groupRateMultiplier === '' ? null : Number(draft.groupRateMultiplier),
    enabled: true,
    monitoredModels: draft.models
      .filter((model) => model.modelName.trim())
      .map((model) => ({
        modelName: model.modelName.trim(),
        officialInputPrice: model.officialInputPrice === '' ? null : Number(model.officialInputPrice),
        officialOutputPrice: model.officialOutputPrice === '' ? null : Number(model.officialOutputPrice),
        enabled: model.enabled,
      })),
  };
}

function formatKeyModels(key: UpstreamKey) {
  const names = (key.monitoredModels || []).filter((model) => model.enabled).map((model) => model.modelName);
  if (names.length === 0) return key.testModel || '未配置';
  if (names.length === 1) return names[0];
  return `${names.length} 个模型`;
}

export default function UpstreamsPage() {
  const { confirm, dialog } = useConfirm();
  const [upstreams, setUpstreams] = useState<Upstream[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Upstream | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [monitorStatus, setMonitorStatus] = useState<MonitorStatus | null>(null);
  const [togglingMonitor, setTogglingMonitor] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [query, setQuery] = useState<UpstreamTableQuery>({
    search: '',
    type: 'ALL',
    status: 'ALL',
  });
  const [sorting, setSorting] = useState<UpstreamTableSorting>({ direction: 'asc' });
  const requestSequence = useRef(0);
  const lastRequestedSearch = useRef('');

  const fetchData = useCallback(async (silent = false) => {
    const isCurrent = beginLatestRequest(requestSequence);
    if (!silent) setLoading(true);
    try {
      const params = buildUpstreamListSearchParams({
        page,
        pageSize,
        search: query.search,
        type: query.type,
        status: query.status,
        sort: sorting.sort,
        direction: sorting.direction,
      });
      const res = await fetch(`/api/upstreams?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '获取上游失败');
      if (!isCurrent()) return;
      const nextPagination = data.pagination || { page, pageSize, total: 0, totalPages: 1 };
      setUpstreams(Array.isArray(data.items) ? data.items : []);
      setPagination(nextPagination);
      if (nextPagination.page !== page) setPage(nextPagination.page);
    } catch (error) {
      if (isCurrent() && !silent) toast.error((error as Error).message);
    } finally {
      if (isCurrent() && !silent) setLoading(false);
    }
  }, [page, pageSize, query, sorting]);

  const fetchMonitorStatus = useCallback(async () => {
    const res = await fetch('/api/monitor');
    if (res.ok) setMonitorStatus(await res.json());
  }, []);

  useEffect(() => {
    requestSequence.current += 1;
    const delay = query.search === lastRequestedSearch.current ? 0 : 300;
    const timer = window.setTimeout(() => {
      lastRequestedSearch.current = query.search;
      void fetchData();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [fetchData, query.search]);

  useEffect(() => {
    void fetchMonitorStatus();
    const timer = window.setInterval(() => void fetchMonitorStatus(), 30000);
    return () => window.clearInterval(timer);
  }, [fetchMonitorStatus]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void fetchData(true);
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

  function handleEdit(u: Upstream) { setEditing(u); setShowForm(true); }
  function handleAdd() { setEditing(null); setShowForm(true); }

  async function handleDelete(id: number, name: string) {
    const ok = await confirm({
      title: `删除上游「${name}」？`,
      description: '该操作会删除该上游及其所有分组、指标和告警数据，不可恢复。',
      destructive: true,
      confirmText: '删除',
    });
    if (!ok) return;
    const res = await fetch(`/api/upstreams/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || `删除 ${name} 失败`);
      return;
    }
    toast.success(`已删除 ${name}`);
    if (upstreams.length === 1 && pagination.page > 1) {
      setPage(pagination.page - 1);
    } else {
      fetchData();
    }
  }

  async function handleToggle(id: number, enabled: boolean) {
    const res = await fetch(`/api/upstreams/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || '更新监测状态失败');
      return;
    }
    toast.success(enabled ? '已暂停该站点的自动监测' : '已恢复该站点的自动监测');
    await fetchData();
  }

  async function handleMonitorToggle(enabled: boolean) {
    setTogglingMonitor(true);
    try {
      const res = await fetch('/api/monitor', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const next = await res.json();
      if (!res.ok) throw new Error(next.error || '更新自动监测失败');
      setMonitorStatus(next);
      toast.success(enabled ? '自动监测已开启' : '自动监测已关闭');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setTogglingMonitor(false);
    }
  }

  async function handleTestAll() {
    setTestingAll(true);
    const tid = toast.loading('正在依次测试所有站点…');
    try {
      const res = await fetch('/api/upstreams/test-all', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '测试失败');
      toast.success(`测试完成：${result.successful}/${result.total} 个分组成功`, { id: tid });
      await Promise.all([fetchData(), fetchMonitorStatus()]);
    } catch (error) {
      toast.error((error as Error).message, { id: tid });
    } finally {
      setTestingAll(false);
    }
  }

  return (
    <div className="space-y-6">
      {dialog}
      <PageHeader
        icon={Server}
        title="上游管理"
        actionsClassName="w-full justify-start sm:w-auto sm:justify-end"
        actions={(
          <>
            <div className="flex h-8 items-center gap-2 border-r pr-3">
              <Switch
                checked={monitorStatus?.enabled ?? false}
                onCheckedChange={handleMonitorToggle}
                disabled={!monitorStatus || togglingMonitor}
                aria-label="自动监测"
              />
              <div className="leading-tight">
                <div className="text-xs font-medium">自动监测</div>
                <div className="text-[11px] text-muted-foreground">
                  {monitorStatus?.running
                    ? '检测中…'
                    : monitorStatus?.enabled
                      ? formatNextRun(monitorStatus.nextHeavyRunAt)
                      : '已关闭'}
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={handleTestAll} disabled={testingAll}>
              {testingAll
                ? <Loader2 className="animate-spin" data-icon="inline-start" />
                : <Zap data-icon="inline-start" />}
              {testingAll ? '测试中…' : '测试全部'}
            </Button>
            <Button size="sm" onClick={handleAdd}>
              <Plus data-icon="inline-start" />
              添加上游
            </Button>
          </>
        )}
      />

      <UpstreamsDataTable
        data={upstreams}
        query={query}
        sorting={sorting}
        pagination={pagination}
        loading={loading}
        onQueryChange={setQuery}
        onSortingChange={setSorting}
        onPaginationChange={({ page: nextPage, pageSize: nextPageSize }) => {
          setPage(nextPage);
          setPageSize(nextPageSize);
        }}
        onEdit={handleEdit}
        onToggle={(upstream) => handleToggle(upstream.id, upstream.enabled)}
        onDelete={(upstream) => handleDelete(upstream.id, upstream.name)}
      />

      {showForm && (
        <UpstreamFormDialog upstream={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData(); }} />
      )}
    </div>
  );
}

function formatNextRun(value: string | null) {
  if (!value) return '等待下次监测';
  return `下次监测 ${new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
}

// ============ 上游编辑弹窗 ============
function UpstreamFormDialog({ upstream, onClose, onSaved }: {
  upstream: Upstream | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(upstream?.name || '');
  const [baseUrl, setBaseUrl] = useState(upstream?.baseUrl || '');
  const type = upstream?.type || 'SUB2API';
  const [creditUsdPerCny, setCreditUsdPerCny] = useState(String(upstream?.creditUsdPerCny || 1));
  const [enabled, setEnabled] = useState(upstream?.enabled ?? true);
  const [draftGroups, setDraftGroups] = useState<DraftGroup[]>(() => upstream ? [] : [emptyDraftGroup()]);
  const [keyEditor, setKeyEditor] = useState<{ key: UpstreamKey | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaving(true);
    let createdUpstreamId: number | null = null;
    try {
      if (!upstream) validateDraftGroups(draftGroups);
      const body = { name, baseUrl, enabled, creditUsdPerCny: Number(creditUsdPerCny) };
      const url = upstream ? `/api/upstreams/${upstream.id}` : '/api/upstreams';
      const method = upstream ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const savedUpstream = await res.json();
      if (!res.ok) throw new Error(savedUpstream.error || '保存失败');
      if (!upstream) {
        createdUpstreamId = Number(savedUpstream.id);
        if (!Number.isInteger(createdUpstreamId)) throw new Error('站点已创建，但返回的站点 ID 无效');
        for (const draft of draftGroups) {
          const keyRes = await fetch(`/api/upstreams/${createdUpstreamId}/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draftGroupRequest(draft)),
          });
          const keyResult = await keyRes.json();
          if (!keyRes.ok) throw new Error(`分组「${draft.group}」创建失败：${keyResult.error || '保存失败'}`);
        }
      }
      toast.success(upstream ? '上游已更新' : '上游及分组已创建');
      onSaved();
    } catch (e) {
      if (createdUpstreamId != null) {
        await fetch(`/api/upstreams/${createdUpstreamId}`, { method: 'DELETE' }).catch(() => null);
      }
      setError('保存失败: ' + (e as Error).message);
    }
    finally { setSaving(false); }
  }

  function updateDraftGroup(clientId: string, patch: Partial<DraftGroup>) {
    setDraftGroups((current) => current.map((group) => group.clientId === clientId ? { ...group, ...patch } : group));
  }

  function updateDraftModel(groupId: string, modelId: string, patch: Partial<EditableModel>) {
    setDraftGroups((current) => current.map((group) => group.clientId === groupId ? {
      ...group,
      models: group.models.map((model) => model.clientId === modelId ? { ...model, ...patch } : model),
    } : group));
  }

  function updateDraftModelName(groupId: string, modelId: string, modelName: string) {
    const catalog = getOfficialModelPrice(modelName);
    setDraftGroups((current) => current.map((group) => group.clientId === groupId ? {
      ...group,
      models: group.models.map((model) => {
        if (model.clientId !== modelId) return model;
        const previousCatalog = getOfficialModelPrice(model.modelName);
        return {
          ...model,
          modelName,
          officialInputPrice: catalog ? String(catalog.input) : previousCatalog ? '' : model.officialInputPrice,
          officialOutputPrice: catalog ? String(catalog.output) : previousCatalog ? '' : model.officialOutputPrice,
        };
      }),
    } : group));
  }

  async function loadDraftModels(draft: DraftGroup) {
    if (!baseUrl.trim()) {
      toast.error('请先填写站点地址');
      return;
    }
    if (!draft.apiKey.trim()) {
      toast.error(`请先填写分组「${draft.group.trim() || '未命名'}」的 API Key`);
      return;
    }

    updateDraftGroup(draft.clientId, { loadingModels: true });
    try {
      const res = await fetch('/api/upstreams/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, apiKey: draft.apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '读取模型失败');
      const availableModels = Array.isArray(data.models)
        ? data.models.filter((model: unknown): model is string => typeof model === 'string')
        : [];
      updateDraftGroup(draft.clientId, { availableModels });
      toast.success(`已读取 ${availableModels.length} 个可用模型`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      updateDraftGroup(draft.clientId, { loadingModels: false });
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        {upstream && keyEditor ? (
          <AddUpstreamGroupDialog
            embedded
            upstreamId={upstream.id}
            upstreamType={type}
            baseUrl={baseUrl}
            keyData={keyEditor.key}
            onClose={onClose}
            onSaved={onSaved}
          />
        ) : (
          <>
        <DialogHeader>
          <DialogTitle>{upstream ? `编辑上游 - ${upstream.name}` : '添加上游'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：聪明AI" required />
            </div>
            <div className="space-y-1.5">
              <Label>地址</Label>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="relay.example.com" required />
            </div>
            <div className="space-y-1.5">
              <Label>每 1 元人民币获得的美元额度</Label>
              <Input type="number" min="0.000001" step="any" value={creditUsdPerCny} onChange={(e) => setCreditUsdPerCny(e.target.value)} required />
              <p className="text-xs text-muted-foreground">例如 ¥1 到账 $1 填 1，¥1 到账 $10 填 10</p>
            </div>
          </div>
          {!upstream && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">分组与监测模型</div>
                  <p className="text-xs text-muted-foreground">每个分组使用自己的 API Key，并可监测多个模型</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDraftGroups((current) => [...current, emptyDraftGroup()])}
                >
                  <Plus data-icon="inline-start" />添加分组
                </Button>
              </div>

              {draftGroups.length === 0 ? (
                <div className="border-y py-6 text-center text-sm text-muted-foreground">尚未添加分组</div>
              ) : draftGroups.map((draft, groupIndex) => (
                <div key={draft.clientId} className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">分组 {groupIndex + 1}</div>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive"
                      aria-label={`移除分组 ${groupIndex + 1}`}
                      title="移除分组"
                      onClick={() => setDraftGroups((current) => current.filter((item) => item.clientId !== draft.clientId))}
                    >
                      <Trash2 />
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>分组名</Label>
                      <Input
                        value={draft.group}
                        onChange={(event) => updateDraftGroup(draft.clientId, { group: event.target.value })}
                        placeholder="如：gpt监测"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>标签（可选）</Label>
                      <Input
                        value={draft.label}
                        onChange={(event) => updateDraftGroup(draft.clientId, { label: event.target.value })}
                        placeholder="备注"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>API Key</Label>
                      <div className="relative">
                        <Input
                          type={draft.showApiKey ? 'text' : 'password'}
                          className="pr-10 font-mono text-xs"
                          value={draft.apiKey}
                          onChange={(event) => updateDraftGroup(draft.clientId, { apiKey: event.target.value })}
                          placeholder="sk-xxx"
                          required
                        />
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="absolute right-1 top-1/2 -translate-y-1/2"
                          aria-label={draft.showApiKey ? '隐藏 API Key' : '显示 API Key'}
                          title={draft.showApiKey ? '隐藏 API Key' : '显示 API Key'}
                          onClick={() => updateDraftGroup(draft.clientId, { showApiKey: !draft.showApiKey })}
                        >
                          {draft.showApiKey ? <EyeOff /> : <Eye />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>倍率（可选）</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={draft.groupRateMultiplier}
                        onChange={(event) => updateDraftGroup(draft.clientId, { groupRateMultiplier: event.target.value })}
                        placeholder="如 0.8"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>监测模型</Label>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={draft.loadingModels}
                          title="从站点读取可用模型，不消耗生成 Token"
                          onClick={() => loadDraftModels(draft)}
                        >
                          <RefreshCw data-icon="inline-start" className={draft.loadingModels ? 'animate-spin' : undefined} />
                          {draft.loadingModels ? '读取中…' : '读取模型'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => updateDraftGroup(draft.clientId, { models: [...draft.models, emptyEditableModel()] })}
                        >
                          <Plus data-icon="inline-start" />添加模型
                        </Button>
                      </div>
                    </div>
                    <datalist id={`draft-models-${draft.clientId}`}>
                      {draft.availableModels.map((model) => <option key={model} value={model} />)}
                    </datalist>
                    {draft.models.map((model) => (
                      <div key={model.clientId} className="grid gap-2 rounded-md bg-muted/30 p-2 sm:grid-cols-[minmax(160px,1fr)_110px_110px_auto_auto] sm:items-end">
                        <div className="space-y-1">
                          <Label className="text-xs">模型名称</Label>
                          <Input
                            list={`draft-models-${draft.clientId}`}
                            value={model.modelName}
                            onChange={(event) => updateDraftModelName(draft.clientId, model.clientId, event.target.value)}
                            placeholder="gpt-5.6-sol"
                            required={model.enabled}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">官方输入价</Label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={model.officialInputPrice}
                            onChange={(event) => updateDraftModel(draft.clientId, model.clientId, { officialInputPrice: event.target.value })}
                            placeholder="USD / 1M"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">官方输出价</Label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={model.officialOutputPrice}
                            onChange={(event) => updateDraftModel(draft.clientId, model.clientId, { officialOutputPrice: event.target.value })}
                            placeholder="USD / 1M"
                          />
                        </div>
                        <div className="flex h-9 items-center gap-2">
                          <Switch
                            checked={model.enabled}
                            onCheckedChange={(enabled) => updateDraftModel(draft.clientId, model.clientId, { enabled })}
                            aria-label={`监测 ${model.modelName || '模型'}`}
                          />
                          <span className="text-xs">监测</span>
                        </div>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive"
                          aria-label="移除模型"
                          title="移除模型"
                          onClick={() => updateDraftGroup(draft.clientId, {
                            models: draft.models.filter((item) => item.clientId !== model.clientId),
                          })}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} id="ue-enabled" />
            <Label htmlFor="ue-enabled">参与自动监测</Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" size="sm" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" size="sm" disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
          </DialogFooter>
        </form>
        {upstream && (
          <>
            <Separator />
            <KeyManager
              upstreamId={upstream.id}
              type={type}
              onEditKey={(key) => setKeyEditor({ key })}
            />
          </>
        )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============ 分组 Keys 管理器 ============
function KeyManager({ upstreamId, type, onEditKey }: {
  upstreamId: number;
  type: string;
  onEditKey: (key: UpstreamKey | null) => void;
}) {
  const { confirm, dialog } = useConfirm();
  const [keys, setKeys] = useState<UpstreamKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingKeyId, setRefreshingKeyId] = useState<number | null>(null);

  const fetchKeys = useCallback(async () => {
    const res = await fetch(`/api/upstreams/${upstreamId}/keys`);
    setKeys(await res.json());
    setLoading(false);
  }, [upstreamId]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  async function handleDeleteKey(keyId: number, group: string) {
    const ok = await confirm({
      title: `删除分组「${group}」？`,
      description: '该分组的所有指标数据将被删除。',
      destructive: true,
      confirmText: '删除',
    });
    if (!ok) return;
    await fetch(`/api/upstreams/${upstreamId}/keys/${keyId}`, { method: 'DELETE' });
    toast.success(`已删除分组 ${group}`);
    fetchKeys();
  }

  async function handleTestKey(keyId: number, group: string) {
    const tid = toast.loading(`正在测试 ${group}…`);
    try {
      const res = await fetch(`/api/keys/${keyId}/test`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`${group}: ${data.error}`, { id: tid });
      } else if (data.modelTestOk === true) {
        const latency = data.modelTestLatMs ?? data.latencyMs;
        toast.success(`${group}: API 测试成功${latency != null ? `，延迟 ${latency}ms` : ''}`, { id: tid });
      } else {
        toast.error(`${group}: API 测试失败${data.errorMessage ? `，${data.errorMessage}` : ''}`, { id: tid });
      }
      fetchKeys();
    } catch (e) { toast.error((e as Error).message, { id: tid }); }
  }

  async function handleRefreshKey(key: UpstreamKey) {
    setRefreshingKeyId(key.id);
    try {
      const res = await fetch(`/api/keys/${key.id}/metadata`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || '远端信息获取失败');
        return;
      }
      toast.success('远端信息已更新');
      await fetchKeys();
    } catch (e) {
      toast.error('请求失败: ' + (e as Error).message);
    } finally {
      setRefreshingKeyId(null);
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">加载分组…</div>;

  return (
    <div className="space-y-3">
      {dialog}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><KeyRound className="h-4 w-4" />分组</h3>
        <Button size="sm" variant="outline" onClick={() => onEditKey(null)}>
          <Plus data-icon="inline-start" />
          添加分组
        </Button>
      </div>
      {keys.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">暂无分组</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="flex flex-col items-stretch gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <StatusDot status={k.status} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium" title={getKeyDisplayName(k)}>
                    {k.group}
                  </div>
                  {k.label && k.label !== k.group ? <div className="truncate text-xs text-muted-foreground">备注：{k.label}</div> : null}
                  <div className="break-words text-xs text-muted-foreground">
                    {type === 'NEW_API' && (
                      <>
                        分组：{getKeyGroupLabel(k)} · 倍率：{formatGroupMultiplier(k.groupRateMultiplier)}
                        {k.groupDescription ? ` · ${k.groupDescription}` : ''}
                        {' · '}
                      </>
                    )}
                    模型：{formatKeyModels(k)} ·
                    {k.hasApiKey ? 'Key' : '无Key'}
                    {type === 'NEW_API' && (k.hasAccessToken ? ' + 令牌' : ' + 无令牌')}
                  </div>
                </div>
              </div>
              <div className="flex w-full flex-wrap justify-end gap-1 sm:w-auto sm:shrink-0">
                {type === 'NEW_API' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="重新获取远端信息"
                    title="重新获取远端信息"
                    disabled={refreshingKeyId === k.id}
                    onClick={() => handleRefreshKey(k)}
                  >
                    <RefreshCw data-icon="inline-start" className={refreshingKeyId === k.id ? 'animate-spin' : undefined} />
                    {refreshingKeyId === k.id ? '刷新中…' : '刷新'}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  title="只测试本组轮换到的一个模型，会消耗少量 Token"
                  onClick={() => handleTestKey(k.id, k.group)}
                >
                  <Zap data-icon="inline-start" />
                  测试本组
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onEditKey(k)}>
                  <Pencil data-icon="inline-start" />
                  编辑
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive"
                  aria-label={`删除分组 ${k.group}`}
                  title={`删除分组 ${k.group}`}
                  onClick={() => handleDeleteKey(k.id, k.group)}
                >
                  <Trash2 data-icon="inline-start" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
