/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // Enable static site generation for GitHub Pages
  trailingSlash: true,
  images: {
    unoptimized: true  // Required for GitHub Pages
  },
  basePath: process.env.NODE_ENV === 'production' ? '/sichrplace' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/sichrplace/' : '',
  distDir: 'out'
}

module.exports = nextConfig
