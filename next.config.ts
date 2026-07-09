import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "shiki"],
  experimental: {
    serverActions: {
      // Scanned handwritten solutions are multi-MB; default 1 MB is too small.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
