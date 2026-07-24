import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.30.224.1", "192.168.1.224", "192.168.1.*"],
};

export default nextConfig;
