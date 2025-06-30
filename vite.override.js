// Vite configuration override for host allowlist
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    allowedHosts: 'all',
  }
});