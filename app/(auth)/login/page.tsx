'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setError(null);
    setCaptchaInput('');

    try {
      const response = await fetch('/api/vtop/auth/captcha');
      const data = await response.json();

      if (data.success) {
        setCaptchaImage(data.data.captchaImage);
      } else {
        setError(data.error?.message || 'Failed to load CAPTCHA');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/vtop/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, captcha: captchaInput }),
      });

      const data = await response.json();

      if (data.success) {
        // Cache profile data from login response (VTOP sessions expire quickly)
        if (data.data?.profile) {
          localStorage.setItem('vtop_profile', JSON.stringify(data.data.profile));
        }
        if (data.data?.user) {
          localStorage.setItem('vtop_user', JSON.stringify(data.data.user));
        }
        router.push('/');
        router.refresh();
      } else {
        setError(data.error?.message || 'Login failed');
        fetchCaptcha();
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            UTop
          </h1>
          <p className="text-muted-foreground mt-2">
            A better way to access VTOP
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Enter your VTOP credentials to continue
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-3 py-2 border border-destructive/20">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="username" className="text-sm font-medium text-foreground">
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder="e.g. SUNRITJANA"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toUpperCase())}
                  autoComplete="username"
                  autoCapitalize="characters"
                  required
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Your VTOP login ID, not registration number
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="captcha" className="text-sm font-medium text-foreground">
                  CAPTCHA
                </label>
                <div className="flex gap-2 items-center">
                  <div className="relative h-10 w-32 bg-muted rounded-lg overflow-hidden border border-input flex-shrink-0">
                    {captchaLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <LoadingSpinner className="size-5 text-muted-foreground" />
                      </div>
                    ) : captchaImage ? (
                      <Image
                        src={captchaImage}
                        alt="CAPTCHA"
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                        No CAPTCHA
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={fetchCaptcha}
                    disabled={captchaLoading || isLoading}
                    title="Refresh CAPTCHA"
                  >
                    <RefreshIcon className="size-4" />
                  </Button>
                </div>
                <Input
                  id="captcha"
                  type="text"
                  placeholder="Enter CAPTCHA"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  autoComplete="off"
                  required
                  disabled={isLoading}
                  className="mt-2"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading || !captchaImage}
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner className="size-4 mr-2" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Your credentials are sent directly to VTOP.
          <br />
          We never store your password.
        </p>
      </div>
    </div>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`animate-spin ${className}`}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
