'use client';

import { useState, memo, useMemo } from 'react';
import { AppShell } from '@/components/layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingCards, ErrorState, EmptyState, PageHeader } from '@/components/data-states';
import { Icons } from '@/components/icons';
import { useSemesterData } from '@/hooks/use-semester-data';
import type { MarksData, CourseMarks, ExamMark } from '@/types/vtop';
import { cn } from '@/lib/utils';

export default function MarksPage() {
  const {
    semesters,
    selectedSemester,
    setSelectedSemester,
    data: marks,
    loading,
    error,
    refetch,
  } = useSemesterData<MarksData>({
    semestersEndpoint: '/api/vtop/attendance',
    dataEndpoint: '/api/vtop/marks',
  });

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Marks"
            description="View your exam scores and continuous assessment marks"
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
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : marks && marks.courses.length > 0 ? (
            <div className="space-y-6">
              <MarksSummary courses={marks.courses} />
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
            <EmptyState
              icon="marks"
              title="No marks data available"
              subtitle="Marks will appear here once they are published"
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

const MarksSummary = memo(function MarksSummary({
  courses,
}: {
  courses: CourseMarks[];
}) {
  const stats = useMemo(() => {
    const totalWeighted = courses.reduce((sum, c) => sum + c.totalWeightedScore, 0);
    const avgWeighted = courses.length > 0 ? totalWeighted / courses.length : 0;
    const coursesWithMarks = courses.filter(c => c.marks.some(m => m.status === 'graded')).length;
    const pendingExams = courses.reduce((sum, c) => sum + c.marks.filter(m => m.status === 'pending').length, 0);
    const sortedCourses = [...courses].sort((a, b) => b.totalWeightedScore - a.totalWeightedScore);
    const bestCourse = sortedCourses[0];
    const worstCourse = sortedCourses[sortedCourses.length - 1];

    return { avgWeighted, coursesWithMarks, pendingExams, bestCourse, worstCourse };
  }, [courses]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Average Score */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <ProgressRing percentage={stats.avgWeighted} size={56} strokeWidth={5} />
          <div>
            <p className="text-2xl font-bold tabular-nums">{stats.avgWeighted.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">Average Score</p>
          </div>
        </div>
      </div>

      {/* Courses with Marks */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icons.attendance className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{stats.coursesWithMarks}/{courses.length}</p>
            <p className="text-sm text-muted-foreground">Courses Graded</p>
          </div>
        </div>
      </div>

      {/* Pending Exams */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-warning/10 p-2 text-warning">
            <Icons.clock className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{stats.pendingExams}</p>
            <p className="text-sm text-muted-foreground">Pending Exams</p>
          </div>
        </div>
      </div>

      {/* Best/Worst Course */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="space-y-2">
          {stats.bestCourse && (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">{stats.bestCourse.courseCode}</span>
              <span className="text-sm font-semibold text-success">{stats.bestCourse.totalWeightedScore.toFixed(1)}%</span>
            </div>
          )}
          {stats.worstCourse && stats.worstCourse !== stats.bestCourse && (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">{stats.worstCourse.courseCode}</span>
              <span className="text-sm font-semibold text-destructive">{stats.worstCourse.totalWeightedScore.toFixed(1)}%</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Best / Lowest</p>
        </div>
      </div>
    </div>
  );
});

const ProgressRing = memo(function ProgressRing({
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
});

const CourseMarksCard = memo(function CourseMarksCard({
  course,
}: {
  course: CourseMarks;
}) {
  const [expanded, setExpanded] = useState(false);

  const { gradedMarks, pendingMarks, scoreColor } = useMemo(() => {
    const graded = course.marks.filter(m => m.status === 'graded');
    const pending = course.marks.filter(m => m.status === 'pending');
    const color = course.totalWeightedScore >= 80 ? 'text-success'
      : course.totalWeightedScore >= 60 ? 'text-warning'
      : 'text-destructive';
    return { gradedMarks: graded, pendingMarks: pending, scoreColor: color };
  }, [course.marks, course.totalWeightedScore]);

  return (
    <div className="rounded-xl border border-border bg-card transition-colors hover:bg-muted/30">
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
            <p className={cn('text-2xl font-bold tabular-nums', scoreColor)}>
              {course.totalWeightedScore.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">
              {gradedMarks.length}/{course.marks.length} exams
            </p>
          </div>
          <Icons.chevronDown
            className={cn('size-5 text-muted-foreground transition-transform', expanded && 'rotate-180')}
          />
        </div>
      </button>

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
});

const ExamMarkRow = memo(function ExamMarkRow({ mark }: { mark: ExamMark }) {
  const percentage = mark.scoredMarks !== null ? (mark.scoredMarks / mark.maxMarks) * 100 : 0;

  const { status, barColor } = useMemo(() => {
    const statusMap = {
      graded: { text: 'Graded', bgClass: 'bg-success/10', textClass: 'text-success' },
      pending: { text: 'Pending', bgClass: 'bg-warning/10', textClass: 'text-warning' },
      absent: { text: 'Absent', bgClass: 'bg-destructive/10', textClass: 'text-destructive' },
    };
    const bar = mark.status !== 'graded' ? 'bg-muted'
      : percentage >= 80 ? 'bg-success'
      : percentage >= 60 ? 'bg-warning'
      : 'bg-destructive';
    return { status: statusMap[mark.status], barColor: bar };
  }, [mark.status, percentage]);

  return (
    <div className="flex items-center gap-4">
      <div className="w-24 shrink-0">
        <p className="text-sm font-medium">{mark.examName}</p>
        <p className="text-xs text-muted-foreground">{mark.weightage}% weight</p>
      </div>

      <div className="flex-1">
        <div className="h-2 overflow-hidden rounded-full bg-muted/50">
          <div
            className={cn('h-full rounded-full transition-all', barColor)}
            style={{ width: `${mark.status === 'graded' ? percentage : 0}%` }}
          />
        </div>
      </div>

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
});
