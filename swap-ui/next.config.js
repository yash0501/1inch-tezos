/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_RESOLVER_ENDPOINT: process.env.NEXT_PUBLIC_RESOLVER_ENDPOINT || 'http://localhost:3001',
  },
}

module.exports = nextConfig
