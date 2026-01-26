'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AttendanceData, AttendanceEntry, Semester } from '@/types/vtop';
import { calculateClassesNeeded, calculateClassesCanSkip } from '@/lib/vtop-client';

export default function AttendancePage() {
  const router = useRouter();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
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
          // Auto-select first semester
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

  // Fetch attendance when semester changes
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
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-2">Attendance</h1>
        </div>

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
              <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        ) : attendance && attendance.entries.length > 0 ? (
          <div className="space-y-4">
            {/* Summary Card */}
            <AttendanceSummary entries={attendance.entries} />

            {/* Individual Course Cards */}
            {attendance.entries.map((entry, index) => (
              <AttendanceCard key={`${entry.courseCode}-${entry.classType}-${index}`} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No attendance data available for this semester.
          </div>
        )}
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold">UTop</Link>
        <form action="/api/vtop/auth/logout" method="POST">
          <Button variant="ghost" size="sm" type="submit">Sign out</Button>
        </form>
      </div>
    </header>
  );
}

function AttendanceSummary({ entries }: { entries: AttendanceEntry[] }) {
  const totalAttended = entries.reduce((sum, e) => sum + e.attendedClasses, 0);
  const totalClasses = entries.reduce((sum, e) => sum + e.totalClasses, 0);
  const overallPercentage = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0;

  const belowThreshold = entries.filter(e => e.attendancePercentage < 75).length;
  const atRisk = entries.filter(e => e.attendancePercentage >= 75 && e.attendancePercentage < 85).length;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-2xl font-semibold">{overallPercentage.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">Overall</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{totalAttended}/{totalClasses}</p>
            <p className="text-sm text-muted-foreground">Classes Attended</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-destructive">{belowThreshold}</p>
            <p className="text-sm text-muted-foreground">Below 75%</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-amber-500">{atRisk}</p>
            <p className="text-sm text-muted-foreground">At Risk (75-85%)</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AttendanceCard({ entry }: { entry: AttendanceEntry }) {
  const percentage = entry.attendancePercentage;
  const getStatusColor = () => {
    if (percentage >= 85) return 'text-green-600';
    if (percentage >= 75) return 'text-amber-500';
    return 'text-destructive';
  };

  const getBgColor = () => {
    if (percentage >= 85) return 'bg-green-50 border-green-200';
    if (percentage >= 75) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  };

  const classesNeeded = calculateClassesNeeded(entry.attendedClasses, entry.totalClasses, 75);
  const classesCanSkip = calculateClassesCanSkip(entry.attendedClasses, entry.totalClasses, 75);

  return (
    <Card className={`${getBgColor()}`}>
      <CardContent className="pt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm bg-background px-2 py-0.5 rounded">
                {entry.courseCode}
              </span>
              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-background rounded">
                {entry.classType}
              </span>
            </div>
            <h3 className="font-medium">{entry.courseName}</h3>
            {entry.faculty && (
              <p className="text-sm text-muted-foreground mt-1">{entry.faculty}</p>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Attended</p>
              <p className="font-semibold">{entry.attendedClasses}/{entry.totalClasses}</p>
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">Percentage</p>
              <p className={`text-2xl font-bold ${getStatusColor()}`}>
                {percentage.toFixed(0)}%
              </p>
            </div>

            <div className="text-center min-w-[80px]">
              {percentage < 75 ? (
                <>
                  <p className="text-sm text-muted-foreground">Need</p>
                  <p className="font-semibold text-destructive">
                    +{classesNeeded} {classesNeeded === 1 ? 'class' : 'classes'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Can Skip</p>
                  <p className="font-semibold text-green-600">
                    {classesCanSkip} {classesCanSkip === 1 ? 'class' : 'classes'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {entry.isDebarred && (
          <div className="mt-3 px-3 py-2 bg-destructive/10 text-destructive text-sm rounded-md">
            ⚠️ Debarred from this course
          </div>
        )}
      </CardContent>
    </Card>
  );
}
