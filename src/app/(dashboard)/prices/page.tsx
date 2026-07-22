'use client';

import { useCallback, useEffect, useState } from 'react';
import { CircleDollarSign, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type KeyOption = { id: number; group: string; groupName: string | null; label: string | null };
type UpstreamOption = { id: number; name: string; keys: KeyOption[] };
type Price = {
  id: number; upstreamId: number; upstreamKeyId: number | null; modelName: string; currency: string;
  inputPrice: number | null; outputPrice: number | null; cacheReadPrice: number | null; cacheWritePrice: number | null;
  fixedPrice: number | null; source: string; recordedAt: string;
  upstream: { name: string }; upstreamKey: KeyOption | null;
};

export default function PricesPage() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [upstreams, setUpstreams] = useState<UpstreamOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const load = useCallback(async () => {
    const [priceRes, upstreamRes] = await Promise.all([fetch('/api/prices'), fetch('/api/upstreams?pageSize=100')]);
    if (priceRes.ok) setPrices(await priceRes.json());
    if (upstreamRes.ok) setUpstreams((await upstreamRes.json()).items || []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/prices/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '同步失败');
      toast.success(`已同步 ${data.synced} 条价格${data.errors?.length ? `，${data.errors.length} 个分组失败` : ''}`);
      await load();
    } catch (error) { toast.error((error as Error).message); }
    finally { setSyncing(false); }
  }

  return <div className="space-y-6">
    <PageHeader icon={CircleDollarSign} title="模型价格" actions={<div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={sync} disabled={syncing}><RefreshCw className={syncing ? 'animate-spin' : ''} />同步 New API</Button>
      <Button size="sm" onClick={() => setShowForm(true)}><Plus />录入价格</Button>
    </div>} />
    <div className="overflow-x-auto border-y">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>
          {['站点 / 分组','模型','输入 / 1M','输出 / 1M','缓存读取','缓存写入','来源','更新时间'].map((label) => <th key={label} className="px-3 py-3 text-left font-medium">{label}</th>)}
        </tr></thead>
        <tbody>{prices.map((price) => <tr key={price.id} className="border-t">
          <td className="px-3 py-3"><div className="font-medium">{price.upstream.name}</div><div className="text-xs text-muted-foreground">{price.upstreamKey?.group || '全站'}</div>{price.upstreamKey?.label && price.upstreamKey.label !== price.upstreamKey.group ? <div className="text-xs text-muted-foreground">备注：{price.upstreamKey.label}</div> : null}</td>
          <td className="px-3 py-3 font-mono text-xs">{price.modelName}</td>
          <PriceCell value={price.inputPrice} currency={price.currency} />
          <PriceCell value={price.outputPrice} currency={price.currency} />
          <PriceCell value={price.cacheReadPrice} currency={price.currency} />
          <PriceCell value={price.cacheWritePrice} currency={price.currency} />
          <td className="px-3 py-3">{priceSourceLabel(price.source)}</td>
          <td className="px-3 py-3 text-muted-foreground">{new Date(price.recordedAt).toLocaleString('zh-CN')}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {prices.length === 0 && <div className="py-16 text-center text-sm text-muted-foreground">暂无价格数据。可自动同步 New API，其他站点使用手工录入。</div>}
    {showForm && <PriceForm upstreams={upstreams} onClose={() => setShowForm(false)} onSaved={async () => { setShowForm(false); await load(); }} />}
  </div>;
}

function PriceCell({ value, currency }: { value: number | null; currency: string }) {
  return <td className="px-3 py-3 tabular-nums">{value == null ? '—' : `${currency === 'CNY' ? '¥' : '$'}${value.toFixed(4)}`}</td>;
}

function priceSourceLabel(source: string) {
  const labels: Record<string, string> = { AUTO: '接口同步', MEASURED: '实测', MANUAL: '手工' };
  return labels[source] || source;
}

function PriceForm({ upstreams, onClose, onSaved }: { upstreams: UpstreamOption[]; onClose: () => void; onSaved: () => void }) {
  const [upstreamId, setUpstreamId] = useState('');
  const [keyId, setKeyId] = useState('none');
  const [modelName, setModelName] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [values, setValues] = useState({ inputPrice: '', outputPrice: '', cacheReadPrice: '', cacheWritePrice: '' });
  const keys = upstreams.find((item) => String(item.id) === upstreamId)?.keys || [];
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch('/api/prices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upstreamId, upstreamKeyId: keyId === 'none' ? null : keyId, modelName, currency, ...values }) });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || '保存失败');
    toast.success('价格已保存'); onSaved();
  }
  return <Dialog open onOpenChange={onClose}><DialogContent><DialogHeader><DialogTitle>录入模型价格</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>站点</Label><Select value={upstreamId} onValueChange={(value) => { setUpstreamId(value); setKeyId('none'); }}><SelectTrigger><SelectValue placeholder="选择站点" /></SelectTrigger><SelectContent>{upstreams.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label>分组</Label><Select value={keyId} onValueChange={setKeyId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">全站</SelectItem>{keys.map((key) => <SelectItem key={key.id} value={String(key.id)}>{key.group}</SelectItem>)}</SelectContent></Select></div></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_110px]"><div className="space-y-1.5"><Label>模型</Label><Input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="gpt-5.6-sol" required /></div><div className="space-y-1.5"><Label>币种</Label><Select value={currency} onValueChange={setCurrency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CNY">CNY</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div></div>
      <div className="grid grid-cols-2 gap-3">{Object.entries({ inputPrice: '输入 / 1M', outputPrice: '输出 / 1M', cacheReadPrice: '缓存读取 / 1M', cacheWritePrice: '缓存写入 / 1M' }).map(([key,label]) => <div key={key} className="space-y-1.5"><Label>{label}</Label><Input type="number" min="0" step="any" value={values[key as keyof typeof values]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} /></div>)}</div>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>取消</Button><Button type="submit" disabled={!upstreamId || !modelName}>保存</Button></DialogFooter>
    </form></DialogContent></Dialog>;
}
