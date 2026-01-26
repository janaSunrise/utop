'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { GradesData, SemesterGrades, CourseGrade, Semester } from '@/types/vtop';
import { cn } from '@/lib/utils';

export default function GradesPage() {
  const router = useRouter();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [grades, setGrades] = useState<GradesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch semesters on mount
  useEffect(() => {
    async function fetchSemesters() {
      try {
        const response = await fetch('/api/vtop/grades');
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

  // Fetch grades when semester changes
  useEffect(() => {
    if (!selectedSemester) return;

    async function fetchGrades() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/vtop/grades?semesterId=${selectedSemester}`);
        const data = await response.json();

        if (data.success) {
          setGrades(data.data);
        } else {
          if (data.error?.code === 'SESSION_EXPIRED' || data.error?.code === 'UNAUTHORIZED') {
            router.push('/login');
            return;
          }
          setError(data.error?.message || 'Failed to load grades');
        }
      } catch {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    }

    fetchGrades();
  }, [selectedSemester, router]);

  const currentSemester = grades?.semesters?.[0];

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Grades
            </h1>
            <p className="mt-1 text-muted-foreground">
              View your semester grades and GPA
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
              <div className="h-64 animate-pulse rounded-xl bg-muted" />
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
          ) : currentSemester && currentSemester.courses.length > 0 ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <GradesSummary semester={currentSemester} cgpa={grades?.cgpa || 0} />

              {/* Course List */}
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
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <svg className="size-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20V10" />
                  <path d="M18 20V4" />
                  <path d="M6 20v-4" />
                </svg>
              </div>
              <p className="text-lg font-medium text-muted-foreground">
                No grades available
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Grades will appear here once they are published
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function GradesSummary({ semester, cgpa }: { semester: SemesterGrades; cgpa: number }) {
  // Calculate grade distribution
  const gradeDistribution = semester.courses.reduce((acc, c) => {
    if (c.grade) {
      acc[c.grade] = (acc[c.grade] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const topGrades = ['S', 'A', 'B'].reduce((sum, g) => sum + (gradeDistribution[g] || 0), 0);

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
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 5 5L20 7" />
              </svg>
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
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
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
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{topGrades}</p>
            <p className="text-sm text-muted-foreground">S/A/B Grades</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CourseGradeRow({ course }: { course: CourseGrade }) {
  const getGradeColor = (grade: string) => {
    if (grade === 'S') return 'bg-success text-success-foreground';
    if (grade === 'A') return 'bg-success/80 text-white';
    if (grade === 'B') return 'bg-primary text-primary-foreground';
    if (grade === 'C') return 'bg-warning text-warning-foreground';
    if (grade === 'D') return 'bg-warning/80 text-white';
    if (grade === 'E') return 'bg-destructive/80 text-white';
    if (grade === 'F' || grade === 'N') return 'bg-destructive text-destructive-foreground';
    return 'bg-muted text-muted-foreground';
  };

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
          course.grade ? getGradeColor(course.grade) : 'bg-muted text-muted-foreground'
        )}>
          {course.grade || '-'}
        </span>
      </div>
    </div>
  );
}
