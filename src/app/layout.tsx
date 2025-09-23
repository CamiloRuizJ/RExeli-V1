import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/providers/SessionProvider";

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
      <body className={`${inter.variable} font-sans antialiased bg-gray-50 min-h-screen`}>
        <SessionProvider>
          <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="bg-white/80 backdrop-blur-lg border-b border-gray-100 shadow-sm sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-18">
                <div className="flex items-center space-x-4">
                  {/* Logo */}
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-lg">R</span>
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                  </div>
                  
                  {/* Brand */}
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      RExeli
                    </h1>
                    <p className="text-xs text-gray-500 font-medium">
                      AI-Powered Real Estate Processing
                    </p>
                  </div>
                </div>
                
                {/* Navigation/Status */}
                <div className="flex items-center space-x-6">
                  <div className="hidden md:flex items-center space-x-2 text-sm text-gray-500">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>System Operational</span>
                  </div>
                  
                  <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                    Beta v1.0
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1">
            {children}
          </main>

          {/* Compact Footer */}
          <footer className="bg-slate-900 border-t border-slate-700/50 mt-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
                    <a href="#" className="hover:text-white transition-colors">Contact</a>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <span>Powered by</span>
                    <span className="text-white">OpenAI</span>
                    <span>•</span>
                    <span className="text-white">Supabase</span>
                  </div>
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
