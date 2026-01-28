'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Icons, type IconName } from '@/components/icons';
import { Logo } from './logo';
import { Drawer, DrawerHeader, DrawerContent, DrawerFooter } from './drawer';

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: 'dashboard' },
  { href: '/attendance', label: 'Attendance', icon: 'attendance' },
  { href: '/timetable', label: 'Timetable', icon: 'timetable' },
  { href: '/marks', label: 'Marks', icon: 'marks' },
  { href: '/grades', label: 'Grades', icon: 'grades' },
  { href: '/curriculum', label: 'Curriculum', icon: 'curriculum' },
  { href: '/profile', label: 'Profile', icon: 'profile' },
];


export function Sidebar() {
  const pathname = usePathname();
  const mounted = useIsMounted();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <Logo showText size="default" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = Icons[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <span className={cn(
                  'transition-colors',
                  isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70'
                )}>
                  <Icon className="size-5" />
                </span>
                {item.label}
                {isActive && (
                  <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            aria-label="Toggle theme"
          >
            {!mounted ? (
              <div className="size-5" />
            ) : resolvedTheme === 'dark' ? (
              <Icons.sun className="size-5" />
            ) : (
              <Icons.moon className="size-5" />
            )}
            {mounted ? (resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode') : 'Toggle Theme'}
          </button>

          <form action="/api/vtop/auth/logout" method="POST" className="mt-1">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Icons.logout className="size-5" />
              Sign Out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function MobileHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mounted = useIsMounted();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4">
        {/* Hamburger + Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Open menu"
          >
            <Icons.menu className="size-5" />
          </button>
          <Logo showText size="sm" />
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Toggle theme"
        >
          {!mounted ? (
            <div className="size-5" />
          ) : resolvedTheme === 'dark' ? (
            <Icons.sun className="size-5" />
          ) : (
            <Icons.moon className="size-5" />
          )}
        </button>
      </header>

      {/* Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <DrawerSidebar onNavigate={() => setDrawerOpen(false)} />
      </Drawer>
    </>
  );
}

interface DrawerSidebarProps {
  onNavigate?: () => void;
}

/**
 * Sidebar content for the mobile drawer.
 */
function DrawerSidebar({ onNavigate }: DrawerSidebarProps) {
  const pathname = usePathname();
  const mounted = useIsMounted();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="flex h-full flex-col">
      <DrawerHeader onClose={onNavigate}>
        <Logo showText size="default" />
      </DrawerHeader>

      <DrawerContent className="px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = Icons[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <span className={cn(
                  'transition-colors',
                  isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70'
                )}>
                  <Icon className="size-5" />
                </span>
                {item.label}
                {isActive && (
                  <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary" />
                )}
              </Link>
            );
          })}
        </nav>
      </DrawerContent>

      <DrawerFooter>
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          aria-label="Toggle theme"
        >
          {!mounted ? (
            <div className="size-5" />
          ) : resolvedTheme === 'dark' ? (
            <Icons.sun className="size-5" />
          ) : (
            <Icons.moon className="size-5" />
          )}
          {mounted ? (resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode') : 'Toggle Theme'}
        </button>

        <form action="/api/vtop/auth/logout" method="POST" className="mt-1">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Icons.logout className="size-5" />
            Sign Out
          </button>
        </form>
      </DrawerFooter>
    </div>
  );
}
