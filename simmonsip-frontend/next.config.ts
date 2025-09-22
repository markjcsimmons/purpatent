import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure Turbopack uses this project as the root (avoid picking up other lockfiles)
  turbopack: {
    root: __dirname,
  },
  // Allow dev assets to be requested from these origins (fixes cross-origin dev warnings)
  allowedDevOrigins: [
    "localhost:3000",
    "127.0.0.1:3000",
    "192.168.87.250:3000",
    "172.17.0.165:3000",
  ],
};

export default nextConfig;
