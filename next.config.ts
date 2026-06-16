import type { NextConfig } from "next";

const serverlessTraceExcludes = [
  "./download/**/*",
  "./upload/**/*",
  "./uploads/**/*",
  "./db/**/*",
  "./dist/**/*",
  "./reports/**/*",
  "./production-ready/**/*",
  "./skills/**/*",
  "./ml-pipeline/**/*",
  "./microservices/**/*",
  "./mini-services/**/*",
  "./models/**/*",
  "./grafana/**/*",
  "./helm/**/*",
  "./kafka/**/*",
  "./kubernetes/**/*",
  "./load-tests/**/*",
  "./observability/**/*",
  "./prometheus/**/*",
  "./schema-registry/**/*",
  "./systemd/**/*",
  "./wallet-payment/**/*",
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "/api/onboarding/shipper": serverlessTraceExcludes,
    "/api/onboarding/transporter": serverlessTraceExcludes,
    "/api/verification/ocr/extract": serverlessTraceExcludes,
    "/api/verification/submit": serverlessTraceExcludes,
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
