'use client';

import Link from 'next/link';
import type { Column, ColumnDef } from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  Eye,
  MoreHorizontal,
  Pencil,
  Power,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/StatusBadge';
import { configurationLabel, evaluateConfiguration } from '@/lib/upstream-management';
import { calculateSharedBalance, convertUsdCreditToCny } from '@/lib/upstream-query';

export interface UpstreamKeyRow {
  id: number;
  group: string;
  label: string | null;
  userId?: string | null;
  keyName: string | null;
  groupName: string | null;
  groupDescription: string | null;
  groupRateMultiplier: number | null;
  remoteKeyId?: string | null;
  metadataSyncedAt?: string | null;
  metadataError?: string | null;
  status: string;
  lastBalance: number | null;
  lastLatencyMs: number | null;
  hasApiKey: boolean;
  hasAccessToken: boolean;
  enabled: boolean;
  lastCollectedAt?: string | null;
  lastError?: string | null;
  testModel?: string | null;
  monitoredModels?: MonitoredModelRow[];
}

export interface MonitoredModelRow {
  id: number;
  modelName: string;
  officialInputPrice: number | null;
  officialOutputPrice: number | null;
  officialPriceSource: string;
  enabled: boolean;
  lastTestedAt: string | null;
  latestTest?: {
    ok: boolean | null;
    errorMessage: string | null;
    recordedAt: string;
  } | null;
}

export interface UpstreamRow {
  id: number;
  name: string;
  baseUrl: string;
  type: string;
  status: string;
  enabled: boolean;
  priority: number;
  testModel: string | null;
  creditUsdPerCny: number;
  totalBalance?: number | null;
  keys?: UpstreamKeyRow[];
}

export interface UpstreamColumnCallbacks {
  onView?: (upstream: UpstreamRow) => void;
  onEdit: (upstream: UpstreamRow) => void;
  onToggle: (upstream: UpstreamRow) => void;
  onDelete: (upstream: UpstreamRow) => void;
}

export const UPSTREAM_COLUMN_LABELS: Record<string, string> = {
  name: '名称',
  baseUrl: '地址',
  status: '状态',
  targets: '监测对象',
  configuration: '配置状态',
  recentCheck: '最近检测',
  balance: '余额（人民币）',
};

export function getUpstreamTotalBalance(upstream: UpstreamRow): number | null {
  if (upstream.totalBalance != null) return upstream.totalBalance;

  return convertUsdCreditToCny(calculateSharedBalance(upstream.keys || []), upstream.creditUsdPerCny);
}

function SortableHeader({
  column,
  label,
  align = 'left',
}: {
  column: Column<UpstreamRow, unknown>;
  label: string;
  align?: 'left' | 'right';
}) {
  const direction = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      className={align === 'right' ? 'ml-auto -mr-3' : '-ml-3'}
      aria-label={`按${label}排序`}
      onClick={column.getToggleSortingHandler()}
    >
      {label}
      {direction === 'asc' ? (
        <ArrowUp data-icon="inline-end" />
      ) : direction === 'desc' ? (
        <ArrowDown data-icon="inline-end" />
      ) : (
        <ArrowUpDown data-icon="inline-end" />
      )}
    </Button>
  );
}

function RowActions({
  upstream,
  callbacks,
}: {
  upstream: UpstreamRow;
  callbacks: UpstreamColumnCallbacks;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`打开 ${upstream.name} 的操作菜单`}
          title={`打开 ${upstream.name} 的操作菜单`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>操作</DropdownMenuLabel>
          {callbacks.onView ? (
            <DropdownMenuItem onSelect={() => callbacks.onView?.(upstream)}>
              <Eye />
              查看详情
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <Link href={`/upstreams/${upstream.id}`}>
                <Eye />
                查看详情
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => callbacks.onEdit(upstream)}>
            <Pencil />
            编辑
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => callbacks.onToggle(upstream)}>
            <Power />
            {upstream.enabled ? '暂停监测' : '恢复监测'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => callbacks.onDelete(upstream)}
          >
            <Trash2 />
            删除
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function createUpstreamColumns(
  callbacks: UpstreamColumnCallbacks,
): ColumnDef<UpstreamRow>[] {
  return [
    {
      accessorKey: 'name',
      size: 150,
      enableHiding: false,
      header: ({ column }) => <SortableHeader column={column} label="名称" />,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <Link href={`/upstreams/${row.original.id}`} className="truncate font-medium hover:underline">
            {row.original.name}
          </Link>
        </div>
      ),
    },
    {
      accessorKey: 'baseUrl',
      size: 230,
      header: '地址',
      cell: ({ row }) => (
        <div className="max-w-60 truncate text-sm text-muted-foreground" title={row.original.baseUrl}>
          {row.original.baseUrl}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      size: 110,
      header: ({ column }) => <SortableHeader column={column} label="状态" />,
      cell: ({ row }) => <StatusBadge status={row.original.enabled ? row.original.status : 'PAUSED'} />,
    },
    {
      id: 'targets',
      size: 300,
      header: '监测对象',
      cell: ({ row }) => <MonitoringTargets upstream={row.original} />,
    },
    {
      id: 'configuration',
      size: 110,
      header: '配置状态',
      cell: ({ row }) => {
        const health = evaluateConfiguration(row.original);
        return health.state === 'NEEDS_CONFIG' ? (
          <button
            type="button"
            className={`font-medium hover:underline ${configurationColor(health.state)}`}
            onClick={() => callbacks.onEdit(row.original)}
          >
            {configurationLabel(health.state)}
          </button>
        ) : (
          <div className="min-w-0">
            <div className={`font-medium ${configurationColor(health.state)}`}>{configurationLabel(health.state)}</div>
          </div>
        );
      },
    },
    {
      id: 'recentCheck',
      size: 140,
      header: '最近检测',
      cell: ({ row }) => {
        const health = evaluateConfiguration(row.original);
        return health.errorMessage ? (
          <Link
            href={`/upstreams/${row.original.id}`}
            className="flex min-w-0 items-center gap-1.5 text-warning hover:underline"
            title={health.errorMessage}
          >
            <CircleAlert className="size-4 shrink-0" />
            <span className="truncate text-xs">检测异常</span>
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">
            {health.latestCollectedAt ? formatRecentTime(health.latestCollectedAt) : '尚未检测'}
          </span>
        );
      },
    },
    {
      id: 'balance',
      size: 130,
      accessorFn: getUpstreamTotalBalance,
      header: ({ column }) => <SortableHeader column={column} label="余额（人民币）" align="right" />,
      cell: ({ row }) => {
        const balance = getUpstreamTotalBalance(row.original);
        return (
          <div className="text-right font-mono text-sm">
            {balance == null ? '—' : `¥${balance.toFixed(2)}`}
          </div>
        );
      },
    },
    {
      id: 'actions',
      size: 70,
      enableHiding: false,
      enableSorting: false,
      header: () => <div className="text-right">操作</div>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <RowActions upstream={row.original} callbacks={callbacks} />
        </div>
      ),
    },
  ];
}

function MonitoringTargets({ upstream }: { upstream: UpstreamRow }) {
  const targets = (upstream.keys || []).flatMap((key) => {
    const models = (key.monitoredModels || []).filter((model) => model.enabled);
    return models.map((model) => ({ key, model }));
  });
  if (targets.length === 0) return <span className="text-sm text-muted-foreground">未配置</span>;

  return (
    <div className="space-y-1.5 py-1">
      {targets.map(({ key, model }) => {
        const recovered = model.latestTest?.ok === false && key.status === 'ONLINE';
        const failed = model.latestTest?.ok === false && !recovered;
        const healthy = model.latestTest?.ok === true || recovered;
        const content = (
          <span className="flex min-w-0 items-center gap-1.5">
            {failed ? (
              <CircleAlert className="size-3.5 shrink-0 text-destructive" />
            ) : healthy ? (
              <CircleCheck className="size-3.5 shrink-0 text-success" />
            ) : (
              <CircleMinus className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate text-xs" title={`${key.group} / ${model.modelName}`}>
              {key.group} / <span className="font-mono">{model.modelName}</span>
            </span>
          </span>
        );
        return failed ? (
          <Link
            key={`${key.id}-${model.id}`}
            href={`/upstreams/${upstream.id}`}
            className="block hover:underline"
            title={model.latestTest?.errorMessage || '最近一次真实测试失败'}
          >
            {content}
          </Link>
        ) : (
          <div key={`${key.id}-${model.id}`}>{content}</div>
        );
      })}
    </div>
  );
}

function configurationColor(state: ReturnType<typeof evaluateConfiguration>['state']) {
  if (state === 'READY') return 'text-success';
  return 'text-destructive';
}

function formatRecentTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}
