import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@collm/types", "@collm/database"],
};

export default nextConfig;
