export interface CostSummaryRecord {
  upstreamId: number;
  upstreamName: string;
  upstreamKeyId: number;
  group: string;
  groupLabel: string | null;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsdCredit: number | null;
  costCny: number | null;
  source: string;
  completeness: string;
  estimated: boolean;
  occurredAt: Date;
}

export interface SiteCostSummaryRecord {
  upstreamId: number;
  upstreamName: string;
  costUsdCredit: number;
  costCny: number;
  occurredAt: Date;
}

export type CostTrendGranularity = '15m' | '6h' | 'day' | 'week' | 'month';

interface SiteCostSummaryOptions {
  from: Date;
  to: Date;
  granularity?: CostTrendGranularity;
}

const FIXED_INTERVALS: Partial<Record<CostTrendGranularity, number>> = {
  '15m': 15 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
};

export function chooseCostTrendGranularity(from: Date, to: Date): CostTrendGranularity {
  const duration = Math.max(0, to.getTime() - from.getTime());
  if (duration <= 2 * 24 * 60 * 60 * 1000) return '15m';
  if (duration <= 14 * 24 * 60 * 60 * 1000) return '6h';
  if (duration <= 90 * 24 * 60 * 60 * 1000) return 'day';
  if (duration <= 2 * 365 * 24 * 60 * 60 * 1000) return 'week';
  return 'month';
}

export function summarizeSiteCostRecords(
  records: SiteCostSummaryRecord[],
  timezoneOffsetMinutes: number,
  options?: SiteCostSummaryOptions,
) {
  const total = { costCny: 0, costUsdCredit: 0 };
  const granularity = options?.granularity
    || chooseCostTrendGranularity(
      options?.from || records[0]?.occurredAt || new Date(),
      options?.to || records.at(-1)?.occurredAt || new Date(),
    );
  const buckets = new Map<number, { costCny: number; costUsdCredit: number }>();
  const sites = new Map<number, {
    upstreamId: number;
    upstreamName: string;
    costCny: number;
    costUsdCredit: number;
  }>();
  for (const record of records) {
    total.costCny += record.costCny;
    total.costUsdCredit += record.costUsdCredit;
    const bucket = trendBucketStart(record.occurredAt, timezoneOffsetMinutes, granularity);
    const bucketValue = buckets.get(bucket) || { costCny: 0, costUsdCredit: 0 };
    bucketValue.costCny += record.costCny;
    bucketValue.costUsdCredit += record.costUsdCredit;
    buckets.set(bucket, bucketValue);
    const site = sites.get(record.upstreamId) || {
      upstreamId: record.upstreamId,
      upstreamName: record.upstreamName,
      costCny: 0,
      costUsdCredit: 0,
    };
    site.costCny += record.costCny;
    site.costUsdCredit += record.costUsdCredit;
    sites.set(record.upstreamId, site);
  }
  if (options && records.length > 0) {
    const firstBucket = trendBucketStart(options.from, timezoneOffsetMinutes, granularity);
    const lastBucket = trendBucketStart(
      new Date(Math.max(options.from.getTime(), options.to.getTime() - 1)),
      timezoneOffsetMinutes,
      granularity,
    );
    for (
      let bucket = firstBucket;
      bucket <= lastBucket;
      bucket = nextTrendBucket(bucket, timezoneOffsetMinutes, granularity)
    ) {
      if (!buckets.has(bucket)) buckets.set(bucket, { costCny: 0, costUsdCredit: 0 });
    }
  }
  return {
    totals: {
      costCny: roundMoney(total.costCny),
      costUsdCredit: roundMoney(total.costUsdCredit),
    },
    trendGranularity: granularity,
    trend: Array.from(buckets, ([bucketStart, value]) => ({
      bucketStart: new Date(bucketStart).toISOString(),
      costCny: roundMoney(value.costCny),
      costUsdCredit: roundMoney(value.costUsdCredit),
    })).sort((a, b) => a.bucketStart.localeCompare(b.bucketStart)),
    sites: Array.from(sites.values())
      .map((site) => ({
        ...site,
        costCny: roundMoney(site.costCny),
        costUsdCredit: roundMoney(site.costUsdCredit),
      }))
      .sort((a, b) => b.costCny - a.costCny),
  };
}

function trendBucketStart(
  date: Date,
  timezoneOffsetMinutes: number,
  granularity: CostTrendGranularity,
) {
  const shifted = date.getTime() - timezoneOffsetMinutes * 60000;
  if (granularity === 'month') {
    const local = new Date(shifted);
    return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1)
      + timezoneOffsetMinutes * 60000;
  }
  if (granularity === 'week') {
    const local = new Date(shifted);
    const dayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    const daysSinceMonday = (local.getUTCDay() + 6) % 7;
    return dayStart - daysSinceMonday * FIXED_INTERVALS.day!
      + timezoneOffsetMinutes * 60000;
  }
  const interval = FIXED_INTERVALS[granularity]!;
  return Math.floor(shifted / interval) * interval + timezoneOffsetMinutes * 60000;
}

function nextTrendBucket(
  bucketStart: number,
  timezoneOffsetMinutes: number,
  granularity: CostTrendGranularity,
) {
  if (granularity !== 'month') return bucketStart + FIXED_INTERVALS[granularity]!;
  const shifted = new Date(bucketStart - timezoneOffsetMinutes * 60000);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1)
    + timezoneOffsetMinutes * 60000;
}

interface CostTotals {
  costCny: number;
  costUsdCredit: number;
  totalTokens: number;
  unpricedTokens: number;
  estimatedRecords: number;
}

export function summarizeCostRecords(records: CostSummaryRecord[], timezoneOffsetMinutes: number) {
  const total = emptyTotals();
  const days = new Map<string, CostTotals>();
  const sites = new Map<number, ReturnType<typeof createSite>>();
  const sources = new Map<string, { source: string; costCny: number; records: number }>();

  for (const record of records) {
    addRecord(total, record);
    const day = localDateKey(record.occurredAt, timezoneOffsetMinutes);
    const dayTotals = days.get(day) || emptyTotals();
    addRecord(dayTotals, record);
    days.set(day, dayTotals);

    const site = sites.get(record.upstreamId)
      || createSite(record.upstreamId, record.upstreamName);
    addRecord(site, record);
    const group = site.groupsMap.get(record.upstreamKeyId)
      || createGroup(record.upstreamKeyId, record.group, record.groupLabel);
    addRecord(group, record);
    const model = group.modelsMap.get(record.modelName)
      || createModel(record.modelName);
    addRecord(model, record);
    group.modelsMap.set(record.modelName, model);
    site.groupsMap.set(record.upstreamKeyId, group);
    sites.set(record.upstreamId, site);

    const source = sources.get(record.source)
      || { source: record.source, costCny: 0, records: 0 };
    source.costCny += record.costCny || 0;
    source.records += 1;
    sources.set(record.source, source);
  }

  const breakdown = Array.from(sites.values()).map((site) => ({
    ...withoutMap(site, 'groupsMap'),
    groups: Array.from(site.groupsMap.values()).map((group) => ({
      ...withoutMap(group, 'modelsMap'),
      models: Array.from(group.modelsMap.values())
        .sort((a, b) => b.costCny - a.costCny || a.modelName.localeCompare(b.modelName)),
    })).sort((a, b) => b.costCny - a.costCny),
  })).sort((a, b) => b.costCny - a.costCny);

  return {
    totals: roundTotals(total),
    trend: Array.from(days, ([date, values]) => ({ date, ...roundTotals(values) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    breakdown,
    sources: Array.from(sources.values())
      .map((source) => ({ ...source, costCny: roundMoney(source.costCny) }))
      .sort((a, b) => b.costCny - a.costCny),
  };
}

export function localRangeBoundaries(now: Date, timezoneOffsetMinutes: number) {
  const shifted = new Date(now.getTime() - timezoneOffsetMinutes * 60000);
  const today = new Date(Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  ) + timezoneOffsetMinutes * 60000);
  const month = new Date(Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    1,
  ) + timezoneOffsetMinutes * 60000);
  return { today, month };
}

function localDateKey(date: Date, timezoneOffsetMinutes: number) {
  return new Date(date.getTime() - timezoneOffsetMinutes * 60000)
    .toISOString()
    .slice(0, 10);
}

function emptyTotals(): CostTotals {
  return { costCny: 0, costUsdCredit: 0, totalTokens: 0, unpricedTokens: 0, estimatedRecords: 0 };
}

function addRecord(target: CostTotals, record: CostSummaryRecord) {
  const tokens = record.inputTokens + record.outputTokens
    + record.cacheReadTokens + record.cacheWriteTokens;
  target.costCny += record.costCny || 0;
  target.costUsdCredit += record.costUsdCredit || 0;
  target.totalTokens += tokens;
  if (record.costCny == null) target.unpricedTokens += tokens;
  if (record.estimated) target.estimatedRecords += 1;
}

function createSite(upstreamId: number, upstreamName: string) {
  return {
    upstreamId,
    upstreamName,
    ...emptyTotals(),
    groupsMap: new Map<number, ReturnType<typeof createGroup>>(),
  };
}

function createGroup(upstreamKeyId: number, group: string, groupLabel: string | null) {
  return {
    upstreamKeyId,
    group,
    groupLabel,
    ...emptyTotals(),
    modelsMap: new Map<string, ReturnType<typeof createModel>>(),
  };
}

function createModel(modelName: string) {
  return { modelName, ...emptyTotals() };
}

function roundTotals<T extends CostTotals>(totals: T) {
  return {
    ...totals,
    costCny: roundMoney(totals.costCny),
    costUsdCredit: roundMoney(totals.costUsdCredit),
  };
}

function roundMoney(value: number) {
  return Math.round(value * 1e8) / 1e8;
}

function withoutMap<T extends Record<string, unknown>, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const clone = { ...value };
  delete clone[key];
  return clone;
}
