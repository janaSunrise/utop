'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MarksData, CourseMarks, ExamMark, Semester } from '@/types/vtop';
import { cn } from '@/lib/utils';

export default function MarksPage() {
  const router = useRouter();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [marks, setMarks] = useState<MarksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch semesters on mount
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

  // Fetch marks when semester changes
  useEffect(() => {
    if (!selectedSemester) return;

    async function fetchMarks() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/vtop/marks?semesterId=${selectedSemester}`);
        const data = await response.json();

        if (data.success) {
          setMarks(data.data);
        } else {
          if (data.error?.code === 'SESSION_EXPIRED' || data.error?.code === 'UNAUTHORIZED') {
            router.push('/login');
            return;
          }
          setError(data.error?.message || 'Failed to load marks');
        }
      } catch {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    }

    fetchMarks();
  }, [selectedSemester, router]);

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Marks
            </h1>
            <p className="mt-1 text-muted-foreground">
              View your exam scores and continuous assessment marks
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
                <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
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
          ) : marks && marks.courses.length > 0 ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <MarksSummary courses={marks.courses} />

              {/* Course Cards */}
              <div className="space-y-4">
                {marks.courses.map((course, index) => (
                  <CourseMarksCard
                    key={`${course.courseCode}-${course.classType}-${index}`}
                    course={course}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <svg className="size-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M16 13H8" />
                  <path d="M16 17H8" />
                  <path d="M10 9H8" />
                </svg>
              </div>
              <p className="text-lg font-medium text-muted-foreground">
                No marks data available
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Marks will appear here once they are published
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function MarksSummary({ courses }: { courses: CourseMarks[] }) {
  const totalWeighted = courses.reduce((sum, c) => sum + c.totalWeightedScore, 0);
  const avgWeighted = courses.length > 0 ? totalWeighted / courses.length : 0;

  const coursesWithMarks = courses.filter(c => c.marks.some(m => m.status === 'graded')).length;
  const pendingExams = courses.reduce((sum, c) => sum + c.marks.filter(m => m.status === 'pending').length, 0);

  // Find best and worst performing courses
  const sortedCourses = [...courses].sort((a, b) => b.totalWeightedScore - a.totalWeightedScore);
  const bestCourse = sortedCourses[0];
  const worstCourse = sortedCourses[sortedCourses.length - 1];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Average Score */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <ProgressRing percentage={avgWeighted} size={56} strokeWidth={5} />
          <div>
            <p className="text-2xl font-bold tabular-nums">{avgWeighted.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">Average Score</p>
          </div>
        </div>
      </div>

      {/* Courses with Marks */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="m9 11 3 3L22 4" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{coursesWithMarks}/{courses.length}</p>
            <p className="text-sm text-muted-foreground">Courses Graded</p>
          </div>
        </div>
      </div>

      {/* Pending Exams */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-warning/10 p-2 text-warning">
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{pendingExams}</p>
            <p className="text-sm text-muted-foreground">Pending Exams</p>
          </div>
        </div>
      </div>

      {/* Best/Worst Course */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="space-y-2">
          {bestCourse && (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">{bestCourse.courseCode}</span>
              <span className="text-sm font-semibold text-success">{bestCourse.totalWeightedScore.toFixed(1)}%</span>
            </div>
          )}
          {worstCourse && worstCourse !== bestCourse && (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">{worstCourse.courseCode}</span>
              <span className="text-sm font-semibold text-destructive">{worstCourse.totalWeightedScore.toFixed(1)}%</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Best / Lowest</p>
        </div>
      </div>
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
    if (percentage >= 80) return 'stroke-success';
    if (percentage >= 60) return 'stroke-warning';
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
}

function CourseMarksCard({ course }: { course: CourseMarks }) {
  const [expanded, setExpanded] = useState(false);

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-success';
    if (percentage >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const gradedMarks = course.marks.filter(m => m.status === 'graded');
  const pendingMarks = course.marks.filter(m => m.status === 'pending');

  return (
    <div className="rounded-xl border border-border bg-card transition-colors hover:bg-muted/30">
      {/* Header - Always Visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-medium">
              {course.courseCode}
            </span>
            <span className="rounded bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
              {course.classType}
            </span>
            {pendingMarks.length > 0 && (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                {pendingMarks.length} pending
              </span>
            )}
          </div>
          <h3 className="mt-2 font-medium leading-tight">
            {course.courseName}
          </h3>
          {course.faculty && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {course.faculty}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className={cn('text-2xl font-bold tabular-nums', getScoreColor(course.totalWeightedScore))}>
              {course.totalWeightedScore.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">
              {gradedMarks.length}/{course.marks.length} exams
            </p>
          </div>
          <svg
            className={cn('size-5 text-muted-foreground transition-transform', expanded && 'rotate-180')}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-border px-5 py-4">
          <div className="space-y-3">
            {course.marks.map((mark, index) => (
              <ExamMarkRow key={`${mark.examType}-${index}`} mark={mark} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExamMarkRow({ mark }: { mark: ExamMark }) {
  const percentage = mark.scoredMarks !== null ? (mark.scoredMarks / mark.maxMarks) * 100 : 0;

  const getStatusBadge = () => {
    switch (mark.status) {
      case 'graded':
        return { text: 'Graded', bgClass: 'bg-success/10', textClass: 'text-success' };
      case 'pending':
        return { text: 'Pending', bgClass: 'bg-warning/10', textClass: 'text-warning' };
      case 'absent':
        return { text: 'Absent', bgClass: 'bg-destructive/10', textClass: 'text-destructive' };
    }
  };

  const getBarColor = () => {
    if (mark.status !== 'graded') return 'bg-muted';
    if (percentage >= 80) return 'bg-success';
    if (percentage >= 60) return 'bg-warning';
    return 'bg-destructive';
  };

  const status = getStatusBadge();

  return (
    <div className="flex items-center gap-4">
      {/* Exam Name */}
      <div className="w-24 shrink-0">
        <p className="text-sm font-medium">{mark.examName}</p>
        <p className="text-xs text-muted-foreground">{mark.weightage}% weight</p>
      </div>

      {/* Progress Bar */}
      <div className="flex-1">
        <div className="h-2 overflow-hidden rounded-full bg-muted/50">
          <div
            className={cn('h-full rounded-full transition-all', getBarColor())}
            style={{ width: `${mark.status === 'graded' ? percentage : 0}%` }}
          />
        </div>
      </div>

      {/* Score */}
      <div className="w-20 text-right">
        {mark.status === 'graded' ? (
          <p className="text-sm font-semibold tabular-nums">
            {mark.scoredMarks}/{mark.maxMarks}
          </p>
        ) : (
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', status.bgClass, status.textClass)}>
            {status.text}
          </span>
        )}
      </div>
    </div>
  );
}
