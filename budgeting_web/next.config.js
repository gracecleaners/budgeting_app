const withPWA = require("next-pwa")({
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/.*api.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
  disable: process.env.DISABLE_PWA === "1",
  publicExcludes: ["icons/**/*", "sw.js"],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
};

module.exports = withPWA(nextConfig);
