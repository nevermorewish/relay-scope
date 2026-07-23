'use client';

import { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getOfficialModelPrice } from '@/lib/official-model-prices';
import {
  buildGroupRequestBody,
  createEmptyGroupModel,
  createInitialGroupModels,
  validateGroupForm,
  type EditableGroupModel,
} from '@/lib/upstream-group-form';

export interface GroupDialogKey {
  id: number;
  group: string;
  label: string | null;
  groupRateMultiplier: number | null;
  hasApiKey: boolean;
  hasAccessToken: boolean;
  userId?: string | null;
  monitoredModels?: Array<{
    id: number;
    modelName: string;
    officialInputPrice: number | null;
    officialOutputPrice: number | null;
    enabled: boolean;
  }>;
}

const MASKED_SECRET = '********************';

export function AddUpstreamGroupDialog({
  upstreamId,
  upstreamType,
  baseUrl,
  keyData = null,
  embedded = false,
  onClose,
  onSaved,
}: {
  upstreamId: number;
  upstreamType: string;
  baseUrl: string;
  keyData?: GroupDialogKey | null;
  embedded?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [group, setGroup] = useState(keyData?.group || '');
  const [label, setLabel] = useState(keyData?.label || '');
  const [groupRateMultiplier, setGroupRateMultiplier] = useState(
    keyData?.groupRateMultiplier == null ? '' : String(keyData.groupRateMultiplier),
  );
  const [apiKey, setApiKey] = useState('');
  const [apiKeyDirty, setApiKeyDirty] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [revealingApiKey, setRevealingApiKey] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [accessTokenDirty, setAccessTokenDirty] = useState(false);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [revealingAccessToken, setRevealingAccessToken] = useState(false);
  const [userId, setUserId] = useState(keyData?.userId || '');
  const [models, setModels] = useState<EditableGroupModel[]>(() => createInitialGroupModels(keyData?.monitoredModels));
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateModel(clientId: string, patch: Partial<EditableGroupModel>) {
    setModels((current) => current.map((model) => (
      model.clientId === clientId ? { ...model, ...patch } : model
    )));
  }

  function updateModelName(clientId: string, modelName: string) {
    const catalog = getOfficialModelPrice(modelName);
    setModels((current) => current.map((model) => {
      if (model.clientId !== clientId) return model;
      const previousCatalog = getOfficialModelPrice(model.modelName);
      return {
        ...model,
        modelName,
        officialInputPrice: catalog ? String(catalog.input) : previousCatalog ? '' : model.officialInputPrice,
        officialOutputPrice: catalog ? String(catalog.output) : previousCatalog ? '' : model.officialOutputPrice,
      };
    }));
  }

  async function toggleApiKeyVisibility() {
    if (showApiKey) {
      setShowApiKey(false);
      if (!apiKeyDirty) setApiKey('');
      return;
    }
    if (!keyData?.hasApiKey || apiKeyDirty) {
      setShowApiKey(true);
      return;
    }

    setRevealingApiKey(true);
    try {
      const response = await fetch(`/api/upstreams/${upstreamId}/keys/${keyData.id}/secret`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '读取 API Key 失败');
      setApiKey(data.apiKey);
      setShowApiKey(true);
    } catch (revealError) {
      toast.error((revealError as Error).message);
    } finally {
      setRevealingApiKey(false);
    }
  }

  async function toggleAccessTokenVisibility() {
    if (showAccessToken) {
      setShowAccessToken(false);
      if (!accessTokenDirty) setAccessToken('');
      return;
    }
    if (!keyData?.hasAccessToken || accessTokenDirty) {
      setShowAccessToken(true);
      return;
    }

    setRevealingAccessToken(true);
    try {
      const response = await fetch(
        `/api/upstreams/${upstreamId}/keys/${keyData.id}/secret?field=accessToken`,
        { cache: 'no-store' },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '读取 AccessToken 失败');
      setAccessToken(data.accessToken);
      setShowAccessToken(true);
    } catch (revealError) {
      toast.error((revealError as Error).message);
    } finally {
      setRevealingAccessToken(false);
    }
  }

  async function loadModels() {
    if (!keyData && !apiKey.trim()) {
      toast.error('请先填写 API Key');
      return;
    }
    setLoadingModels(true);
    try {
      const response = keyData
        ? await fetch(`/api/upstreams/${upstreamId}/models?keyId=${keyData.id}`)
        : await fetch('/api/upstreams/models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ baseUrl, apiKey: apiKey.trim() }),
          });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '读取模型失败');
      const names = Array.isArray(data.models)
        ? data.models.filter((item: unknown): item is string => typeof item === 'string')
        : [];
      setAvailableModels(names);
      toast.success(`已读取 ${names.length} 个可用模型`);
    } catch (loadError) {
      toast.error((loadError as Error).message);
    } finally {
      setLoadingModels(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const formValues = {
        group,
        label,
        userId,
        groupRateMultiplier,
        apiKey,
        apiKeyDirty,
        accessToken,
        accessTokenDirty,
        isEditing: Boolean(keyData),
        hasApiKey: Boolean(keyData?.hasApiKey),
        models,
      };
      validateGroupForm(formValues);
      const body = buildGroupRequestBody(formValues);

      const response = await fetch(
        keyData
          ? `/api/upstreams/${upstreamId}/keys/${keyData.id}`
          : `/api/upstreams/${upstreamId}/keys`,
        {
          method: keyData ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '保存失败');
      toast.success(keyData ? '分组已更新' : '分组已创建');
      onSaved();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <>
        <DialogHeader>
          <DialogTitle>{keyData ? `编辑分组 - ${keyData.group}` : '添加分组'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>分组名</Label>
              <Input value={group} onChange={(event) => setGroup(event.target.value)} placeholder="default" required />
            </div>
            <div className="space-y-1.5">
              <Label>标签</Label>
              <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="备注" />
            </div>
            <div className="space-y-1.5">
              <Label>倍率（可选）</Label>
              <Input type="number" min="0" step="any" value={groupRateMultiplier} onChange={(event) => setGroupRateMultiplier(event.target.value)} placeholder="如 0.8" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              API Key {keyData?.hasApiKey ? <span className="text-xs text-muted-foreground">（留空保持不变）</span> : null}
            </Label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                className="pr-10 font-mono text-xs"
                value={keyData?.hasApiKey && !apiKeyDirty && !showApiKey ? MASKED_SECRET : apiKey}
                onChange={(event) => { setApiKeyDirty(true); setApiKey(event.target.value); }}
                onFocus={(event) => {
                  if (keyData?.hasApiKey && !apiKeyDirty && !showApiKey) event.currentTarget.select();
                }}
                placeholder="sk-xxx"
                autoComplete="new-password"
                required={!keyData?.hasApiKey}
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                disabled={revealingApiKey}
                aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                title={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                onClick={toggleApiKeyVisibility}
              >
                {revealingApiKey ? <Loader2 className="animate-spin" /> : showApiKey ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>

          {upstreamType === 'NEW_API' && keyData ? (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <KeyRound className="h-3.5 w-3.5" />New API 查余额凭证
              </div>
              <div className="space-y-1.5">
                <Label>
                  AccessToken {keyData.hasAccessToken ? <span className="text-xs text-muted-foreground">（留空保持不变）</span> : null}
                </Label>
                <div className="relative">
                  <Input
                    type={showAccessToken ? 'text' : 'password'}
                    className="pr-10 font-mono text-xs"
                    value={keyData.hasAccessToken && !accessTokenDirty && !showAccessToken ? MASKED_SECRET : accessToken}
                    onChange={(event) => { setAccessTokenDirty(true); setAccessToken(event.target.value); }}
                    onFocus={(event) => {
                      if (keyData.hasAccessToken && !accessTokenDirty && !showAccessToken) event.currentTarget.select();
                    }}
                    placeholder="系统访问令牌"
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    disabled={revealingAccessToken}
                    aria-label={showAccessToken ? '隐藏 AccessToken' : '显示 AccessToken'}
                    title={showAccessToken ? '隐藏 AccessToken' : '显示 AccessToken'}
                    onClick={toggleAccessTokenVisibility}
                  >
                    {revealingAccessToken ? <Loader2 className="animate-spin" /> : showAccessToken ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>用户 ID</Label>
                <Input className="font-mono" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="数字 ID" />
              </div>
            </div>
          ) : null}

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>监测模型</Label>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={loadModels} disabled={loadingModels}>
                  <RefreshCw data-icon="inline-start" className={loadingModels ? 'animate-spin' : undefined} />
                  {loadingModels ? '读取中…' : '读取模型'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setModels((current) => [...current, createEmptyGroupModel()])}>
                  <Plus data-icon="inline-start" />添加模型
                </Button>
              </div>
            </div>
            <datalist id="detail-available-models">
              {availableModels.map((model) => <option key={model} value={model} />)}
            </datalist>
            <div className="space-y-2">
              {models.map((model) => (
                <div key={model.clientId} className="grid gap-2 rounded-md bg-muted/30 p-2 sm:grid-cols-[minmax(160px,1fr)_110px_110px_auto_auto] sm:items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">模型名称</Label>
                    <Input list="detail-available-models" value={model.modelName} onChange={(event) => updateModelName(model.clientId, event.target.value)} placeholder="gpt-5.6-sol" required={model.enabled} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">官方输入价</Label>
                    <Input type="number" min="0" step="any" value={model.officialInputPrice} onChange={(event) => updateModel(model.clientId, { officialInputPrice: event.target.value })} placeholder="USD / 1M" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">官方输出价</Label>
                    <Input type="number" min="0" step="any" value={model.officialOutputPrice} onChange={(event) => updateModel(model.clientId, { officialOutputPrice: event.target.value })} placeholder="USD / 1M" />
                  </div>
                  <div className="flex h-9 items-center gap-2">
                    <Switch checked={model.enabled} onCheckedChange={(enabled) => updateModel(model.clientId, { enabled })} aria-label={`监测 ${model.modelName || '模型'}`} />
                    <span className="text-xs">监测</span>
                  </div>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive"
                    aria-label="移除模型"
                    title="移除模型"
                    disabled={models.length === 1}
                    onClick={() => setModels((current) => current.filter((item) => item.clientId !== model.clientId))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" size="sm" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
              {saving ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
    </>
  );

  if (embedded) return content;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        {content}
      </DialogContent>
    </Dialog>
  );
}
