/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NOTE: no `output: 'standalone'` — unsupported by Netlify's OpenNext adapter
  // PWA offline caching is handled by the hand-written service worker in public/sw.js
};

module.exports = nextConfig;
