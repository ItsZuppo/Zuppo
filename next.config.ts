import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LAN access from mobile/other devices on Wi-Fi without blocking HMR / JavaScript hydration
  allowedDevOrigins: [
    "192.168.100.6",
    "*.local",
  ],
};

export default nextConfig;
