import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/providers/SessionProvider";
import Navbar from "@/components/navigation/Navbar";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

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
          inter.variable,
        )}
      >
        <SessionProvider>
          <div className="min-h-screen flex flex-col">
          {/* Navigation */}
          <Navbar />

          {/* Main Content */}
          <main className="flex-1">
            {children}
          </main>

          {/* Compact Footer */}
          <footer className="bg-slate-900 border-t border-slate-700/50 mt-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex flex-col space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                  {/* Brand and Copyright */}
                  <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">R</span>
                      </div>
                      <span className="text-white font-semibold">RExeli</span>
                    </div>
                    <p className="text-slate-400 text-sm">© 2025 RExeli. All rights reserved.</p>
                  </div>

                  {/* Links and Powered By */}
                  <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6">
                    <div className="flex items-center space-x-4 text-xs text-slate-400">
                      <a href="#" className="hover:text-white transition-colors">Privacy</a>
                      <a href="#" className="hover:text-white transition-colors">Terms</a>
                      <a href="mailto:admin@rexeli.com" className="hover:text-white transition-colors">Contact</a>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-400">
                      <span>Powered by</span>
                      <span className="text-white">RExeli AI</span>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="text-center border-t border-slate-700/50 pt-4">
                  <p className="text-sm text-slate-400">
                    Need help? Contact us at{' '}
                    <a href="mailto:admin@rexeli.com" className="text-blue-400 hover:text-blue-300 transition-colors underline">
                      admin@rexeli.com
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </footer>
          </div>
          <Toaster position="top-right" />
        </SessionProvider>
      </body>
    </html>
  );
}
