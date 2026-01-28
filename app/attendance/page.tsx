'use client';

import { memo, useMemo } from 'react';
import { AppShell } from '@/components/layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingCards, ErrorState, EmptyState, PageHeader } from '@/components/data-states';
import { Icons } from '@/components/icons';
import { ProgressRing } from '@/components/ui/progress-ring';
import { useSemesterData } from '@/hooks/use-semester-data';
import type { AttendanceData, AttendanceEntry } from '@/types/vtop';
import { calculateClassesNeeded, calculateClassesCanSkip } from '@/lib/vtop-client';
import { cn } from '@/lib/utils';

export default function AttendancePage() {
  const {
    semesters,
    selectedSemester,
    setSelectedSemester,
    data: attendance,
    loading,
    error,
    refetch,
  } = useSemesterData<AttendanceData>({
    semestersEndpoint: '/api/vtop/attendance',
    dataEndpoint: '/api/vtop/attendance',
  });

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Attendance"
            description="Track your course-wise attendance and eligibility"
          />

          {/* Semester Selector */}
          <div className="mb-6">
            <Select
              value={selectedSemester}
              onValueChange={(value) => value && setSelectedSemester(value)}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Select semester" />
              </SelectTrigger>
              <SelectContent>
                {semesters.map((sem) => (
                  <SelectItem key={sem.id} value={sem.id}>
                    {sem.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <LoadingCards count={3} height="h-40" />
          ) : error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : attendance && attendance.entries.length > 0 ? (
            <div className="space-y-6">
              <AttendanceSummary entries={attendance.entries} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {attendance.entries.map((entry, index) => (
                  <AttendanceCard
                    key={`${entry.courseCode}-${entry.classType}-${index}`}
                    entry={entry}
                  />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon="timetable"
              title="No attendance data available"
              subtitle="Select a different semester or check back later"
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

const AttendanceSummary = memo(function AttendanceSummary({
  entries,
}: {
  entries: AttendanceEntry[];
}) {
  const stats = useMemo(() => {
    const totalAttended = entries.reduce((sum, e) => sum + e.attendedClasses, 0);
    const totalClasses = entries.reduce((sum, e) => sum + e.totalClasses, 0);
    const overallPercentage = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;

    const belowThreshold = entries.filter(e => e.attendancePercentage < 75).length;
    const atRisk = entries.filter(e => e.attendancePercentage >= 75 && e.attendancePercentage < 85).length;
    const safe = entries.filter(e => e.attendancePercentage >= 85).length;

    return { totalAttended, totalClasses, overallPercentage, belowThreshold, atRisk, safe };
  }, [entries]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Overall Attendance */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <ProgressRing percentage={stats.overallPercentage} size={56} strokeWidth={5} />
          <div>
            <p className="text-2xl font-bold tabular-nums">{stats.overallPercentage.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">Overall</p>
          </div>
        </div>
      </div>

      {/* Classes Attended */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icons.attendance className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{stats.totalAttended}/{stats.totalClasses}</p>
            <p className="text-sm text-muted-foreground">Classes Attended</p>
          </div>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            <StatusDot color="success" count={stats.safe} />
            <StatusDot color="warning" count={stats.atRisk} />
            <StatusDot color="destructive" count={stats.belowThreshold} />
          </div>
          <div>
            <p className="text-sm font-medium">
              <span className="text-success">{stats.safe}</span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-warning">{stats.atRisk}</span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-destructive">{stats.belowThreshold}</span>
            </p>
            <p className="text-sm text-muted-foreground">Safe / Risk / Low</p>
          </div>
        </div>
      </div>

      {/* Courses Count */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            <Icons.book className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{entries.length}</p>
            <p className="text-sm text-muted-foreground">Total Courses</p>
          </div>
        </div>
      </div>
    </div>
  );
});

const StatusDot = memo(function StatusDot({
  color,
  count,
}: {
  color: 'success' | 'warning' | 'destructive';
  count: number;
}) {
  const colorClasses = {
    success: 'bg-success',
    warning: 'bg-warning',
    destructive: 'bg-destructive',
  };

  return (
    <div className="flex flex-col items-center gap-1">
      {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
        <div key={i} className={cn('size-2 rounded-full', colorClasses[color])} />
      ))}
      {count > 5 && (
        <span className="text-[10px] text-muted-foreground">+{count - 5}</span>
      )}
    </div>
  );
});

const AttendanceCard = memo(function AttendanceCard({
  entry,
}: {
  entry: AttendanceEntry;
}) {
  const percentage = entry.attendancePercentage;
  const classesNeeded = calculateClassesNeeded(entry.attendedClasses, entry.totalClasses, 75);
  const classesCanSkip = calculateClassesCanSkip(entry.attendedClasses, entry.totalClasses, 75);

  const status = useMemo(() => {
    if (percentage >= 85) return { text: 'Safe', bgClass: 'bg-success/10', textClass: 'text-success' };
    if (percentage >= 75) return { text: 'At Risk', bgClass: 'bg-warning/10', textClass: 'text-warning' };
    return { text: 'Low', bgClass: 'bg-destructive/10', textClass: 'text-destructive' };
  }, [percentage]);

  return (
    <div className="rounded-xl border border-border bg-card transition-colors hover:bg-muted/50">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-medium">
              {entry.courseCode}
            </span>
            <span className="rounded bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
              {entry.classType}
            </span>
          </div>
          <h3 className="mt-2 font-medium leading-tight line-clamp-2">
            {entry.courseName}
          </h3>
          {entry.faculty && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {entry.faculty}
            </p>
          )}
        </div>

        <span className={cn(
          'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
          status.bgClass,
          status.textClass
        )}>
          {status.text}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <ProgressRing percentage={percentage} size={40} strokeWidth={3} />
          <div>
            <p className={cn('text-lg font-bold tabular-nums', status.textClass)}>
              {percentage.toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">
              {entry.attendedClasses}/{entry.totalClasses}
            </p>
          </div>
        </div>

        <div className="text-right">
          {percentage < 75 ? (
            <>
              <p className="font-semibold text-destructive tabular-nums">
                +{classesNeeded}
              </p>
              <p className="text-xs text-muted-foreground">classes needed</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-success tabular-nums">
                {classesCanSkip}
              </p>
              <p className="text-xs text-muted-foreground">can skip</p>
            </>
          )}
        </div>
      </div>

      {/* Debarred Warning */}
      {entry.isDebarred && (
        <div className="flex items-center gap-2 border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          <Icons.warning className="size-4 shrink-0" />
          Debarred from this course
        </div>
      )}
    </div>
  );
});
