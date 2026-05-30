import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/index.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith(".css") ? "assets/index.css" : "assets/[name]-[hash][extname]"
      }
    }
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787"
    }
  }
});
