import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@openfeedback/react", "@openfeedback/client"],
};

export default nextConfig;
