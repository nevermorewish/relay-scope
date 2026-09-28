'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { AddUpstreamGroupDialog } from '@/components/add-upstream-group-dialog';
import { UpstreamKeyManager } from '@/components/upstream-key-manager';
import type { UpstreamKeyRow } from '@/components/upstreams-columns';

export interface EditableUpstream {
  id: number;
  name: string;
  baseUrl: string;
  type: string;
  enabled: boolean;
  creditUsdPerCny: number;
}

export function EditUpstreamDialog({
  upstream,
  onClose,
  onSaved,
}: {
  upstream: EditableUpstream;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(upstream.name);
  const [baseUrl, setBaseUrl] = useState(upstream.baseUrl);
  const [creditUsdPerCny, setCreditUsdPerCny] = useState(String(upstream.creditUsdPerCny || 1));
  const [enabled, setEnabled] = useState(upstream.enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [apiKeys, setApiKeys] = useState<Record<number, string>>({});
  const [keyEditor, setKeyEditor] = useState<UpstreamKeyRow | null | undefined>(undefined);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const response = await fetch(`/api/upstreams/${upstream.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          baseUrl,
          enabled,
          creditUsdPerCny: Number(creditUsdPerCny),
          apiKeys: Object.entries(apiKeys)
            .filter(([, apiKey]) => apiKey.trim())
            .map(([keyId, apiKey]) => ({ keyId: Number(keyId), apiKey: apiKey.trim() })),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || '保存失败');
      toast.success('上游已更新');
      await onSaved();
    } catch (saveError) {
      setError('保存失败: ' + (saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        {keyEditor !== undefined ? (
          <AddUpstreamGroupDialog
            embedded
            upstreamId={upstream.id}
            upstreamType={upstream.type}
            baseUrl={baseUrl}
            keyData={keyEditor}
            onClose={onClose}
            onSaved={onSaved}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>编辑上游 - {upstream.name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <fieldset disabled={saving} className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-upstream-name">名称</Label>
                    <Input
                      id="edit-upstream-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="如：聪明AI"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-upstream-url">地址</Label>
                    <Input
                      id="edit-upstream-url"
                      value={baseUrl}
                      onChange={(event) => setBaseUrl(event.target.value)}
                      placeholder="relay.example.com"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-upstream-rate">每 1 元人民币获得的美元额度</Label>
                    <Input
                      id="edit-upstream-rate"
                      type="number"
                      min="0.000001"
                      step="any"
                      value={creditUsdPerCny}
                      onChange={(event) => setCreditUsdPerCny(event.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">例如 ¥1 到账 $1 填 1，¥1 到账 $10 填 10</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={enabled} onCheckedChange={setEnabled} id="edit-upstream-enabled" />
                  <Label htmlFor="edit-upstream-enabled">参与自动监测</Label>
                </div>
                <Separator />
                <UpstreamKeyManager
                  upstreamId={upstream.id}
                  type={upstream.type}
                  onEditKey={setKeyEditor}
                  apiKeys={apiKeys}
                  onApiKeyChange={(keyId, apiKey) => setApiKeys((current) => ({ ...current, [keyId]: apiKey }))}
                  managementDisabled={Object.values(apiKeys).some((apiKey) => Boolean(apiKey.trim()))
                    || name !== upstream.name || baseUrl !== upstream.baseUrl
                    || enabled !== upstream.enabled || Number(creditUsdPerCny) !== upstream.creditUsdPerCny}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <DialogFooter>
                  <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={saving}>
                    取消
                  </Button>
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving && <Loader2 className="animate-spin" data-icon="inline-start" />}
                    {saving ? '保存中…' : '保存'}
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
