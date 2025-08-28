import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  
  // Compress images
  images: {
    domains: ['lddwbkefiucimrkfskzt.supabase.co'],
    formats: ['image/avif', 'image/webp'],
  },
  
  // Enable experimental features for better performance
  experimental: {
    scrollRestoration: true,
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
