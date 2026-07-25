'use client';

import { useMemo, useState } from 'react';
import { AudioLines, Database, ExternalLink, FileText, Image as ImageIcon, Search, Type, Video } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MODEL_CATALOG_USD_TO_CNY_RATE, MODEL_PROVIDERS, OFFICIAL_MODEL_CATALOG, convertCatalogPrice, filterOfficialModelCatalog, type CatalogCurrency, type ModelProvider, type OfficialModelPrice } from '@/lib/official-model-prices';
import { MODEL_CATALOG_METADATA } from '@/lib/model-catalog-metadata';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ALL_PROVIDERS = 'ALL';

export default function ModelsPage() {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState<typeof ALL_PROVIDERS | ModelProvider>(ALL_PROVIDERS);
  const [currency, setCurrency] = useState<CatalogCurrency>('USD');
  const models = useMemo(() => (
    filterOfficialModelCatalog(OFFICIAL_MODEL_CATALOG, query, provider).sort((left, right) => {
      const leftDate = MODEL_CATALOG_METADATA[left.provider + ':' + left.id]?.releaseDate || '';
      const rightDate = MODEL_CATALOG_METADATA[right.provider + ':' + right.id]?.releaseDate || '';
      return rightDate.localeCompare(leftDate) || left.id.localeCompare(right.id);
    })
  ), [provider, query]);
  const verifiedAt = OFFICIAL_MODEL_CATALOG.reduce((latest, model) => model.verifiedAt > latest ? model.verifiedAt : latest, '');

  return <div className="space-y-6">
    <PageHeader icon={Database} title="模型资料库" description="参考 models.dev 的能力矩阵布局，统一比较模型能力、上下文和官方价格。" />
    <Card className="border-primary/20 bg-primary/[0.03]"><CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{currency} / 100 万 Token</Badge><span>最近核验：{formatDate(verifiedAt)}</span></div>
      <p>{currency === 'CNY' ? `人民币为按固定参考汇率 1 USD = ${MODEL_CATALOG_USD_TO_CNY_RATE.toFixed(2)} CNY 换算的估算值。` : '价格为厂商官方标准或基础档；长上下文等特殊档位见官方资料。'} “—”表示厂商未公布或尚未完成核验。</p>
    </CardContent></Card>
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1 sm:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索模型名称" aria-label="搜索模型名称" className="pl-9" /></div>
      <Select value={provider} onValueChange={(value) => setProvider(value as typeof provider)}><SelectTrigger className="w-full sm:w-48" aria-label="按厂商筛选"><SelectValue placeholder="全部厂商" /></SelectTrigger><SelectContent><SelectItem value={ALL_PROVIDERS}>全部厂商</SelectItem>{MODEL_PROVIDERS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
      <Select value={currency} onValueChange={(value) => setCurrency(value as CatalogCurrency)}><SelectTrigger className="w-full sm:w-40" aria-label="价格币种"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">美元（USD）</SelectItem><SelectItem value="CNY">人民币（CNY）</SelectItem></SelectContent></Select>
    </div>
    <Card><CardContent className="p-0">
      <div className="border-b px-4 py-3 text-sm text-muted-foreground">共 {models.length} 个模型 · 表格可横向滚动查看更多能力字段</div>
      {models.length > 0 ? <Table className="min-w-[1180px]"><TableHeader><TableRow>
        <TableHead className="w-[280px] pl-4">模型</TableHead><TableHead className="w-[130px]">厂商</TableHead><TableHead>上下文</TableHead><TableHead>输出</TableHead><TableHead>输入</TableHead><TableHead>权重</TableHead><TableHead>价格</TableHead><TableHead className="pr-4">发布时间</TableHead>
      </TableRow></TableHeader><TableBody>{models.map((model) => <ModelRow key={model.id} model={model} currency={currency} />)}</TableBody></Table> : <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground"><Search className="size-7 opacity-50" /><p>没有找到符合条件的模型</p><button type="button" className="text-sm text-primary hover:underline" onClick={() => { setQuery(''); setProvider(ALL_PROVIDERS); }}>清除筛选</button></div>}
    </CardContent></Card>
  </div>;
}

function ModelRow({ model, currency }: { model: OfficialModelPrice; currency: CatalogCurrency }) {
  const input = convertCatalogPrice(model.input, currency); const output = convertCatalogPrice(model.output, currency);
  const metadata = MODEL_CATALOG_METADATA[model.provider + ':' + model.id];
  return <TableRow><TableCell className="pl-4"><a href={model.officialUrl} target="_blank" rel="noreferrer" className="font-medium hover:text-primary hover:underline">{model.id}</a><div className="mt-0.5 font-mono text-xs text-muted-foreground">{model.provider.toLowerCase().replaceAll(' ', '-')}/{model.id}</div></TableCell><TableCell className="font-medium">{model.provider}</TableCell><TableCell className="tabular-nums">{formatTokens(model.contextWindow)}</TableCell><TableCell className="tabular-nums">{formatTokens(model.maxOutput)}</TableCell><TableCell><InputIcons modalities={metadata?.input || []} /></TableCell><TableCell>{metadata?.weights || '—'}</TableCell><TableCell className="whitespace-nowrap font-medium tabular-nums">{input == null || output == null ? '—' : `${currency === 'USD' ? '$' : '¥'}${formatNumber(input)} / ${currency === 'USD' ? '$' : '¥'}${formatNumber(output)}`}<div className="mt-0.5 text-xs font-normal text-muted-foreground">入 / 出</div>{model.note ? <div className="mt-1 max-w-56 whitespace-normal text-xs font-normal text-muted-foreground">{model.note}</div> : null}</TableCell><TableCell className="pr-4"><div>{formatDate(metadata?.releaseDate || '')}</div><a href={model.officialUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">官方资料 <ExternalLink className="size-3" /></a></TableCell></TableRow>;
}
function InputIcons({ modalities }: { modalities: string[] }) {
  if (!modalities.length) return <span className="text-muted-foreground">—</span>;
  const icons = { text: Type, image: ImageIcon, pdf: FileText, audio: AudioLines, video: Video } as const;
  const labels = { text: '文本', image: '图片', pdf: '文件', audio: '音频', video: '视频' } as const;
  return <div className="flex gap-1">{modalities.map((modality) => {
    const Icon = icons[modality as keyof typeof icons];
    if (!Icon) return null;
    return <span key={modality} title={labels[modality as keyof typeof labels]} className="flex size-8 items-center justify-center rounded border bg-muted/30 text-muted-foreground"><Icon className="size-4" /></span>;
  })}</div>;
}
function formatNumber(value: number) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(value); }
function formatTokens(value: number | null) { return value == null ? '—' : new Intl.NumberFormat('en-US').format(value); }
function formatDate(value: string) { if (!value) return '—'; return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)); }
