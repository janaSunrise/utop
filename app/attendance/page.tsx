'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AttendanceData, AttendanceEntry, Semester } from '@/types/vtop';
import { calculateClassesNeeded, calculateClassesCanSkip } from '@/lib/vtop-client';
import { cn } from '@/lib/utils';

export default function AttendancePage() {
  const router = useRouter();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSemesters() {
      try {
        const response = await fetch('/api/vtop/attendance');
        const data = await response.json();

        if (data.success) {
          setSemesters(data.data.semesters);
          if (data.data.semesters.length > 0) {
            const current = data.data.semesters.find((s: Semester) => s.isCurrent) || data.data.semesters[0];
            setSelectedSemester(current.id);
          }
        } else {
          if (data.error?.code === 'SESSION_EXPIRED' || data.error?.code === 'UNAUTHORIZED') {
            router.push('/login');
            return;
          }
          setError(data.error?.message || 'Failed to load semesters');
        }
      } catch {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    }

    fetchSemesters();
  }, [router]);

  useEffect(() => {
    if (!selectedSemester) return;

    async function fetchAttendance() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/vtop/attendance?semesterId=${selectedSemester}`);
        const data = await response.json();

        if (data.success) {
          setAttendance(data.data);
        } else {
          if (data.error?.code === 'SESSION_EXPIRED' || data.error?.code === 'UNAUTHORIZED') {
            router.push('/login');
            return;
          }
          setError(data.error?.message || 'Failed to load attendance');
        }
      } catch {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    }

    fetchAttendance();
  }, [selectedSemester, router]);

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Attendance
            </h1>
            <p className="mt-1 text-muted-foreground">
              Track your course-wise attendance and eligibility
            </p>
          </header>

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
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-destructive/10 p-4">
                <svg className="size-8 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" x2="12" y1="8" y2="12" />
                  <line x1="12" x2="12.01" y1="16" y2="16" />
                </svg>
              </div>
              <p className="text-lg font-medium text-destructive">{error}</p>
              <Button onClick={() => window.location.reload()} className="mt-4">
                Try Again
              </Button>
            </div>
          ) : attendance && attendance.entries.length > 0 ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <AttendanceSummary entries={attendance.entries} />

              {/* Course Cards */}
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
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <svg className="size-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" />
                  <path d="M16 2v4" />
                  <path d="M8 2v4" />
                  <path d="M3 10h18" />
                </svg>
              </div>
              <p className="text-lg font-medium text-muted-foreground">
                No attendance data available
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a different semester or check back later
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function AttendanceSummary({ entries }: { entries: AttendanceEntry[] }) {
  const totalAttended = entries.reduce((sum, e) => sum + e.attendedClasses, 0);
  const totalClasses = entries.reduce((sum, e) => sum + e.totalClasses, 0);
  const overallPercentage = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;

  const belowThreshold = entries.filter(e => e.attendancePercentage < 75).length;
  const atRisk = entries.filter(e => e.attendancePercentage >= 75 && e.attendancePercentage < 85).length;
  const safe = entries.filter(e => e.attendancePercentage >= 85).length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Overall Attendance */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <ProgressRing percentage={overallPercentage} size={56} strokeWidth={5} />
          <div>
            <p className="text-2xl font-bold tabular-nums">{overallPercentage.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">Overall</p>
          </div>
        </div>
      </div>

      {/* Classes Attended */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="m9 11 3 3L22 4" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{totalAttended}/{totalClasses}</p>
            <p className="text-sm text-muted-foreground">Classes Attended</p>
          </div>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            <StatusDot color="success" count={safe} />
            <StatusDot color="warning" count={atRisk} />
            <StatusDot color="destructive" count={belowThreshold} />
          </div>
          <div>
            <p className="text-sm font-medium">
              <span className="text-success">{safe}</span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-warning">{atRisk}</span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-destructive">{belowThreshold}</span>
            </p>
            <p className="text-sm text-muted-foreground">Safe / Risk / Low</p>
          </div>
        </div>
      </div>

      {/* Courses Count */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{entries.length}</p>
            <p className="text-sm text-muted-foreground">Total Courses</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ color, count }: { color: 'success' | 'warning' | 'destructive'; count: number }) {
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
}

function ProgressRing({
  percentage,
  size = 60,
  strokeWidth = 5,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage >= 85) return 'stroke-success';
    if (percentage >= 75) return 'stroke-warning';
    return 'stroke-destructive';
  };

  return (
    <svg width={size} height={size} className="progress-ring">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      {/* Progress circle */}
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
}

function AttendanceCard({ entry }: { entry: AttendanceEntry }) {
  const percentage = entry.attendancePercentage;
  const classesNeeded = calculateClassesNeeded(entry.attendedClasses, entry.totalClasses, 75);
  const classesCanSkip = calculateClassesCanSkip(entry.attendedClasses, entry.totalClasses, 75);

  const getStatusBadge = () => {
    if (percentage >= 85) return { text: 'Safe', bgClass: 'bg-success/10', textClass: 'text-success' };
    if (percentage >= 75) return { text: 'At Risk', bgClass: 'bg-warning/10', textClass: 'text-warning' };
    return { text: 'Low', bgClass: 'bg-destructive/10', textClass: 'text-destructive' };
  };

  const status = getStatusBadge();

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

        {/* Status Badge */}
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
          <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" x2="12" y1="9" y2="13" />
            <line x1="12" x2="12.01" y1="17" y2="17" />
          </svg>
          Debarred from this course
        </div>
      )}
    </div>
  );
}
