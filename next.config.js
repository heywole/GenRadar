/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }]
  },
  experimental: {
    serverComponentsExternalPackages: ['genlayer-js']
  }
}
module.exports = nextConfig
