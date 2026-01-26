import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getClientUserInfo } from '@/lib/session';

export default async function DashboardPage() {
  const user = await getClientUserInfo();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-semibold">UTop</h1>
          <div className="flex items-center gap-4">
            <p className="text-sm font-medium font-mono">
              {user?.registrationNumber || 'Student'}
            </p>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1">
            Here&apos;s an overview of your academic progress
          </p>
        </div>

        {/* Quick Links Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <QuickLinkCard
            title="Attendance"
            description="Track your course-wise attendance"
            href="/attendance"
            icon={<AttendanceIcon />}
          />
          <QuickLinkCard
            title="Timetable"
            description="View your weekly class schedule"
            href="/timetable"
            icon={<TimetableIcon />}
          />
          <QuickLinkCard
            title="Marks"
            description="Check your exam marks"
            href="/marks"
            icon={<MarksIcon />}
          />
          <QuickLinkCard
            title="Grades"
            description="View your semester grades"
            href="/grades"
            icon={<GradesIcon />}
          />
          <QuickLinkCard
            title="Curriculum"
            description="Track your degree progress"
            href="/curriculum"
            icon={<CurriculumIcon />}
          />
          <QuickLinkCard
            title="Profile"
            description="View your personal information"
            href="/profile"
            icon={<ProfileIcon />}
          />
        </div>

        {/* Coming Soon Notice */}
        <div className="mt-8 p-4 rounded-lg bg-muted/50 text-center">
          <p className="text-sm text-muted-foreground">
            Dashboard with CGPA, attendance alerts, and today&apos;s schedule coming soon.
          </p>
        </div>
      </main>
    </div>
  );
}

// Logout Button Component
function LogoutButton() {
  return (
    <form action="/api/vtop/auth/logout" method="POST">
      <Button variant="ghost" size="sm" type="submit">
        Sign out
      </Button>
    </form>
  );
}

// Quick Link Card Component
function QuickLinkCard({
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
    <Link href={href} className="block">
      <Card className="h-full transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}

// Icon Components
function AttendanceIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function TimetableIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function MarksIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <polyline points="10,9 9,9 8,9" />
    </svg>
  );
}

function GradesIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function CurriculumIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
