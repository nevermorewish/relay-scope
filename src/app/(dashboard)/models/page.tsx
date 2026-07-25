'use client';

import { useMemo, useState } from 'react';
import { AudioLines, Database, FileText, Image as ImageIcon, Search, Type, Video } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MODEL_CATALOG_USD_TO_CNY_RATE, MODEL_PROVIDERS, MODEL_PROVIDER_OFFICIAL_URLS, OFFICIAL_MODEL_CATALOG, convertCatalogPrice, type CatalogCurrency, type ModelProvider, type OfficialModelPrice } from '@/lib/official-model-prices';
import { MODEL_CATALOG_MODELS, type ModelCatalogModel } from '@/lib/model-catalog-metadata';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const ALL_PROVIDERS = 'ALL';
const PRICE_MODEL_ALIASES: Readonly<Record<string, string>> = {
  'Alibaba:qwen3.7-max': 'qwen3.7-max-2026-05-17',
  'Mistral:mistral-medium-2604': 'mistral-medium-3-5',
};

interface CatalogDisplayModel extends ModelCatalogModel {
  price: OfficialModelPrice | null;
  officialUrl: string;
}

function catalogPriceKey(provider: ModelProvider, id: string) {
  return `${provider}:${id.toLowerCase().replace(/[._-]/g, '')}`;
}

const OFFICIAL_PRICE_BY_MODEL = new Map(
  OFFICIAL_MODEL_CATALOG.map((model) => [catalogPriceKey(model.provider, model.id), model]),
);

function getCatalogDisplayModels(): CatalogDisplayModel[] {
  return MODEL_CATALOG_MODELS.map((model) => {
    const priceId = PRICE_MODEL_ALIASES[`${model.provider}:${model.id}`] ?? model.id;
    const price = OFFICIAL_PRICE_BY_MODEL.get(catalogPriceKey(model.provider, priceId)) ?? null;
    return {
      ...model,
      price,
      officialUrl: price?.officialUrl ?? MODEL_PROVIDER_OFFICIAL_URLS[model.provider],
    };
  });
}

const CATALOG_DISPLAY_MODELS = getCatalogDisplayModels();

export default function ModelsPage() {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState<typeof ALL_PROVIDERS | ModelProvider>(ALL_PROVIDERS);
  const [currency, setCurrency] = useState<CatalogCurrency>('USD');
  const models = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return CATALOG_DISPLAY_MODELS.filter((model) => (
      (provider === ALL_PROVIDERS || model.provider === provider)
      && (!normalizedQuery || model.id.toLowerCase().includes(normalizedQuery) || model.name.toLowerCase().includes(normalizedQuery))
    )).sort((left, right) => right.releaseDate.localeCompare(left.releaseDate) || left.id.localeCompare(right.id));
  }, [provider, query]);
  const verifiedAt = OFFICIAL_MODEL_CATALOG.reduce((latest, model) => model.verifiedAt > latest ? model.verifiedAt : latest, '');

  return <div className="space-y-6">
    <PageHeader icon={Database} title="模型资料库" description="汇总主流厂商的通用大语言模型，比较输入能力、上下文、官方价格与发布时间。" />
    <Card className="border-primary/20 bg-primary/[0.03]"><CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">近 6 个月发布</Badge><Badge variant="outline">{currency} / 100 万 Token</Badge><span>价格最近核验：{formatDate(verifiedAt)}</span></div>
      <p>{currency === 'CNY' ? `人民币为按固定参考汇率 1 USD = ${MODEL_CATALOG_USD_TO_CNY_RATE.toFixed(2)} CNY 换算的估算值。` : '价格为厂商官方标准或基础档，长上下文等特殊档位见官方资料。'} “—”表示尚未找到厂商公开的同名 API 计价，或仍在核验中。</p>
    </CardContent></Card>
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1 sm:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索模型名称" aria-label="搜索模型名称" className="pl-9" /></div>
      <Select value={provider} onValueChange={(value) => setProvider(value as typeof provider)}><SelectTrigger className="w-full sm:w-48" aria-label="按厂商筛选"><SelectValue placeholder="全部厂商" /></SelectTrigger><SelectContent className="max-h-[14.5rem] [&>div]:pb-2" showScrollButtons={false}><SelectItem value={ALL_PROVIDERS}>全部厂商</SelectItem>{MODEL_PROVIDERS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
      <Select value={currency} onValueChange={(value) => setCurrency(value as CatalogCurrency)}><SelectTrigger className="w-full sm:w-40" aria-label="价格币种"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">美元（USD）</SelectItem><SelectItem value="CNY">人民币（CNY）</SelectItem></SelectContent></Select>
    </div>
    <Card><CardContent className="p-0">
      <div className="border-b px-4 py-3 text-sm text-muted-foreground">共 {models.length} 个模型</div>
      {models.length > 0 ? <Table className="min-w-[1120px]"><TableHeader><TableRow>
        <TableHead className="w-[300px] pl-4">模型</TableHead><TableHead className="w-[130px]">厂商</TableHead><TableHead>上下文</TableHead><TableHead>输出</TableHead><TableHead>输入</TableHead><TableHead>价格</TableHead><TableHead className="pr-4">发布时间</TableHead>
      </TableRow></TableHeader><TableBody>{models.map((model) => <ModelRow key={`${model.provider}:${model.id}`} model={model} currency={currency} />)}</TableBody></Table> : <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground"><Search className="size-7 opacity-50" /><p>没有找到符合条件的模型</p><button type="button" className="text-sm text-primary hover:underline" onClick={() => { setQuery(''); setProvider(ALL_PROVIDERS); }}>清除筛选</button></div>}
    </CardContent></Card>
  </div>;
}

function ModelRow({ model, currency }: { model: CatalogDisplayModel; currency: CatalogCurrency }) {
  const input = convertCatalogPrice(model.price?.input ?? null, currency);
  const output = convertCatalogPrice(model.price?.output ?? null, currency);
  return <TableRow><TableCell className="pl-4"><a href={model.officialUrl} target="_blank" rel="noreferrer" className="font-medium hover:text-primary hover:underline">{model.name}</a><div className="mt-0.5 font-mono text-xs text-muted-foreground">{model.sourceProvider}/{model.id}</div></TableCell><TableCell className="font-medium">{model.provider}</TableCell><TableCell className="tabular-nums">{formatTokens(model.contextWindow)}</TableCell><TableCell className="tabular-nums">{formatTokens(model.maxOutput)}</TableCell><TableCell><InputIcons modalities={model.input} /></TableCell><TableCell className="whitespace-nowrap font-medium tabular-nums">{input == null || output == null ? '—' : `${currency === 'USD' ? '$' : '¥'}${formatNumber(input)} / ${currency === 'USD' ? '$' : '¥'}${formatNumber(output)}`}{model.price?.note ? <div className="mt-1 max-w-56 whitespace-normal text-xs font-normal text-muted-foreground">{model.price.note}</div> : null}</TableCell><TableCell className="pr-4">{formatDate(model.releaseDate)}</TableCell></TableRow>;
}

function InputIcons({ modalities }: { modalities: ReadonlyArray<string> }) {
  if (!modalities.length) return <span className="text-muted-foreground">—</span>;
  const items = [
    { id: 'text', label: '文本', icon: Type },
    { id: 'image', label: '图片', icon: ImageIcon },
    { id: 'pdf', label: 'PDF 文档', icon: FileText },
    { id: 'audio', label: '音频', icon: AudioLines },
    { id: 'video', label: '视频', icon: Video },
  ].filter((item) => modalities.includes(item.id));
  return <TooltipProvider delayDuration={120} skipDelayDuration={0}><div className="flex items-center gap-1.5">{items.map(({ id, label, icon: Icon }) => <Tooltip key={id}><TooltipTrigger asChild><span tabIndex={0} aria-label={label} className="inline-flex size-7 cursor-default items-center justify-center rounded-md border bg-muted/30 text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Icon className="size-3.5" /></span></TooltipTrigger><TooltipContent side="top" sideOffset={8} className="rounded-md border bg-background px-2 py-1 text-xs font-medium text-foreground shadow-sm">{label}</TooltipContent></Tooltip>)}</div></TooltipProvider>;
}

function formatTokens(value: number | null) { return value == null ? '—' : new Intl.NumberFormat('en-US').format(value); }
function formatNumber(value: number) { return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }
function formatDate(value: string) { if (!value) return '—'; const [year, month, day] = value.split('-'); return `${year}-${month}-${day}`; }
