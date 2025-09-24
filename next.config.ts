import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable ESLint during build to avoid deprecated options
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Compress images
  images: {
    domains: ['lddwbkefiucimrkfskzt.supabase.co'],
    formats: ['image/avif', 'image/webp'],
  },

  // Enable experimental features for better performance
  experimental: {
    scrollRestoration: true,
  },

  // Webpack configuration for PDF.js support
  webpack: (config, { isServer }) => {
    // Handle PDF.js worker and canvas dependencies
    if (!isServer) {
      // Ensure PDF.js worker is properly handled
      config.resolve.alias = {
        ...config.resolve.alias,
        // Use fallback for server-side rendering compatibility
        canvas: false,
      };

      // Configure externals for PDF.js in client build
      config.externals = config.externals || [];
      config.externals.push({
        'pdfjs-dist/build/pdf.worker.entry': 'pdfjs-dist/build/pdf.worker.entry',
      });
    }

    return config;
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  
  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

export default nextConfig;
