import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
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
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f8f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0c14' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans antialiased`}>
        <Providers>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
