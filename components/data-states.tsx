'use client';

import { Button } from '@/components/ui/button';
import { Icons, type IconName } from '@/components/icons';

interface LoadingCardsProps {
  /** Number of skeleton cards to show */
  count?: number;
  /** Height of each card (Tailwind class, e.g., "h-40") */
  height?: string;
  /** Grid layout (default: single column) */
  grid?: boolean;
}

/**
 * Loading skeleton cards for data pages.
 */
export function LoadingCards({
  count = 3,
  height = 'h-40',
  grid = false,
}: LoadingCardsProps) {
  const cards = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`${height} animate-pulse rounded-xl bg-muted`}
    />
  ));

  if (grid) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards}
      </div>
    );
  }

  return <div className="space-y-4">{cards}</div>;
}

interface LoadingSummaryProps {
  /** Number of summary cards */
  count?: number;
}

/**
 * Loading skeleton for summary card rows.
 */
export function LoadingSummary({ count = 4 }: LoadingSummaryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

interface ErrorStateProps {
  /** Error message to display */
  error: string;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
}

/**
 * Error state with retry button.
 */
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-destructive/10 p-4">
        <Icons.error className="size-8 text-destructive" />
      </div>
      <p className="text-lg font-medium text-destructive">{error}</p>
      {onRetry && (
        <Button onClick={onRetry} className="mt-4">
          Try Again
        </Button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  /** Icon to display */
  icon: IconName;
  /** Main title */
  title: string;
  /** Subtitle/description */
  subtitle?: string;
}

/**
 * Empty state for when no data is available.
 */
export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  const Icon = Icons[icon];

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <Icon className="size-8 text-muted-foreground" />
      </div>
      <p className="text-lg font-medium text-muted-foreground">{title}</p>
      {subtitle && (
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
}

/**
 * Standard page header with title and description.
 */
export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {description && (
        <p className="mt-1 text-muted-foreground">{description}</p>
      )}
    </header>
  );
}
