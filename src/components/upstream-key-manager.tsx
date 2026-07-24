'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus, RefreshCw, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { StatusDot } from '@/components/StatusBadge';
import { useConfirm } from '@/components/confirm-dialog';
import type { UpstreamKeyRow } from '@/components/upstreams-columns';
import { formatGroupMultiplier, getKeyDisplayName, getKeyGroupLabel } from '@/lib/key-display';
import { formatLatencySeconds } from '@/lib/latency-display';

function formatKeyModels(key: UpstreamKeyRow) {
  const names = (key.monitoredModels || [])
    .filter((model) => model.enabled)
    .map((model) => model.modelName);
  if (names.length === 0) return key.testModel || '未配置';
  if (names.length === 1) return names[0];
  return `${names.length} 个模型`;
}

export function UpstreamKeyManager({
  upstreamId,
  type,
  onEditKey,
}: {
  upstreamId: number;
  type: string;
  onEditKey: (key: UpstreamKeyRow | null) => void;
}) {
  const { confirm, dialog } = useConfirm();
  const [keys, setKeys] = useState<UpstreamKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingKeyId, setRefreshingKeyId] = useState<number | null>(null);

  const fetchKeys = useCallback(async () => {
    const response = await fetch(`/api/upstreams/${upstreamId}/keys`);
    const result = await response.json().catch(() => []);
    if (!response.ok) {
      toast.error(result.error || '加载分组失败');
      setKeys([]);
    } else {
      setKeys(Array.isArray(result) ? result : []);
    }
    setLoading(false);
  }, [upstreamId]);

  useEffect(() => {
    void fetchKeys();
  }, [fetchKeys]);

  async function handleDeleteKey(keyId: number, group: string) {
    const accepted = await confirm({
      title: `删除分组「${group}」？`,
      description: '该分组的所有指标数据将被删除。',
      destructive: true,
      confirmText: '删除',
    });
    if (!accepted) return;

    const response = await fetch(`/api/upstreams/${upstreamId}/keys/${keyId}`, { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(result.error || `删除分组 ${group} 失败`);
      return;
    }
    toast.success(`已删除分组 ${group}`);
    await fetchKeys();
  }

  async function handleTestKey(keyId: number, group: string) {
    const toastId = toast.loading(`正在测试 ${group}…`);
    try {
      const response = await fetch(`/api/keys/${keyId}/test`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) {
        toast.error(`${group}: ${result.error}`, { id: toastId });
      } else if (result.modelTestOk === true) {
        const latency = result.modelTestLatMs ?? result.latencyMs;
        toast.success(
          `${group}: API 测试成功${latency != null ? `，延迟 ${formatLatencySeconds(latency)}` : ''}`,
          { id: toastId },
        );
      } else {
        toast.error(
          `${group}: API 测试失败${result.errorMessage ? `，${result.errorMessage}` : ''}`,
          { id: toastId },
        );
      }
      await fetchKeys();
    } catch (error) {
      toast.error((error as Error).message, { id: toastId });
    }
  }

  async function handleRefreshKey(key: UpstreamKeyRow) {
    setRefreshingKeyId(key.id);
    try {
      const response = await fetch(`/api/keys/${key.id}/metadata`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error || '远端信息获取失败');
        return;
      }
      toast.success('远端信息已更新');
      await fetchKeys();
    } catch (error) {
      toast.error('请求失败: ' + (error as Error).message);
    } finally {
      setRefreshingKeyId(null);
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">加载分组…</div>;

  return (
    <div className="space-y-3">
      {dialog}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <KeyRound className="h-4 w-4" />
          分组
        </h3>
        <Button size="sm" variant="outline" onClick={() => onEditKey(null)}>
          <Plus data-icon="inline-start" />
          添加分组
        </Button>
      </div>
      {keys.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">暂无分组</p>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex flex-col items-stretch gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-2">
                <StatusDot status={key.status} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium" title={getKeyDisplayName(key)}>
                    {key.group}
                  </div>
                  {key.label && key.label !== key.group ? (
                    <div className="truncate text-xs text-muted-foreground">备注：{key.label}</div>
                  ) : null}
                  <div className="break-words text-xs text-muted-foreground">
                    {type === 'NEW_API' && (
                      <>
                        分组：{getKeyGroupLabel(key)} · 倍率：{formatGroupMultiplier(key.groupRateMultiplier)}
                        {key.groupDescription ? ` · ${key.groupDescription}` : ''}
                        {' · '}
                      </>
                    )}
                    模型：{formatKeyModels(key)} ·
                    {key.hasApiKey ? 'Key' : '无Key'}
                    {type === 'NEW_API' && (key.hasAccessToken ? ' + 令牌' : ' + 无令牌')}
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
                    disabled={refreshingKeyId === key.id}
                    onClick={() => handleRefreshKey(key)}
                  >
                    <RefreshCw
                      data-icon="inline-start"
                      className={refreshingKeyId === key.id ? 'animate-spin' : undefined}
                    />
                    {refreshingKeyId === key.id ? '刷新中…' : '刷新'}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  title="只测试本组轮换到的一个模型，会消耗少量 Token"
                  onClick={() => handleTestKey(key.id, key.group)}
                >
                  <Zap data-icon="inline-start" />
                  测试本组
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onEditKey(key)}>
                  <Pencil data-icon="inline-start" />
                  编辑
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive"
                  aria-label={`删除分组 ${key.group}`}
                  title={`删除分组 ${key.group}`}
                  onClick={() => handleDeleteKey(key.id, key.group)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
