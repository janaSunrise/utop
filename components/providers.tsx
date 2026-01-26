'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * App-wide providers wrapper.
 * Creates QueryClient instance per-component to avoid sharing state between requests in SSR.
 */
export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Don't refetch on window focus by default (user can trigger manual refresh)
            refetchOnWindowFocus: false,
            // Only retry once on failure
            retry: 1,
            // Consider data stale after 5 minutes by default
            staleTime: 5 * 60 * 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
