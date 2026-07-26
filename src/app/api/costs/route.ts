import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  chooseCostTrendGranularity,
  localRangeBoundaries,
  summarizeSiteCostRecords,
  type SiteCostSummaryRecord,
} from '@/lib/cost-summary';
import { calculateSharedBalance, convertUsdCreditToCny } from '@/lib/upstream-query';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = clampInteger(searchParams.get('timezoneOffset'), -840, 840, 0);
  const now = new Date();
  const { last30Days, month, today } = localRangeBoundaries(now, offset);
  const from = parseDate(searchParams.get('from')) || month;
  const to = parseDate(searchParams.get('to')) || now;
  if (from >= to) {
    return NextResponse.json({ error: '时间范围无效' }, { status: 400 });
  }
  const upstreamId = positiveInteger(searchParams.get('upstreamId'));
  const upstreamWhere = upstreamId ? { upstreamId } : {};

  const [
    selectedSiteCosts,
    todaySiteCosts,
    last30DaysSiteCosts,
    upstreams,
    siteStates,
  ] = await Promise.all([
    loadSiteCosts({ ...upstreamWhere, occurredAt: { gte: from, lt: to } }),
    loadSiteCosts({ ...upstreamWhere, occurredAt: { gte: today, lt: now } }),
    loadSiteCosts({ ...upstreamWhere, occurredAt: { gte: last30Days, lt: now } }),
    prisma.upstream.findMany({
      orderBy: [{ priority: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        type: true,
        creditUsdPerCny: true,
        keys: {
          where: { enabled: true },
          select: { lastBalance: true, lastCollectedAt: true },
        },
      },
    }),
    prisma.siteCostState.findMany({
      where: upstreamId ? { upstreamId } : {},
      include: { upstream: { select: { name: true } } },
      orderBy: { upstreamId: 'asc' },
    }),
  ]);

  const selected = summarizeSiteCostRecords(selectedSiteCosts, offset);
  const trendFrom = effectiveTrendStart(from, selectedSiteCosts);
  const trendGranularity = chooseCostTrendGranularity(trendFrom, to);
  const selectedWithTrend = summarizeSiteCostRecords(selectedSiteCosts, offset, {
    from: trendFrom,
    to,
    granularity: trendGranularity,
  });
  const todaySummary = summarizeSiteCostRecords(todaySiteCosts, offset);
  const last30DaysSummary = summarizeSiteCostRecords(last30DaysSiteCosts, offset);
  const siteCostById = new Map(selected.sites.map((site) => [site.upstreamId, site]));
  const visibleUpstreams = upstreamId
    ? upstreams.filter((upstream) => upstream.id === upstreamId)
    : upstreams;
  const visibleBalances = visibleUpstreams.map((upstream) => convertUsdCreditToCny(
    calculateSharedBalance(upstream.keys),
    upstream.creditUsdPerCny,
  ));
  const currentBalanceCny = visibleBalances.some((balance) => balance != null)
    ? visibleBalances.reduce<number>((sum, balance) => sum + (balance || 0), 0)
    : null;
  const breakdown = visibleUpstreams.map((upstream) => {
    const siteCost = siteCostById.get(upstream.id) || {
      costCny: 0,
      costUsdCredit: 0,
    };
    return {
      upstreamId: upstream.id,
      upstreamName: upstream.name,
      type: upstream.type,
      costCny: siteCost.costCny,
      costUsdCredit: siteCost.costUsdCredit,
    };
  }).sort((left, right) => right.costCny - left.costCny);

  return NextResponse.json({
    range: { from: from.toISOString(), to: to.toISOString(), timezoneOffset: offset },
    summary: {
      ...selected.totals,
      todayCostCny: todaySummary.totals.costCny,
      last30DaysCostCny: last30DaysSummary.totals.costCny,
      currentBalanceCny,
    },
    trendGranularity,
    trend: selectedWithTrend.trend,
    breakdown,
    coverage: siteStates.map((state) => ({
      upstreamId: state.upstreamId,
      upstreamName: state.upstream.name,
      coverageStartedAt: state.coverageStartedAt,
      lastProcessedAt: state.lastProcessedAt,
    })),
    options: upstreams.map((upstream) => ({
      id: upstream.id,
      name: upstream.name,
      type: upstream.type,
    })),
  });
}

function effectiveTrendStart(from: Date, records: SiteCostSummaryRecord[]) {
  const overlyBroadRange = from.getUTCFullYear() < 2000;
  return overlyBroadRange && records.length > 0 ? records[0].occurredAt : from;
}

async function loadSiteCosts(where: Prisma.SiteCostRecordWhereInput) {
  const records = await prisma.siteCostRecord.findMany({
    where,
    include: { upstream: { select: { name: true } } },
    orderBy: { occurredAt: 'asc' },
  });
  return records.map((record): SiteCostSummaryRecord => ({
    upstreamId: record.upstreamId,
    upstreamName: record.upstream.name,
    costUsdCredit: record.costUsdCredit,
    costCny: record.costCny,
    occurredAt: record.occurredAt,
  }));
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function positiveInteger(value: string | null) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function clampInteger(value: string | null, min: number, max: number, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
