import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/providers/SessionProvider";
import Navbar from "@/components/navigation/Navbar";
import { cn } from "@/lib/utils";
import { Analytics } from "@vercel/analytics/next";

// Use system fonts instead of Google Fonts to avoid build-time network issues
const fontVariable = "";

export const metadata: Metadata = {
  title: "RExeli V1 - Real Estate Document Processing",
  description: "AI-powered real estate document classification and data extraction platform",
  keywords: "real estate, document processing, AI, rent roll, offering memo, lease agreement",
  authors: [{ name: "RExeli Team" }],
  icons: {
    icon: '/favicon.ico',
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
          <div className="min-h-screen flex flex-col">
          {/* Navigation */}
          <Navbar />

          {/* Main Content */}
          <main className="flex-1">
            {children}
          </main>

          {/* Enhanced Footer */}
          <footer className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-t border-emerald-500/20 mt-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="flex flex-col space-y-6">
                {/* Top Section */}
                <div className="flex flex-col md:flex-row justify-between items-start space-y-6 md:space-y-0">
                  {/* Brand and Description */}
                  <div className="flex flex-col space-y-3 max-w-sm">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-lg">R</span>
                      </div>
                      <span className="text-white font-bold text-xl">RExeli</span>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      AI-powered real estate document processing platform. Transform complex documents into structured data in minutes.
                    </p>
                  </div>

                  {/* Quick Links */}
                  <div className="flex flex-col space-y-3">
                    <h3 className="text-white font-semibold text-sm">Quick Links</h3>
                    <div className="flex flex-col space-y-2 text-sm">
                      <a href="/" className="text-slate-400 hover:text-emerald-400 transition-colors">Home</a>
                      <a href="/tool" className="text-slate-400 hover:text-emerald-400 transition-colors">Document Tool</a>
                      <a href="#pricing" className="text-slate-400 hover:text-emerald-400 transition-colors">Pricing</a>
                    </div>
                  </div>

                  {/* Support */}
                  <div className="flex flex-col space-y-3">
                    <h3 className="text-white font-semibold text-sm">Support</h3>
                    <div className="flex flex-col space-y-2 text-sm">
                      <a href="mailto:support@rexeli.com" className="text-slate-400 hover:text-emerald-400 transition-colors">
                        Support
                      </a>
                      <a href="mailto:sales@rexeli.com" className="text-slate-400 hover:text-emerald-400 transition-colors">
                        Sales
                      </a>
                      <a href="#" className="text-slate-400 hover:text-emerald-400 transition-colors">Documentation</a>
                    </div>
                  </div>

                  {/* Legal */}
                  <div className="flex flex-col space-y-3">
                    <h3 className="text-white font-semibold text-sm">Legal</h3>
                    <div className="flex flex-col space-y-2 text-sm">
                      <a href="#" className="text-slate-400 hover:text-emerald-400 transition-colors">Privacy Policy</a>
                      <a href="#" className="text-slate-400 hover:text-emerald-400 transition-colors">Terms of Service</a>
                      <a href="#" className="text-slate-400 hover:text-emerald-400 transition-colors">Cookie Policy</a>
                    </div>
                  </div>
                </div>

                {/* Bottom Section */}
                <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 pt-6 border-t border-slate-700/50">
                  <p className="text-slate-400 text-sm">
                    © 2025 RExeli. All rights reserved.
                  </p>
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="text-slate-400">Powered by</span>
                    <span className="text-emerald-400 font-semibold">RExeli AI</span>
                  </div>
                </div>
              </div>
            </div>
          </footer>
          </div>
          <Toaster position="top-right" />
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
