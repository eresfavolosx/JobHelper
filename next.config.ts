import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Enables static HTML export for Firebase Spark plan
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
