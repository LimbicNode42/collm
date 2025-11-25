import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@collm/types", "@collm/database"],
  output: "standalone",
};

export default nextConfig;
