import type { NextConfig } from "next";

// Pitchborn is a fully client-side game: a static export can be hosted for free anywhere.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
