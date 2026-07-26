'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, AudioLines, Database, FileText, Image as ImageIcon, Search, Type, Video } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MODEL_CATALOG_USD_TO_CNY_RATE, MODEL_PROVIDERS, MODEL_PROVIDER_OFFICIAL_URLS, OFFICIAL_MODEL_CATALOG, convertCatalogPrice, getCatalogPriceTiers, type CatalogCurrency, type CatalogPriceTier, type ModelProvider, type OfficialModelPrice } from '@/lib/official-model-prices';
import { MODEL_CATALOG_MODELS, type ModelCatalogModel } from '@/lib/model-catalog-metadata';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const ALL_PROVIDERS = 'ALL';
interface CatalogDisplayModel extends ModelCatalogModel {
  price: OfficialModelPrice | null;
  officialUrl: string;
}

type SortKey = 'name' | 'provider' | 'contextWindow' | 'maxOutput' | 'price' | 'releaseDate';
type SortDirection = 'asc' | 'desc';

const DEFAULT_SORT_DIRECTION: Readonly<Record<SortKey, SortDirection>> = {
  name: 'asc',
  provider: 'asc',
  contextWindow: 'desc',
  maxOutput: 'desc',
  price: 'desc',
  releaseDate: 'desc',
};

function catalogPriceKey(provider: ModelProvider, id: string) {
  return `${provider}:${id.toLowerCase().replace(/[._-]/g, '')}`;
}

const OFFICIAL_PRICE_BY_MODEL = new Map(
  OFFICIAL_MODEL_CATALOG.map((model) => [catalogPriceKey(model.provider, model.id), model]),
);

function getCatalogDisplayModels(): CatalogDisplayModel[] {
  return MODEL_CATALOG_MODELS.map((model) => {
    const priceId = model.priceId ?? model.id;
    const price = OFFICIAL_PRICE_BY_MODEL.get(catalogPriceKey(model.provider, priceId)) ?? null;
    return {
      ...model,
      price,
      officialUrl: price?.officialUrl ?? MODEL_PROVIDER_OFFICIAL_URLS[model.provider],
    };
  });
}

const CATALOG_DISPLAY_MODELS = getCatalogDisplayModels();

function getDisplayInputPrice(model: CatalogDisplayModel, currency: CatalogCurrency) {
  return convertCatalogPrice(model.price?.input ?? null, currency, model.price?.cnyInput ?? null);
}

function compareNullable<T>(left: T | null, right: T | null, direction: SortDirection, compare: (a: T, b: T) => number) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  const result = compare(left, right);
  return direction === 'asc' ? result : -result;
}

export default function ModelsPage() {
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState<typeof ALL_PROVIDERS | ModelProvider>(ALL_PROVIDERS);
  const [currency, setCurrency] = useState<CatalogCurrency>('USD');
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'releaseDate', direction: 'desc' });
  const models = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filteredModels = CATALOG_DISPLAY_MODELS.filter((model) => (
      (provider === ALL_PROVIDERS || model.provider === provider)
      && (!normalizedQuery || model.id.toLowerCase().includes(normalizedQuery) || model.name.toLowerCase().includes(normalizedQuery))
    ));
    return filteredModels.sort((left, right) => {
      let result = 0;
      if (sort.key === 'name') result = compareNullable(left.name, right.name, sort.direction, (a, b) => a.localeCompare(b));
      if (sort.key === 'provider') result = compareNullable(left.provider, right.provider, sort.direction, (a, b) => a.localeCompare(b));
      if (sort.key === 'contextWindow') result = compareNullable(left.contextWindow, right.contextWindow, sort.direction, (a, b) => a - b);
      if (sort.key === 'maxOutput') result = compareNullable(left.maxOutput, right.maxOutput, sort.direction, (a, b) => a - b);
      if (sort.key === 'price') result = compareNullable(getDisplayInputPrice(left, currency), getDisplayInputPrice(right, currency), sort.direction, (a, b) => a - b);
      if (sort.key === 'releaseDate') result = compareNullable(left.releaseDate, right.releaseDate, sort.direction, (a, b) => a.localeCompare(b));
      return result || left.id.localeCompare(right.id);
    });
  }, [currency, provider, query, sort]);
  const changeSort = (key: SortKey) => setSort((current) => ({
    key,
    direction: current.key === key
      ? (current.direction === 'asc' ? 'desc' : 'asc')
      : DEFAULT_SORT_DIRECTION[key],
  }));
  const verifiedAt = OFFICIAL_MODEL_CATALOG.reduce((latest, model) => model.verifiedAt > latest ? model.verifiedAt : latest, '');

  return <div className="space-y-6">
    <PageHeader icon={Database} title="模型数据" description="汇总主流厂商的通用大语言模型，比较输入能力、上下文、官方价格与发布时间。" />
    <Card className="border-primary/20 bg-primary/[0.03]"><CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">近 6 个月发布</Badge><Badge variant="outline">{currency} / 100 万 Token</Badge><span>价格最近核验：{formatDate(verifiedAt)}</span></div>
      <p>{currency === 'CNY' ? `人民币优先显示厂商官方人民币价格；未公布人民币价的模型按 1 USD = ${MODEL_CATALOG_USD_TO_CNY_RATE.toFixed(2)} CNY 估算。` : '美元价格采用厂商官方美元计价，长上下文等特殊档位列在价格下方。'} “—”表示尚未找到厂商公开的同名 API 计价，或仍在核验中。</p>
    </CardContent></Card>
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1 sm:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索模型名称" aria-label="搜索模型名称" className="pl-9" /></div>
      <Select value={provider} onValueChange={(value) => setProvider(value as typeof provider)}><SelectTrigger className="w-full sm:w-48" aria-label="按厂商筛选"><SelectValue placeholder="全部厂商" /></SelectTrigger><SelectContent className="max-h-[14.5rem]" showScrollButtons={false} showScrollbar><SelectItem value={ALL_PROVIDERS}>全部厂商</SelectItem>{MODEL_PROVIDERS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
      <Select value={currency} onValueChange={(value) => setCurrency(value as CatalogCurrency)}><SelectTrigger className="w-full sm:w-40" aria-label="价格币种"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">美元（USD）</SelectItem><SelectItem value="CNY">人民币（CNY）</SelectItem></SelectContent></Select>
    </div>
    <Card><CardContent className="p-0">
      <div className="border-b px-4 py-3 text-sm text-muted-foreground">共 {models.length} 个模型</div>
      {models.length > 0 ? <Table className="min-w-[1120px]"><TableHeader><TableRow>
        <SortableHead className="w-[300px] pl-4" label="模型" sortKey="name" sort={sort} onSort={changeSort} />
        <SortableHead className="w-[130px]" label="厂商" sortKey="provider" sort={sort} onSort={changeSort} />
        <SortableHead label="上下文" sortKey="contextWindow" sort={sort} onSort={changeSort} />
        <SortableHead label="输出" sortKey="maxOutput" sort={sort} onSort={changeSort} />
        <TableHead>输入</TableHead>
        <SortableHead label="价格" sortKey="price" sort={sort} onSort={changeSort} />
        <SortableHead className="pr-4" label="发布时间" sortKey="releaseDate" sort={sort} onSort={changeSort} />
      </TableRow></TableHeader><TableBody>{models.map((model) => <ModelRow key={`${model.provider}:${model.id}`} model={model} currency={currency} />)}</TableBody></Table> : <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground"><Search className="size-7 opacity-50" /><p>没有找到符合条件的模型</p><button type="button" className="text-sm text-primary hover:underline" onClick={() => { setQuery(''); setProvider(ALL_PROVIDERS); }}>清除筛选</button></div>}
    </CardContent></Card>
  </div>;
}

function ModelRow({ model, currency }: { model: CatalogDisplayModel; currency: CatalogCurrency }) {
  const input = getDisplayInputPrice(model, currency);
  const output = convertCatalogPrice(model.price?.output ?? null, currency, model.price?.cnyOutput ?? null);
  const tiers = model.price ? getCatalogPriceTiers(model.price, currency) : [];
  const note = tiers.length > 0
    ? tiers.map((tier) => formatPriceTier(tier, currency)).join('；')
    : (currency === 'CNY' && model.price?.cnyNote ? model.price.cnyNote : model.price?.note);
  return <TableRow><TableCell className="pl-4"><a href={model.officialUrl} target="_blank" rel="noreferrer" className="font-medium hover:text-primary hover:underline">{model.name}</a><div className="mt-0.5 font-mono text-xs text-muted-foreground">{model.sourceProvider}/{model.id}</div></TableCell><TableCell className="font-medium">{model.provider}</TableCell><TableCell className="tabular-nums">{formatTokens(model.contextWindow)}</TableCell><TableCell className="tabular-nums">{formatTokens(model.maxOutput)}</TableCell><TableCell><InputIcons modalities={model.input} /></TableCell><TableCell className="whitespace-nowrap font-medium tabular-nums">{input == null || output == null ? '—' : `${currency === 'USD' ? '$' : '¥'}${formatNumber(input)} / ${currency === 'USD' ? '$' : '¥'}${formatNumber(output)}`}{note ? <div className="mt-1 max-w-64 whitespace-normal text-xs font-normal text-muted-foreground">{note}</div> : null}</TableCell><TableCell className="pr-4">{formatDate(model.releaseDate)}</TableCell></TableRow>;
}

function SortableHead({ className, label, sortKey, sort, onSort }: { className?: string; label: string; sortKey: SortKey; sort: { key: SortKey; direction: SortDirection }; onSort: (key: SortKey) => void }) {
  const active = sort.key === sortKey;
  const Icon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return <TableHead className={className} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => onSort(sortKey)} className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span>{label}</span><Icon className={active ? 'size-3.5 text-foreground' : 'size-3.5 opacity-55'} /></button></TableHead>;
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
function formatPriceTier(tier: CatalogPriceTier, currency: CatalogCurrency) {
  const symbol = currency === 'USD' ? '$' : '¥';
  const input = tier.input == null ? '—' : `${symbol}${formatNumber(tier.input)}`;
  const output = tier.output == null ? '—' : `${symbol}${formatNumber(tier.output)}`;
  const cacheRead = tier.cacheRead == null ? '' : `，缓存读取 ${symbol}${formatNumber(tier.cacheRead)}`;
  const cacheWrite = tier.cacheWrite == null ? '' : `，缓存写入 ${symbol}${formatNumber(tier.cacheWrite)}`;
  return `${tier.label}：${input} / ${output}${cacheRead}${cacheWrite}`;
}
