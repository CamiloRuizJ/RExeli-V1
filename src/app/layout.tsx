import type { Metadata } from "next";
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
  viewport: "width=device-width, initial-scale=1",
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
          <header className="bg-white border-b border-gray-200 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">R</span>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">RExeli</h1>
                    <p className="text-xs text-gray-500">Real Estate Document Processing</p>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  Version 1.0
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

          {/* Footer */}
          <footer className="bg-white border-t border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex justify-between items-center text-sm text-gray-500">
                <p>© 2025 RExeli. All rights reserved.</p>
                <p>Powered by OpenAI & Supabase</p>
              </div>
            </div>
          </footer>
        </div>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
