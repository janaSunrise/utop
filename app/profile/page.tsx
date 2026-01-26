'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/button';
import type { ProfileData } from '@/types/vtop';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (forceRefresh = false) => {
    // Check localStorage cache unless refreshing
    if (!forceRefresh) {
      const cachedProfile = localStorage.getItem('vtop_profile');
      if (cachedProfile) {
        try {
          const parsed = JSON.parse(cachedProfile);
          setProfile(parsed);
          setLoading(false);
          return;
        } catch {
          localStorage.removeItem('vtop_profile');
        }
      }
    }

    try {
      if (forceRefresh) setRefreshing(true);

      // Add refresh param to bypass server cache
      const url = forceRefresh ? '/api/vtop/profile?refresh=true' : '/api/vtop/profile';
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setProfile(data.data);
        localStorage.setItem('vtop_profile', JSON.stringify(data.data));
        setError(null);
      } else {
        if (data.error?.code === 'SESSION_EXPIRED' || data.error?.code === 'UNAUTHORIZED') {
          router.push('/login');
          return;
        }
        setError(data.error?.message || 'Failed to load profile');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    localStorage.removeItem('vtop_profile');
    fetchProfile(true);
  };

  useEffect(() => {
    fetchProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="space-y-6">
              <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
              <div className="h-64 animate-pulse rounded-xl bg-muted" />
              <div className="grid gap-6 md:grid-cols-2">
                <div className="h-48 animate-pulse rounded-xl bg-muted" />
                <div className="h-48 animate-pulse rounded-xl bg-muted" />
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Profile
              </h1>
              <p className="mt-1 text-muted-foreground">
                Your personal and academic information
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <svg
                className={cn('size-4', refreshing && 'animate-spin')}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </header>

          {profile && (
            <div className="space-y-6">
              {/* Profile Data Unavailable Warning */}
              {!profile.personal.name && !profile.personal.registrationNumber && (
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-6">
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-warning/20 p-2 text-warning">
                      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                        <line x1="12" x2="12" y1="9" y2="13" />
                        <line x1="12" x2="12.01" y1="17" y2="17" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-warning">Profile Data Unavailable</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Could not load profile data. This may indicate a session issue with VTOP. Try logging out and back in.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Hero Card - Personal Info with Photo */}
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="h-24 bg-muted" />
                <div className="relative px-6 pb-6">
                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
                    {/* Profile Photo */}
                    <div className="-mt-12 relative">
                      <div className="size-24 overflow-hidden rounded-xl border-4 border-card bg-muted shadow-sm">
                        {profile.photoUrl ? (
                          <Image
                            src={profile.photoUrl}
                            alt="Profile photo"
                            width={96}
                            height={96}
                            className="size-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-3xl font-bold text-muted-foreground">
                            {profile.personal.name?.[0] || '?'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Name and Basic Info */}
                    <div className="flex-1 text-center sm:pb-1 sm:text-left">
                      <h2 className="text-xl font-bold tracking-tight">
                        {profile.personal.name || 'Student'}
                      </h2>
                      <p className="mt-0.5 font-mono text-sm text-muted-foreground">
                        {profile.personal.registrationNumber}
                      </p>
                      <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                        {profile.educational.program && (
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            {profile.educational.program}
                          </span>
                        )}
                        {profile.educational.branch && (
                          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                            {profile.educational.branch}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info Cards Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Personal Information */}
                <InfoCard
                  title="Personal Information"
                  icon={<UserIcon />}
                >
                  <InfoGrid>
                    <InfoField label="Application Number" value={profile.personal.applicationNumber} />
                    <InfoField label="Date of Birth" value={profile.personal.dateOfBirth} />
                    <InfoField label="Gender" value={profile.personal.gender} />
                    <InfoField label="Blood Group" value={profile.personal.bloodGroup} />
                    <InfoField label="Email" value={profile.personal.email} />
                    <InfoField label="Phone" value={profile.personal.phone} />
                    <InfoField label="Nationality" value={profile.personal.nationality} />
                    <InfoField label="Address" value={profile.personal.address} fullWidth />
                  </InfoGrid>
                </InfoCard>

                {/* Educational Information */}
                <InfoCard
                  title="Educational Information"
                  icon={<GraduationIcon />}
                >
                  <InfoGrid>
                    <InfoField label="School" value={profile.educational.school} fullWidth />
                    <InfoField label="Program" value={profile.educational.program} />
                    <InfoField label="Branch" value={profile.educational.branch} />
                    <InfoField label="Admission Year" value={profile.educational.admissionYear} />
                    <InfoField label="Expected Graduation" value={profile.educational.expectedGraduation} />
                  </InfoGrid>
                </InfoCard>

                {/* Proctor Information */}
                <InfoCard
                  title="Proctor Information"
                  icon={<ProctorIcon />}
                >
                  <InfoGrid>
                    <InfoField label="Name" value={profile.proctor.name} fullWidth />
                    <InfoField label="Email" value={profile.proctor.email} />
                    <InfoField label="Phone" value={profile.proctor.phone} />
                    <InfoField label="Cabin" value={profile.proctor.cabin} />
                  </InfoGrid>
                </InfoCard>

                {/* Family Information */}
                <InfoCard
                  title="Family Information"
                  icon={<FamilyIcon />}
                >
                  <InfoGrid>
                    <InfoField label="Father's Name" value={profile.family.fatherName} />
                    <InfoField label="Father's Phone" value={profile.family.fatherPhone} />
                    <InfoField label="Father's Occupation" value={profile.family.fatherOccupation} fullWidth />
                    <InfoField label="Mother's Name" value={profile.family.motherName} />
                    <InfoField label="Mother's Phone" value={profile.family.motherPhone} />
                    <InfoField label="Mother's Occupation" value={profile.family.motherOccupation} fullWidth />
                    {profile.family.guardianName && (
                      <>
                        <InfoField label="Guardian's Name" value={profile.family.guardianName} />
                        <InfoField label="Guardian's Phone" value={profile.family.guardianPhone} />
                      </>
                    )}
                  </InfoGrid>
                </InfoCard>

                {/* Hostel Information */}
                {profile.hostel && (
                  <InfoCard
                    title="Hostel Information"
                    icon={<HostelIcon />}
                    className="md:col-span-2"
                  >
                    <InfoGrid>
                      <InfoField label="Hostel Name" value={profile.hostel.hostelName} />
                      <InfoField label="Block" value={profile.hostel.blockName} />
                      <InfoField label="Room Number" value={profile.hostel.roomNumber} />
                      <InfoField label="Bed Number" value={profile.hostel.bedNumber} />
                    </InfoGrid>
                  </InfoCard>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function InfoCard({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      'overflow-hidden rounded-xl border border-border bg-card',
      className
    )}>
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
          {icon}
        </div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {children}
    </div>
  );
}

function InfoField({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">
        {value || <span className="italic text-muted-foreground">Not available</span>}
      </dd>
    </div>
  );
}

// Icons
function UserIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 1 0-16 0" />
    </svg>
  );
}

function GraduationIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

function ProctorIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function FamilyIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M21 3v18H3V3z" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </svg>
  );
}

function HostelIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
      <path d="M9 9v.01" />
      <path d="M9 12v.01" />
      <path d="M9 15v.01" />
      <path d="M9 18v.01" />
    </svg>
  );
}
