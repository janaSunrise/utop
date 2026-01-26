'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface DrawerProps {
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
}

/**
 * Slide-in drawer for mobile navigation.
 * Simple implementation with CSS transitions.
 */
export function Drawer({ children, open, onClose }: DrawerProps) {
  // Don't render anything on server or when closed
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'fixed left-0 top-0 z-50 h-full w-72 bg-sidebar',
          'border-r border-sidebar-border shadow-xl',
          'animate-in slide-in-from-left duration-200'
        )}
      >
        {children}
      </div>
    </>
  );
}

interface DrawerHeaderProps {
  children: React.ReactNode;
  onClose?: () => void;
}

/**
 * Drawer header with optional close button.
 */
export function DrawerHeader({ children, onClose }: DrawerHeaderProps) {
  return (
    <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
      {children}
      {onClose && (
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          aria-label="Close drawer"
        >
          <svg
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface DrawerContentProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Scrollable drawer content area.
 */
export function DrawerContent({ children, className }: DrawerContentProps) {
  return (
    <div className={cn('flex-1 overflow-y-auto', className)}>
      {children}
    </div>
  );
}

interface DrawerFooterProps {
  children: React.ReactNode;
}

/**
 * Drawer footer for actions like logout.
 */
export function DrawerFooter({ children }: DrawerFooterProps) {
  return (
    <div className="border-t border-sidebar-border p-4">
      {children}
    </div>
  );
}
