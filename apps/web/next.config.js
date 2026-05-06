/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
    domains: [
      "media.blessedave.com",
      "images.unsplash.com",
      "plus.unsplash.com",
    ],
  },
};

module.exports = nextConfig;
