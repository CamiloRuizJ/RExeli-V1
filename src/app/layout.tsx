import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/providers/SessionProvider";
import Navbar from "@/components/navigation/Navbar";
import { cn } from "@/lib/utils";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Image from "next/image";
import { Logo } from "@/components/ui/Logo";

// Use system fonts instead of Google Fonts to avoid build-time network issues
const fontVariable = "";

export const metadata: Metadata = {
  title: "RExeli V1 - Real Estate Document Processing",
  description: "AI-powered real estate document classification and data extraction platform",
  keywords: "real estate, document processing, AI, rent roll, offering memo, lease agreement",
  authors: [{ name: "RExeli Team" }],
  icons: {
    icon: [
      { url: '/favicon.ico?v=3', sizes: '48x48' },
      { url: '/favicon.png?v=3', type: 'image/png', sizes: '512x512' },
    ],
    apple: [
      { url: '/apple-touch-icon.png?v=3', sizes: '180x180' },
      { url: '/favicon.png?v=3', sizes: '512x512' },
    ],
    shortcut: '/favicon.ico?v=3',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={cn(
          "font-sans antialiased bg-background text-foreground min-h-screen",
          fontVariable,
        )}
        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
      >
        <SessionProvider>
          {/* Skip to main content link for accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-lg focus:shadow-lg"
          >
            Skip to main content
          </a>

          <div className="min-h-screen flex flex-col">
            {/* Navigation */}
            <Navbar />

            {/* Main Content */}
            <main id="main-content" className="flex-1">
              {children}
            </main>

            {/* Compact Footer */}
            <footer className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-t border-emerald-500/20 mt-8">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                  {/* Brand */}
                  <div className="flex items-center">
                    <Logo variant="white" size="sm" />
                  </div>

                  {/* Links */}
                  <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
                    <a href="/" className="text-slate-400 hover:text-emerald-400 transition-colors">Home</a>
                    <a href="/tool" className="text-slate-400 hover:text-emerald-400 transition-colors">Document Tool</a>
                    <a href="mailto:support@rexeli.com" className="text-slate-400 hover:text-emerald-400 transition-colors">Support</a>
                    <a href="#" className="text-slate-400 hover:text-emerald-400 transition-colors">Privacy</a>
                  </div>

                  {/* Copyright */}
                  <p className="text-slate-400 text-sm">
                    © 2025 RExeli
                  </p>
                </div>
              </div>
            </footer>
          </div>
          <Toaster position="bottom-right" />
        </SessionProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
