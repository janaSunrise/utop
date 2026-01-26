'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/button';
import type { CurriculumData, CurriculumCategoryData, CurriculumCourse } from '@/types/vtop';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS: Record<string, { name: string; description: string }> = {
  NC: { name: 'Non-Credit', description: 'Mandatory courses without credit contribution' },
  UCC: { name: 'University Core', description: 'Core courses required by the university' },
  PCC: { name: 'Program Core', description: 'Core courses for your program' },
  CON: { name: 'Concentration', description: 'Specialization courses in your field' },
  OEC: { name: 'Open Elective', description: 'Electives from other departments' },
  PMT: { name: 'Program Minor Track', description: 'Minor specialization courses' },
  UE: { name: 'University Elective', description: 'University-wide elective courses' },
};

export default function CurriculumPage() {
  const router = useRouter();
  const [curriculum, setCurriculum] = useState<CurriculumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'completed' | 'in_progress' | 'pending'>('all');

  useEffect(() => {
    async function fetchCurriculum() {
      try {
        const response = await fetch('/api/vtop/curriculum');
        const data = await response.json();

        if (data.success) {
          setCurriculum(data.data);
        } else {
          if (data.error?.code === 'SESSION_EXPIRED' || data.error?.code === 'UNAUTHORIZED') {
            router.push('/login');
            return;
          }
          setError(data.error?.message || 'Failed to load curriculum');
        }
      } catch {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    }

    fetchCurriculum();
  }, [router]);

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Curriculum
            </h1>
            <p className="mt-1 text-muted-foreground">
              Track your degree progress and course requirements
            </p>
          </header>

          {loading ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
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
          ) : curriculum && curriculum.categories.length > 0 ? (
            <div className="space-y-6">
              {/* Overall Progress */}
              <CurriculumSummary curriculum={curriculum} />

              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-2">
                {(['all', 'completed', 'in_progress', 'pending'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                      filter === f
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                    )}
                  >
                    {f === 'all' ? 'All Courses' :
                     f === 'completed' ? 'Completed' :
                     f === 'in_progress' ? 'In Progress' : 'Pending'}
                  </button>
                ))}
              </div>

              {/* Category Cards */}
              <div className="space-y-4">
                {curriculum.categories.map((category) => (
                  <CategoryCard
                    key={category.category}
                    category={category}
                    filter={filter}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <svg className="size-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  <path d="M8 7h6" />
                  <path d="M8 11h8" />
                </svg>
              </div>
              <p className="text-lg font-medium text-muted-foreground">
                No curriculum data available
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your curriculum details will appear here once available
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function CurriculumSummary({ curriculum }: { curriculum: CurriculumData }) {
  const progress = curriculum.totalRequiredCredits > 0
    ? (curriculum.totalEarnedCredits / curriculum.totalRequiredCredits) * 100
    : 0;

  const allCourses = curriculum.categories.flatMap(c => c.courses);
  const completedCourses = allCourses.filter(c => c.status === 'completed').length;
  const inProgressCourses = allCourses.filter(c => c.status === 'in_progress').length;
  const pendingCourses = allCourses.filter(c => c.status === 'pending').length;

  // Categories with full completion
  const completedCategories = curriculum.categories.filter(
    c => c.earnedCredits >= c.requiredCredits
  ).length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Overall Progress */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <ProgressRing percentage={progress} size={56} strokeWidth={5} />
          <div>
            <p className="text-2xl font-bold tabular-nums">{progress.toFixed(0)}%</p>
            <p className="text-sm text-muted-foreground">Complete</p>
          </div>
        </div>
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted/50">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {curriculum.totalEarnedCredits} / {curriculum.totalRequiredCredits} credits
          </p>
        </div>
      </div>

      {/* Course Status */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-success/10 p-2 text-success">
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="m9 11 3 3L22 4" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{completedCourses}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
        </div>
      </div>

      {/* In Progress */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-warning/10 p-2 text-warning">
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{inProgressCourses}</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </div>
        </div>
      </div>

      {/* Pending */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M12 8v8" />
              <path d="M8 12h8" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{pendingCourses}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
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
    if (percentage >= 50) return 'stroke-warning';
    return 'stroke-primary';
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

function CategoryCard({
  category,
  filter,
}: {
  category: CurriculumCategoryData;
  filter: 'all' | 'completed' | 'in_progress' | 'pending';
}) {
  const [expanded, setExpanded] = useState(false);

  const label = CATEGORY_LABELS[category.category] || {
    name: category.categoryName,
    description: 'Curriculum category',
  };

  const progress = category.requiredCredits > 0
    ? (category.earnedCredits / category.requiredCredits) * 100
    : 0;

  const isComplete = category.earnedCredits >= category.requiredCredits;

  // Filter courses
  const filteredCourses = filter === 'all'
    ? category.courses
    : category.courses.filter(c => c.status === filter);

  // Don't show category if no courses match filter
  if (filter !== 'all' && filteredCourses.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <div className="flex items-center gap-4">
          <div className={cn(
            'flex size-10 items-center justify-center rounded-lg text-sm font-bold',
            isComplete
              ? 'bg-success/10 text-success'
              : 'bg-primary/10 text-primary'
          )}>
            {category.category}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{label.name}</h3>
              {isComplete && (
                <svg className="size-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 5 5L20 7" />
                </svg>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{label.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold tabular-nums">
              {category.earnedCredits}/{category.requiredCredits}
            </p>
            <p className="text-xs text-muted-foreground">credits</p>
          </div>
          <div className="hidden w-24 sm:block">
            <div className="h-2 overflow-hidden rounded-full bg-muted/50">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  isComplete ? 'bg-success' : 'bg-primary'
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
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

      {/* Course List */}
      {expanded && (
        <div className="border-t border-border">
          {filteredCourses.length > 0 ? (
            <div className="divide-y divide-border">
              {filteredCourses.map((course, index) => (
                <CourseRow key={`${course.courseCode}-${index}`} course={course} />
              ))}
            </div>
          ) : (
            <div className="p-5 text-center text-sm text-muted-foreground">
              No courses in this category yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CourseRow({ course }: { course: CurriculumCourse }) {
  const getStatusBadge = () => {
    switch (course.status) {
      case 'completed':
        return { text: course.grade || 'Done', bgClass: 'bg-success/10', textClass: 'text-success' };
      case 'in_progress':
        return { text: 'Current', bgClass: 'bg-warning/10', textClass: 'text-warning' };
      case 'pending':
        return { text: 'Pending', bgClass: 'bg-muted', textClass: 'text-muted-foreground' };
    }
  };

  const status = getStatusBadge();

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-medium">
            {course.courseCode}
          </span>
          <span className="text-xs text-muted-foreground">
            {course.credits} credits
          </span>
          {course.semester && (
            <span className="text-xs text-muted-foreground">
              · {course.semester}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm">{course.courseName}</p>
      </div>

      <span className={cn(
        'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
        status.bgClass,
        status.textClass
      )}>
        {status.text}
      </span>
    </div>
  );
}
