import type { NextConfig } from "next";

// Gli avatar sono serviti dallo Storage di Supabase: next/image accetta host
// remoti solo se dichiarati esplicitamente.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.30.224.1", "192.168.1.224", "192.168.1.*"],
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/avatars/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
