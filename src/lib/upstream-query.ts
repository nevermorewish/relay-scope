import type { Prisma } from '@prisma/client';
import type { UpstreamStatus, UpstreamType } from '@/lib/domain-types';

const UPSTREAM_TYPES = ['SUB2API', 'NEW_API', 'OPENAI_COMPATIBLE'] as const satisfies readonly UpstreamType[];
const UPSTREAM_STATUSES = [
  'ONLINE',
  'DEGRADED',
  'OFFLINE',
  'UNKNOWN',
] as const satisfies readonly UpstreamStatus[];

export type UpstreamSortField =
  | 'priority'
  | 'name'
  | 'baseUrl'
  | 'type'
  | 'status'
  | 'totalBalance';
export type UpstreamSortDirection = 'asc' | 'desc';

export interface UpstreamListQuery {
  search: string | undefined;
  type: UpstreamType | undefined;
  status: UpstreamStatus | undefined;
  sort: UpstreamSortField | undefined;
  direction: UpstreamSortDirection;
}

export interface UpstreamListSearchParamsInput {
  page: number;
  pageSize: number;
  search?: string;
  type?: string;
  status?: string;
  sort?: string;
  direction?: UpstreamSortDirection;
}

const SORT_FIELDS: Record<string, UpstreamSortField> = {
  priority: 'priority',
  name: 'name',
  baseurl: 'baseUrl',
  type: 'type',
  status: 'status',
  balance: 'totalBalance',
  totalbalance: 'totalBalance',
};

export function buildUpstreamListSearchParams(
  input: UpstreamListSearchParamsInput
): URLSearchParams {
  const params = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  });
  const search = input.search?.trim();

  if (search) params.set('search', search);
  if (input.type && input.type !== 'ALL') params.set('type', input.type);
  if (input.status && input.status !== 'ALL') params.set('status', input.status);
  if (input.sort) {
    params.set('sort', input.sort);
    params.set('direction', input.direction === 'desc' ? 'desc' : 'asc');
  }

  return params;
}

export function parseUpstreamQueryParams(
  searchParams: Pick<URLSearchParams, 'get'>
): UpstreamListQuery {
  const search = searchParams.get('search')?.trim() || undefined;
  const rawType = searchParams.get('type')?.trim().toUpperCase();
  const rawStatus = searchParams.get('status')?.trim().toUpperCase();
  const rawSort = searchParams.get('sort')?.trim().toLowerCase();
  const rawDirection = searchParams.get('direction')?.trim().toLowerCase();

  return {
    search,
    type: UPSTREAM_TYPES.find((value) => value === rawType),
    status: UPSTREAM_STATUSES.find((value) => value === rawStatus),
    sort: rawSort ? SORT_FIELDS[rawSort] : undefined,
    direction: rawDirection === 'desc' ? 'desc' : 'asc',
  };
}

export function buildUpstreamWhere(query: UpstreamListQuery): Prisma.UpstreamWhereInput {
  const where: Prisma.UpstreamWhereInput = {};

  if (query.search) {
    where.OR = [
      { name: { contains: query.search } },
      { baseUrl: { contains: query.search } },
    ];
  }
  if (query.type) where.type = query.type;
  if (query.status) where.status = query.status;

  return where;
}

export function buildUpstreamOrderBy(
  query: UpstreamListQuery
): Prisma.UpstreamOrderByWithRelationInput[] {
  const direction = query.direction;

  switch (query.sort) {
    case 'priority':
      return [{ priority: direction }, { id: 'asc' }];
    case 'name':
      return [{ name: direction }, { id: 'asc' }];
    case 'baseUrl':
      return [{ baseUrl: direction }, { id: 'asc' }];
    case 'type':
      return [{ type: direction }, { id: 'asc' }];
    case 'status':
      return [{ status: direction }, { id: 'asc' }];
    default:
      return [{ priority: 'desc' }, { id: 'asc' }];
  }
}

export function calculateSharedBalance(
  keys: readonly { lastBalance: number | null; lastCollectedAt?: Date | string | null }[]
): number | null {
  const balances = keys.filter(
    (key): key is typeof key & { lastBalance: number } => Number.isFinite(key.lastBalance)
  );
  if (balances.length === 0) return null;

  // 同一站点的不同分组共用账户余额，只取最近一次有效采集，避免重复相加。
  return balances.reduce((latest, key) => {
    const latestAt = latest.lastCollectedAt ? new Date(latest.lastCollectedAt).getTime() : 0;
    const keyAt = key.lastCollectedAt ? new Date(key.lastCollectedAt).getTime() : 0;
    return keyAt > latestAt ? key : latest;
  }).lastBalance;
}

export function convertUsdCreditToCny(
  balance: number | null | undefined,
  creditUsdPerCny: number | null | undefined,
): number | null {
  if (balance == null || !Number.isFinite(balance)) return null;
  const rate = Number(creditUsdPerCny);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return balance / rate;
}

/** @deprecated Use calculateSharedBalance; kept for balance sorting compatibility. */
export function calculateTotalBalance(
  keys: readonly { lastBalance: number | null; lastCollectedAt?: Date | string | null }[]
): number {
  return calculateSharedBalance(keys) ?? 0;
}

export function sortAndPaginateByBalance<
  T extends { id: number; creditUsdPerCny: number; keys: readonly { lastBalance: number | null }[] }
>(
  upstreams: readonly T[],
  direction: UpstreamSortDirection,
  page: number,
  pageSize: number
) {
  const total = upstreams.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const items: Array<T & { totalBalance: number }> = upstreams.map((upstream) => ({
    ...upstream,
    totalBalance: convertUsdCreditToCny(calculateSharedBalance(upstream.keys), upstream.creditUsdPerCny) ?? 0,
  }));

  items.sort((left, right) => {
    const balanceDifference = left.totalBalance - right.totalBalance;
    if (balanceDifference === 0) return left.id - right.id;
    return direction === 'asc' ? balanceDifference : -balanceDifference;
  });

  const offset = (currentPage - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    page: currentPage,
    pageSize,
    total,
    totalPages,
  };
}
