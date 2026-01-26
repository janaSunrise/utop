'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/button';
import type { CurriculumData, CurriculumCategoryData, CurriculumCourse } from '@/types/vtop';
import { cn } from '@/lib/utils';

// Cache for category courses - persists across re-renders
const coursesCache = new Map<string, CurriculumCourse[]>();

function getCachedCourses(categoryId: string): CurriculumCourse[] | null {
  return coursesCache.get(categoryId) || null;
}

function setCachedCourses(categoryId: string, courses: CurriculumCourse[]): void {
  coursesCache.set(categoryId, courses);
}

export default function CurriculumPage() {
  const router = useRouter();
  const [curriculum, setCurriculum] = useState<CurriculumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              {/* Total Credits */}
              <div className="flex items-center gap-2 text-lg">
                <span className="font-semibold">Total Credits:</span>
                <span className="tabular-nums">{curriculum.totalRequiredCredits}</span>
              </div>

              {/* Category Cards */}
              <div className="space-y-4">
                {curriculum.categories.map((category) => (
                  <CategoryCard
                    key={category.category}
                    category={category}
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

function CategoryCard({
  category,
}: {
  category: CurriculumCategoryData;
}) {
  const [expanded, setExpanded] = useState(false);

  // Check cache first, then fall back to category.courses
  const cachedCourses = getCachedCourses(category.category);
  const initialCourses = cachedCourses || category.courses;

  const [courses, setCourses] = useState<CurriculumCourse[]>(initialCourses);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [coursesLoaded, setCoursesLoaded] = useState(initialCourses.length > 0 || cachedCourses !== null);

  // Fetch courses when expanding for the first time
  const handleExpand = useCallback(async () => {
    const willExpand = !expanded;
    setExpanded(willExpand);

    // Fetch courses dynamically if not already loaded or cached
    if (willExpand && !coursesLoaded && !loadingCourses) {
      // Check cache again
      const cached = getCachedCourses(category.category);
      if (cached) {
        setCourses(cached);
        setCoursesLoaded(true);
        return;
      }

      setLoadingCourses(true);
      try {
        const response = await fetch(`/api/vtop/curriculum/category?categoryId=${category.category}`);
        const data = await response.json();
        if (data.success && data.data?.courses) {
          setCourses(data.data.courses);
          setCachedCourses(category.category, data.data.courses);
          setCoursesLoaded(true);
        }
      } catch (error) {
        console.error('Failed to load courses:', error);
      } finally {
        setLoadingCourses(false);
      }
    }
  }, [expanded, coursesLoaded, loadingCourses, category.category]);

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <button
        onClick={handleExpand}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <div className="flex items-center gap-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
            {category.category}
          </div>
          <div>
            <h3 className="font-medium">{category.categoryName}</h3>
            <p className="text-sm text-muted-foreground">
              {category.requiredCredits} credits
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
          {loadingCourses ? (
            <div className="p-5">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          ) : courses.length > 0 ? (
            <div className="divide-y divide-border">
              {courses.map((course, index) => (
                <CourseRow key={`${course.courseCode}-${index}`} course={course} />
              ))}
            </div>
          ) : (
            <div className="p-5 text-center text-sm text-muted-foreground">
              {coursesLoaded ? 'No courses in this category' : 'Click to load courses'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CourseRow({ course }: { course: CurriculumCourse }) {
  const handleDownloadSyllabus = async () => {
    // Open syllabus download in new tab via VTOP
    window.open(`/api/vtop/curriculum/syllabus?courseCode=${course.courseCode}`, '_blank');
  };

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
        </div>
        <p className="mt-1 truncate text-sm">{course.courseName}</p>
      </div>

      <button
        onClick={handleDownloadSyllabus}
        className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Download Syllabus"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" x2="12" y1="15" y2="3" />
        </svg>
      </button>
    </div>
  );
}
