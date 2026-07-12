import type { NextConfig } from "next";
import { readFileSync } from "fs";
import "dotenv/config";

const version = readFileSync("VERSION", "utf-8").trim();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_DEMO_READ_ONLY: process.env.DEMO_READ_ONLY ?? "true",
  },
};

export default nextConfig;
