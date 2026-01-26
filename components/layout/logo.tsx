'use client';

import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'default' | 'lg';
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'size-7',
  default: 'size-8',
  lg: 'size-10',
};

const textSizeClasses = {
  sm: 'text-base',
  default: 'text-lg',
  lg: 'text-xl',
};

const iconSizeClasses = {
  sm: 'text-xs',
  default: 'text-sm',
  lg: 'text-base',
};

/**
 * Distinctive logo component with gradient "U" lettermark.
 * Design: Modern Academic - gradient accents with clean lettermark.
 */
export function Logo({ size = 'default', showText = false, className }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Gradient border container */}
      <div
        className={cn(
          'relative flex items-center justify-center rounded-lg',
          sizeClasses[size]
        )}
        style={{
          background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(186 100% 50%) 50%, hsl(280 100% 70%) 100%)',
          padding: '2px',
        }}
      >
        {/* Inner content */}
        <div
          className={cn(
            'flex size-full items-center justify-center rounded-[6px] bg-background',
            'font-bold tracking-tight',
            iconSizeClasses[size]
          )}
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(186 100% 50%) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          U
        </div>
      </div>

      {showText && (
        <span
          className={cn(
            'font-semibold tracking-tight',
            textSizeClasses[size]
          )}
        >
          UTop
        </span>
      )}
    </div>
  );
}

/**
 * Simple logo mark without text for compact spaces.
 */
export function LogoMark({ size = 'default', className }: Omit<LogoProps, 'showText'>) {
  return <Logo size={size} showText={false} className={className} />;
}
