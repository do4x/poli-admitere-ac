import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "shiki"],
  experimental: {
    serverActions: {
      // Scanned handwritten solutions are multi-MB; default 1 MB is too small.
      bodySizeLimit: "50mb",
    },
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // data/ (SQLite + PDFs) and tool-generated logs would otherwise
      // trigger rebuilds; .playwright-mcp even feeds back into itself.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**",
          "**/data/**",
          "**/.playwright-mcp/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
