import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // SWOS is a local-first dashboard; server actions and API routes talk to
  // the local filesystem (.swos-data). Nothing here should be deployed
  // publicly without adding auth.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
