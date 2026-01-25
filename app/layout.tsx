import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'UTop',
    template: '%s | UTop',
  },
  description: 'A modern, student-friendly alternative to VIT\'s VTOP portal. Track attendance, view grades, check timetable, and more.',
  keywords: ['VTOP', 'VIT', 'attendance', 'grades', 'timetable', 'student portal'],
  authors: [{ name: 'UTop' }],
  creator: 'UTop',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'UTop',
    title: 'UTop - A Better VTOP',
    description: 'A modern, student-friendly alternative to VIT\'s VTOP portal.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UTop - A Better VTOP',
    description: 'A modern, student-friendly alternative to VIT\'s VTOP portal.',
  },
  robots: {
    index: false, // Don't index since it requires VTOP credentials
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
