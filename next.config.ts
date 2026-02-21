import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export', // Commented out to enable SSR/API routes for Firebase
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
