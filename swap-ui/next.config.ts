import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      buffer: require.resolve("buffer/"),
      process: require.resolve("process/browser"),
    };
    return config;
  },
};

export default nextConfig;
