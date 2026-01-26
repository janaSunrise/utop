'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Icons, type IconName } from '@/components/icons';
import { LogoMark } from './logo';

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

/**
 * Simple tooltip component using CSS.
 */
function NavTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="group relative">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="whitespace-nowrap rounded-md bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground shadow-md">
          {label}
        </div>
      </div>
    </div>
  );
}

/**
 * Collapsed icon-only sidebar for tablet breakpoint (md-lg).
 * Shows tooltips on hover for navigation labels.
 */
export function CollapsedSidebar() {
  const pathname = usePathname();
  const mounted = useIsMounted();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-16 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border">
        <LogoMark size="default" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = Icons[item.icon];

          return (
            <NavTooltip key={item.href} label={item.label}>
              <Link
                href={item.href}
                className={cn(
                  'relative flex size-12 items-center justify-center rounded-lg transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
              >
                <Icon className="size-5" />
                {isActive && (
                  <span className="absolute right-1 size-1.5 rounded-full bg-sidebar-primary" />
                )}
              </Link>
            </NavTooltip>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2">
        {/* Theme Toggle */}
        <NavTooltip label={mounted ? (resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode') : 'Toggle Theme'}>
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex size-12 items-center justify-center rounded-lg text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
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
        </NavTooltip>

        {/* Logout */}
        <NavTooltip label="Sign Out">
          <form action="/api/vtop/auth/logout" method="POST">
            <button
              type="submit"
              className="flex size-12 items-center justify-center rounded-lg text-sidebar-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Icons.logout className="size-5" />
            </button>
          </form>
        </NavTooltip>
      </div>
    </aside>
  );
}
