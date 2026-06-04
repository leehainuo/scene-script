import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true, // Allow external access
    open: true, // Auto open browser
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
        ws: true, // WebSocket support
        configure: (proxy) => {
          proxy.on("error", (err) => {
            console.log("❌ Proxy error:", err)
          })
          proxy.on("proxyReq", (_proxyReq, req) => {
            console.log("📤 Proxy request:", req.method, req.url)
          })
          proxy.on("proxyRes", (proxyRes, req) => {
            console.log("📥 Proxy response:", proxyRes.statusCode, req.url)
          })
        },
      },
    },
  },
})
