'use client';

import { memo } from 'react';

export interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  /** Thresholds for color changes. Default: { success: 85, warning: 75 } for attendance-style */
  thresholds?: { success: number; warning: number };
}

/**
 * Circular progress indicator with color-coded thresholds.
 *
 * @example
 * // Attendance style (85/75 thresholds)
 * <ProgressRing percentage={87} />
 *
 * // Marks style (80/60 thresholds)
 * <ProgressRing percentage={75} thresholds={{ success: 80, warning: 60 }} />
 */
export const ProgressRing = memo(function ProgressRing({
  percentage,
  size = 60,
  strokeWidth = 5,
  thresholds = { success: 85, warning: 75 },
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage >= thresholds.success) return 'stroke-success';
    if (percentage >= thresholds.warning) return 'stroke-warning';
    return 'stroke-destructive';
  };

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={getColor()}
      />
    </svg>
  );
});
