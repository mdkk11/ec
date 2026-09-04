import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  typedRoutes: true,
  experimental: {
    appNewScrollHandler: true,
  },
}

export default nextConfig
