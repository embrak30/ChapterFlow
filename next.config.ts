import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: { serverActions: { bodySizeLimit: "25mb" } }
};

export default nextConfig;
