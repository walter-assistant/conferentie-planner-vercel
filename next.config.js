const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  outputFileTracingRoot: path.join(__dirname),
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
