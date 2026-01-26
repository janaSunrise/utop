'use client';

import { Sidebar, MobileHeader, MobileBottomNav } from './sidebar';
import { CollapsedSidebar } from './collapsed-sidebar';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Application shell with responsive sidebar layout.
 *
 * Breakpoints:
 * - Mobile (<md): Header + Bottom nav + Drawer for full menu
 * - Tablet (md-lg): Collapsed icon sidebar (w-16)
 * - Desktop (lg+): Full sidebar with labels (w-64)
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar (lg+) */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Tablet Collapsed Sidebar (md-lg) */}
      <div className="hidden md:block lg:hidden">
        <CollapsedSidebar />
      </div>

      {/* Mobile Header (<md) */}
      <div className="md:hidden">
        <MobileHeader />
      </div>

      {/* Main Content */}
      <main className="md:pl-16 lg:pl-64">
        <div className="min-h-screen pb-20 md:pb-0">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav (<md) */}
      <div className="md:hidden">
        <MobileBottomNav />
      </div>
    </div>
  );
}
