import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Test-only configuration. The application build keeps using vite.config.mjs;
// this file exists solely so unit tests get a DOM environment and the "@"
// alias for reaching src/ modules from any test location.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    include: ['src/**/*.test.jsx', 'src/**/*.test.js'],
  },
})
