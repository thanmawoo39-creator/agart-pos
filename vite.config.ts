import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

/// <reference types="vitest" />
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
  plugins: [
    react(),
    runtimeErrorOverlay(),
    /* VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'favicon.ico'],
      manifest: {
        name: 'AgartPOS - Catering & Delivery',
        short_name: 'AgartPOS',
        description: 'Point of Sale system for restaurants and catering',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: "Rider App",
            short_name: "Rider",
            description: "Delivery Rider Dashboard",
            url: "/delivery",
            icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }]
          },
          {
            name: "Online Ordering",
            short_name: "Order",
            description: "Customer Online Menu",
            url: "/lunch-menu",
            icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }]
          },
          {
            name: "Kitchen View",
            short_name: "Kitchen",
            description: "Kitchen Display System",
            url: "/kitchen",
            icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**//*.{js,css,html,ico,png,svg,woff,woff2}'],
    // Increase cache size limit to 5MB for large bundle
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/api\.qrserver\.com\/.//i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'qr-cache',
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
          }
        }
      }
    ]
  }
}), */
    // Replit plugins removed for Koyeb deployment compatibility (avoids top-level await)
    // ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined ? ... : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000, // Increase warning threshold to 1000kb
    rollupOptions: {
      output: {
        manualChunks: {
          // Group React core together to avoid circular dependencies
          'react-vendor': ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'scheduler'],
          'query-vendor': ['@tanstack/react-query'],
          'ui-vendor': ['framer-motion', 'lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs', '@radix-ui/react-select'],
          'map-vendor': ['leaflet', 'react-leaflet'],
          'chart-vendor': ['recharts'],
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/qrcodes': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
    fs: {
      strict: false,
    },
    hmr: {
      overlay: false,
    },
  },
});
