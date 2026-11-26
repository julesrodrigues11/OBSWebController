import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Test settings (kept separate from vite.config.ts, which builds the app).
export default defineConfig({
  plugins: [react()],
  test: {
    // A simulated browser (jsdom) so React components can render and be clicked.
    environment: 'jsdom',
    environmentOptions: {
      // "Visible" page, so features that pause in hidden tabs (the preview) behave normally.
      jsdom: { url: 'http://localhost/', pretendToBeVisual: true },
    },
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Some tests wait for real reconnect delays (1-2 s).
    testTimeout: 15000,
  },
})
