import Link from 'next/link';
import { getClientUserInfo } from '@/lib/session';
import { AppShell } from '@/components/layout';

export default async function DashboardPage() {
  const user = await getClientUserInfo();

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Welcome Header */}
          <header className="mb-8">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-muted-foreground">
                Welcome back,
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {user?.name || 'Student'}
              </h1>
            </div>
            {user?.registrationNumber && (
              <p className="mt-2 font-mono text-sm text-muted-foreground">
                {user.registrationNumber}
              </p>
            )}
          </header>

          {/* Stats Overview */}
          <section className="mb-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Overall Attendance"
                value="87%"
                trend="+2.3%"
                trendUp
                icon={<AttendanceIcon />}
              />
              <StatCard
                label="Current CGPA"
                value="8.74"
                trend="Top 15%"
                icon={<GradeIcon />}
              />
              <StatCard
                label="Credits Completed"
                value="96/160"
                trend="60%"
                icon={<CreditIcon />}
              />
              <StatCard
                label="Classes Today"
                value="4"
                trend="2 remaining"
                icon={<ClassIcon />}
              />
            </div>
          </section>

          {/* Quick Access Grid */}
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-semibold tracking-tight">
              Quick Access
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <QuickAccessCard
                title="Attendance"
                description="Track your course-wise attendance and see how many classes you can skip"
                href="/attendance"
                icon={<AttendanceLargeIcon />}
              />
              <QuickAccessCard
                title="Timetable"
                description="View your weekly class schedule and upcoming sessions"
                href="/timetable"
                icon={<TimetableLargeIcon />}
              />
              <QuickAccessCard
                title="Marks"
                description="Check your CAT, FAT and assignment marks"
                href="/marks"
                icon={<MarksLargeIcon />}
              />
              <QuickAccessCard
                title="Grades"
                description="View your semester grades and CGPA history"
                href="/grades"
                icon={<GradesLargeIcon />}
              />
              <QuickAccessCard
                title="Curriculum"
                description="Track your degree progress and remaining requirements"
                href="/curriculum"
                icon={<CurriculumLargeIcon />}
              />
              <QuickAccessCard
                title="Profile"
                description="View and manage your personal information"
                href="/profile"
                icon={<ProfileLargeIcon />}
              />
            </div>
          </section>

          {/* Coming Soon Banner */}
          <section>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <SparklesIcon />
                </div>
                <div>
                  <h3 className="font-semibold">More Features Coming Soon</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We&apos;re working on exam schedules, faculty details, hostel info, and more.
                    Stay tuned for updates.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  trend,
  trendUp,
  icon,
}: {
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/50">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{icon}</span>
        {trend && (
          <span className={`text-xs font-medium ${trendUp ? 'text-success' : 'text-muted-foreground'}`}>
            {trend}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

// Quick Access Card Component
function QuickAccessCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-card p-6 transition-colors hover:bg-muted/50"
    >
      <div className="mb-4 inline-flex rounded-lg bg-muted p-2.5 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        {icon}
      </div>
      <h3 className="font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        <span>Open</span>
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

// Icons
function AttendanceIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function GradeIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V10" />
      <path d="M18 20V4" />
      <path d="M6 20v-4" />
    </svg>
  );
}

function CreditIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function ClassIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function AttendanceLargeIcon() {
  return (
    <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function TimetableLargeIcon() {
  return (
    <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h.01" />
      <path d="M12 18h.01" />
      <path d="M16 18h.01" />
    </svg>
  );
}

function MarksLargeIcon() {
  return (
    <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}

function GradesLargeIcon() {
  return (
    <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V10" />
      <path d="M18 20V4" />
      <path d="M6 20v-4" />
    </svg>
  );
}

function CurriculumLargeIcon() {
  return (
    <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M8 7h6" />
      <path d="M8 11h8" />
    </svg>
  );
}

function ProfileLargeIcon() {
  return (
    <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 1 0-16 0" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
