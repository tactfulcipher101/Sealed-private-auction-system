import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "next/dist/compiled/buffer": "buffer",
    },
  },
};

export default nextConfig;
