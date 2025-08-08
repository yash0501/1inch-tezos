// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_RESOLVER_ENDPOINT: process.env.NEXT_PUBLIC_RESOLVER_ENDPOINT || 'http://localhost:3001',
  },
  webpack: (config, { isServer }) => {
    // Handle Node.js modules and polyfills
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        buffer: require.resolve("buffer/"),
        process: require.resolve("process/browser"),
        fs: false,
        net: false,
        tls: false,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        util: require.resolve('util/'),
        url: require.resolve('url/'),
        assert: require.resolve('assert/'),
      };
    }

    // Ignore pino-pretty in client-side bundles
    config.resolve.alias = {
      ...config.resolve.alias,
      'pino-pretty': false,
    };

    // Add externals for server-side
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('pino-pretty');
    }

    return config;
  },
};

module.exports = nextConfig;