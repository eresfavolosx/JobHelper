import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Enables static HTML export for Firebase Spark plan
  images: {
    unoptimized: true,
  },
  env: {
    // Build timestamp: used as the cutoff for one-time data migrations so they only
    // repair records written by previously deployed code
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
