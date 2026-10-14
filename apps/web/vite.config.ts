import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // En desarrollo la API corre aparte; en producción (Railway) la API sirve este build.
    proxy: { "/api": "http://localhost:3000" },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: { react: ["react", "react-dom", "@tanstack/react-query"], charts: ["recharts"] },
      },
    },
  },
});
