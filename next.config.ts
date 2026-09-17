import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.loca.lt",
    "*.lhr.life",
    "*.serveousercontent.com",
  ],
};

export default nextConfig;
