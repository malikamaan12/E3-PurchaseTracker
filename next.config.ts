import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "office-to-pdf", 
    "html-pdf-node", 
    "sharp", 
    "pg", 
    "passport"
  ],
};

export default nextConfig;
