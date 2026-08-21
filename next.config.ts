import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  serverExternalPackages: [
    "@napi-rs/canvas",
    "exceljs",
    "pdfjs-dist",
    "cheerio",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "32mb",
    },
  },
};

export default nextConfig;
