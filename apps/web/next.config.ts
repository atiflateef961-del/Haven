import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let browsers on a private LAN load the dev client via the machine's LAN IP.
  allowedDevOrigins: ["192.168.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
