import Link from 'next/link';
import { getClientUserInfo } from '@/lib/session';
import { AppShell } from '@/components/layout';
import { Icons } from '@/components/icons';

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
                icon={<Icons.attendance className="size-5" />}
              />
              <StatCard
                label="Current CGPA"
                value="8.74"
                trend="Top 15%"
                icon={<Icons.barChart className="size-5" />}
              />
              <StatCard
                label="Credits Completed"
                value="96/160"
                trend="60%"
                icon={<Icons.clock className="size-5" />}
              />
              <StatCard
                label="Classes Today"
                value="4"
                trend="2 remaining"
                icon={<Icons.calendar className="size-5" />}
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
                icon={<Icons.attendance className="size-6" />}
              />
              <QuickAccessCard
                title="Timetable"
                description="View your weekly class schedule and upcoming sessions"
                href="/timetable"
                icon={<Icons.timetable className="size-6" />}
              />
              <QuickAccessCard
                title="Marks"
                description="Check your CAT, FAT and assignment marks"
                href="/marks"
                icon={<Icons.marks className="size-6" />}
              />
              <QuickAccessCard
                title="Grades"
                description="View your semester grades and CGPA history"
                href="/grades"
                icon={<Icons.grades className="size-6" />}
              />
              <QuickAccessCard
                title="Curriculum"
                description="Track your degree progress and remaining requirements"
                href="/curriculum"
                icon={<Icons.curriculum className="size-6" />}
              />
              <QuickAccessCard
                title="Profile"
                description="View and manage your personal information"
                href="/profile"
                icon={<Icons.profile className="size-6" />}
              />
            </div>
          </section>

          {/* Coming Soon Banner */}
          <section>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Icons.sparkles className="size-5" />
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
        <Icons.arrowRight className="size-4" />
      </div>
    </Link>
  );
}
