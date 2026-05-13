import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3100",
        rewrite: (path) => path.replace(/^\/api/, ""),
        changeOrigin: true,
      },
      "/r/": {
        target: "http://localhost:3100",
        changeOrigin: true,
      },
    },
  },
})
