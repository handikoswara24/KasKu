import type { NextConfig } from "next";

const allowedDevOrigins = [
  "*.run.app",
  "*.aistudio.google.com",
  "localhost",
  "127.0.0.1",
];

if (process.env.APP_URL) {
  try {
    const host = new URL(process.env.APP_URL).hostname;
    if (host && !allowedDevOrigins.includes(host)) {
      allowedDevOrigins.push(host);
    }
  } catch {
    // Ignore invalid APP_URL placeholder
  }
}

const nextConfig: NextConfig = {
  allowedDevOrigins,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
