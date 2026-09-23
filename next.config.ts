import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API reads the supplied CSVs at runtime; make sure they are shipped with the serverless function.
  outputFileTracingIncludes: {
    "/api/portfolio": ["./data/*.csv"],
  },
};

export default nextConfig;
