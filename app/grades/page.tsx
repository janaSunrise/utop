'use client';

import { memo, useMemo } from 'react';
import { AppShell } from '@/components/layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSummary, LoadingCards, ErrorState, EmptyState, PageHeader } from '@/components/data-states';
import { Icons } from '@/components/icons';
import { useSemesterData } from '@/hooks/use-semester-data';
import type { GradesData, SemesterGrades, CourseGrade } from '@/types/vtop';
import { cn } from '@/lib/utils';

export default function GradesPage() {
  const {
    semesters,
    selectedSemester,
    setSelectedSemester,
    data: grades,
    loading,
    error,
    refetch,
  } = useSemesterData<GradesData>({
    semestersEndpoint: '/api/vtop/grades',
    dataEndpoint: '/api/vtop/grades',
  });

  const currentSemester = grades?.semesters?.[0];

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Grades"
            description="View your semester grades and GPA"
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
              <LoadingSummary count={4} />
              <LoadingCards count={1} height="h-64" />
            </div>
          ) : error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : currentSemester && currentSemester.courses.length > 0 ? (
            <div className="space-y-6">
              <GradesSummary semester={currentSemester} cgpa={grades?.cgpa || 0} />
              <div className="rounded-xl border border-border bg-card">
                <div className="border-b border-border p-5">
                  <h3 className="font-medium">{currentSemester.semesterName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {currentSemester.courses.length} courses · {currentSemester.creditsEarned} credits earned
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {currentSemester.courses.map((course, index) => (
                    <CourseGradeRow key={`${course.courseCode}-${index}`} course={course} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon="grades"
              title="No grades available"
              subtitle="Grades will appear here once they are published"
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

const GradesSummary = memo(function GradesSummary({
  semester,
  cgpa,
}: {
  semester: SemesterGrades;
  cgpa: number;
}) {
  const topGrades = useMemo(() => {
    const gradeDistribution = semester.courses.reduce((acc, c) => {
      if (c.grade) {
        acc[c.grade] = (acc[c.grade] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return ['S', 'A', 'B'].reduce((sum, g) => sum + (gradeDistribution[g] || 0), 0);
  }, [semester.courses]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* SGPA */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
            <span className="text-xl font-bold text-primary">{semester.sgpa.toFixed(2)}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">SGPA</p>
            <p className="text-xs text-muted-foreground">Semester GPA</p>
          </div>
        </div>
      </div>

      {/* CGPA */}
      {cgpa > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-success/10 p-2 text-success">
              <Icons.check className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{cgpa.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">CGPA</p>
            </div>
          </div>
        </div>
      )}

      {/* Credits */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            <Icons.book className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{semester.creditsEarned}</p>
            <p className="text-sm text-muted-foreground">Credits Earned</p>
          </div>
        </div>
      </div>

      {/* Top Grades */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-warning/10 p-2 text-warning">
            <Icons.star className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{topGrades}</p>
            <p className="text-sm text-muted-foreground">S/A/B Grades</p>
          </div>
        </div>
      </div>
    </div>
  );
});

const CourseGradeRow = memo(function CourseGradeRow({
  course,
}: {
  course: CourseGrade;
}) {
  const gradeColor = useMemo(() => {
    const colorMap: Record<string, string> = {
      S: 'bg-success text-success-foreground',
      A: 'bg-success/80 text-white',
      B: 'bg-primary text-primary-foreground',
      C: 'bg-warning text-warning-foreground',
      D: 'bg-warning/80 text-white',
      E: 'bg-destructive/80 text-white',
      F: 'bg-destructive text-destructive-foreground',
      N: 'bg-destructive text-destructive-foreground',
    };
    return course.grade ? colorMap[course.grade] || 'bg-muted text-muted-foreground' : 'bg-muted text-muted-foreground';
  }, [course.grade]);

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-medium">
            {course.courseCode}
          </span>
          <span className="rounded bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
            {course.classType}
          </span>
          <span className="text-xs text-muted-foreground">
            {course.credits} credits
          </span>
        </div>
        <p className="mt-1 truncate text-sm">{course.courseName}</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground tabular-nums">
          {course.gradePoints.toFixed(1)} pts
        </span>
        <span className={cn(
          'flex size-9 items-center justify-center rounded-lg text-sm font-bold',
          gradeColor
        )}>
          {course.grade || '-'}
        </span>
      </div>
    </div>
  );
});
