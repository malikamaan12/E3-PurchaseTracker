import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable strict mode in dev to prevent double-rendering every component
  reactStrictMode: false,
  
  // Reduce noisy fetch logging in dev server output
  logging: {
    fetches: {
      fullUrl: false,
    },
  },

  serverExternalPackages: [
    "office-to-pdf", 
    "html-pdf-node", 
    "sharp", 
    "passport",
    "bcryptjs"
  ],
};

export default nextConfig;
