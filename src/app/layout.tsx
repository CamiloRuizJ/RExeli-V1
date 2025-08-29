import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

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
          <main className="flex-1 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>

          {/* Modern Footer */}
          <footer className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 border-t border-slate-800/50 mt-16 overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: `radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.15) 0%, transparent 50%), 
                                 radial-gradient(circle at 75% 75%, rgba(99, 102, 241, 0.15) 0%, transparent 50%)`
              }}></div>
            </div>
            
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
              {/* Main Footer Content */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                {/* Brand Section */}
                <div className="md:col-span-2">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-xl">R</span>
                      </div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-slate-900 animate-pulse"></div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">RExeli</h3>
                      <p className="text-blue-200 text-sm font-medium">AI-Powered Real Estate Processing</p>
                    </div>
                  </div>
                  <p className="text-slate-300 text-base leading-relaxed max-w-md">
                    Transform your real estate document workflow with intelligent AI processing. 
                    Extract data, classify documents, and streamline your operations.
                  </p>
                  
                  {/* Trust Badges */}
                  <div className="flex flex-wrap gap-6 mt-8">
                    <div className="flex items-center space-x-3 bg-white/5 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/10">
                      <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <span className="text-blue-400 font-bold text-sm">✓</span>
                      </div>
                      <div>
                        <span className="text-white text-sm font-semibold block">SOC 2</span>
                        <span className="text-blue-200 text-xs">Compliant</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 bg-white/5 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/10">
                      <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <span className="text-green-400 font-bold text-sm">🔒</span>
                      </div>
                      <div>
                        <span className="text-white text-sm font-semibold block">Encrypted</span>
                        <span className="text-green-200 text-xs">End-to-End</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 bg-white/5 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/10">
                      <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                        <span className="text-purple-400 font-bold text-sm">⚡</span>
                      </div>
                      <div>
                        <span className="text-white text-sm font-semibold block">99.9%</span>
                        <span className="text-purple-200 text-xs">Uptime</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Quick Links */}
                <div>
                  <h4 className="text-white font-semibold text-lg mb-6">Platform</h4>
                  <ul className="space-y-3">
                    <li><a href="#" className="text-slate-300 hover:text-white transition-colors duration-200 text-sm">Document Processing</a></li>
                    <li><a href="#" className="text-slate-300 hover:text-white transition-colors duration-200 text-sm">AI Classification</a></li>
                    <li><a href="#" className="text-slate-300 hover:text-white transition-colors duration-200 text-sm">Data Extraction</a></li>
                    <li><a href="#" className="text-slate-300 hover:text-white transition-colors duration-200 text-sm">Export Tools</a></li>
                  </ul>
                </div>
                
                {/* Support */}
                <div>
                  <h4 className="text-white font-semibold text-lg mb-6">Support</h4>
                  <ul className="space-y-3">
                    <li><a href="#" className="text-slate-300 hover:text-white transition-colors duration-200 text-sm">Help Center</a></li>
                    <li><a href="#" className="text-slate-300 hover:text-white transition-colors duration-200 text-sm">API Documentation</a></li>
                    <li><a href="#" className="text-slate-300 hover:text-white transition-colors duration-200 text-sm">Status Page</a></li>
                    <li><a href="#" className="text-slate-300 hover:text-white transition-colors duration-200 text-sm">Contact Us</a></li>
                  </ul>
                </div>
              </div>
              
              {/* Bottom Section */}
              <div className="pt-8 border-t border-slate-700/50">
                <div className="flex flex-col lg:flex-row justify-between items-center space-y-4 lg:space-y-0">
                  <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-8">
                    <p className="text-slate-400 text-sm">© 2025 RExeli. All rights reserved.</p>
                    <div className="flex items-center space-x-6 text-xs text-slate-400">
                      <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                      <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                      <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    <span className="text-slate-400 text-sm">Powered by</span>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2 bg-white/10 rounded-lg px-3 py-1.5 backdrop-blur-sm border border-white/10">
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                        <span className="text-white text-sm font-medium">OpenAI</span>
                      </div>
                      <div className="flex items-center space-x-2 bg-white/10 rounded-lg px-3 py-1.5 backdrop-blur-sm border border-white/10">
                        <div className="w-4 h-4 bg-emerald-500 rounded"></div>
                        <span className="text-white text-sm font-medium">Supabase</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </footer>
        </div>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
