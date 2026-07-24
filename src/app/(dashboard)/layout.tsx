'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Activity, LayoutDashboard, Server, Bell, Settings, BookOpen, LogOut, Menu, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: '总览', icon: LayoutDashboard },
  { href: '/upstreams', label: '上游管理', icon: Server },
  { href: '/incidents', label: '告警事件', icon: Bell },
];

const AUX_NAV_ITEMS = [
  { href: '/settings', label: '设置', icon: Settings },
  { href: '/help', label: '使用帮助', icon: BookOpen },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      {/* 侧边栏 - 桌面 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r bg-card px-3 py-4 md:flex">
        <SidebarContent pathname={pathname} onLogout={handleLogout} />
      </aside>

      {/* 侧边栏 - 移动端抽屉 */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r bg-card px-3 py-4 md:hidden">
            <SidebarContent pathname={pathname} onLogout={handleLogout} onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </>
      )}

      {/* 主内容 */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col md:pl-56">
        {/* 移动端顶栏 */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-card/80 px-4 py-3 backdrop-blur md:hidden">
          <Button variant="outline" size="icon" aria-label="打开导航菜单" onClick={() => setSidebarOpen(true)}>
            <Menu />
          </Button>
          <span className="font-semibold">RelayScope</span>
          <ThemeToggleButton />
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname, onLogout, onNavigate,
}: { pathname: string; onLogout: () => void; onNavigate?: () => void }) {
  const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';
  return (
    <>
      {/* Logo */}
      <div className="mb-6 flex items-center justify-between gap-2 px-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold leading-tight">RelayScope</div>
            <div className="truncate text-[10px] text-muted-foreground">LLM API 监测台</div>
          </div>
        </div>
        <ThemeToggleButton />
      </div>

      {/* 导航 */}
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t pt-3">
        {AUX_NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        {!authDisabled && <button
          onClick={onLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>}
      </div>
    </>
  );
}

function ThemeToggleButton() {
  const { theme, toggle } = useTheme();
  const label = theme === 'light' ? '切换到深色模式' : '切换到浅色模式';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
