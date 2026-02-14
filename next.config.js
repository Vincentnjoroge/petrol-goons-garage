const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com', 'platform-lookaside.fbsbx.com'],
  },
  eslint: {
    // ESLint 9 + Next.js FlatCompat has a known circular reference serialization warning
    // Linting still works via `npm run lint` - this just prevents the build warning
    ignoreDuringBuilds: true,
  },
  outputFileTracingRoot: path.join(__dirname),
}

module.exports = nextConfig
