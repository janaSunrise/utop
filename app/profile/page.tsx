'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProfileData } from '@/types/vtop';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      // First try to load from localStorage (cached during login)
      const cachedProfile = localStorage.getItem('vtop_profile');
      if (cachedProfile) {
        try {
          const parsed = JSON.parse(cachedProfile);
          setProfile(parsed);
          setLoading(false);
          return;
        } catch {
          // Invalid cache, continue to API
          localStorage.removeItem('vtop_profile');
        }
      }

      // Fallback to API (may fail if VTOP session expired)
      try {
        const response = await fetch('/api/vtop/profile');
        const data = await response.json();

        if (data.success) {
          setProfile(data.data);
          // Cache for future use
          localStorage.setItem('vtop_profile', JSON.stringify(data.data));
        } else {
          // Redirect to login if session expired
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
      }
    }

    fetchProfile();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="h-64 bg-muted rounded" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-2">Profile</h1>
        </div>

        {profile && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Show message if profile data couldn't be parsed */}
            {!profile.personal.name && !profile.personal.registrationNumber && (
              <Card className="md:col-span-2 bg-amber-50 border-amber-200">
                <CardHeader>
                  <CardTitle className="text-amber-800">Profile Data Unavailable</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-amber-700">
                    Could not load profile data. This may indicate a session issue with VTOP. Try logging out and back in.
                  </p>
                </CardContent>
              </Card>
            )}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-6">
                  {profile.photoUrl && (
                    <div className="flex-shrink-0">
                      <div className="relative w-32 h-40 rounded-lg overflow-hidden border border-border">
                        <Image
                          src={profile.photoUrl}
                          alt="Profile photo"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2 flex-1">
                    <InfoField label="Name" value={profile.personal.name} />
                    <InfoField label="Registration Number" value={profile.personal.registrationNumber} />
                    <InfoField label="Application Number" value={profile.personal.applicationNumber} />
                    <InfoField label="Date of Birth" value={profile.personal.dateOfBirth} />
                    <InfoField label="Gender" value={profile.personal.gender} />
                    <InfoField label="Blood Group" value={profile.personal.bloodGroup} />
                    <InfoField label="Email" value={profile.personal.email} />
                    <InfoField label="Phone" value={profile.personal.phone} />
                    <InfoField label="Nationality" value={profile.personal.nationality} />
                    <InfoField label="Address" value={profile.personal.address} className="sm:col-span-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Educational Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <InfoField label="School" value={profile.educational.school} />
                  <InfoField label="Program" value={profile.educational.program} />
                  <InfoField label="Branch" value={profile.educational.branch} />
                  <InfoField label="Admission Year" value={profile.educational.admissionYear} />
                  <InfoField label="Expected Graduation" value={profile.educational.expectedGraduation} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Proctor Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <InfoField label="Name" value={profile.proctor.name} />
                  <InfoField label="Email" value={profile.proctor.email} />
                  <InfoField label="Phone" value={profile.proctor.phone} />
                  <InfoField label="Cabin" value={profile.proctor.cabin} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Family Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <InfoField label="Father's Name" value={profile.family.fatherName} />
                  <InfoField label="Father's Occupation" value={profile.family.fatherOccupation} />
                  <InfoField label="Father's Phone" value={profile.family.fatherPhone} />
                  <InfoField label="Mother's Name" value={profile.family.motherName} />
                  <InfoField label="Mother's Occupation" value={profile.family.motherOccupation} />
                  <InfoField label="Mother's Phone" value={profile.family.motherPhone} />
                  {profile.family.guardianName && (
                    <>
                      <InfoField label="Guardian's Name" value={profile.family.guardianName} />
                      <InfoField label="Guardian's Phone" value={profile.family.guardianPhone} />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {profile.hostel && (
              <Card>
                <CardHeader>
                  <CardTitle>Hostel Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    <InfoField label="Hostel Name" value={profile.hostel.hostelName} />
                    <InfoField label="Block" value={profile.hostel.blockName} />
                    <InfoField label="Room Number" value={profile.hostel.roomNumber} />
                    <InfoField label="Bed Number" value={profile.hostel.bedNumber} />
                  </div>
                </CardContent>
              </Card>
            )}
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

function InfoField({
  label,
  value,
  className = ''
}: {
  label: string;
  value?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium mt-0.5">{value || <span className="text-muted-foreground italic">Not available</span>}</dd>
    </div>
  );
}
