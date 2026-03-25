import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'sosit-txartela.net',
        pathname: '/demonline/**',
      },
    ],
  },
  // Allow serving from subdirectory on Vercel
  trailingSlash: false,
};

export default nextConfig;
