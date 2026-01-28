'use client';

import { Sidebar, MobileHeader } from './sidebar';
import { CollapsedSidebar } from './collapsed-sidebar';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Application shell with responsive sidebar layout.
 *
 * Breakpoints:
 * - Mobile (<md): Header + Drawer for full menu
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
        {children}
      </main>
    </div>
  );
}
