import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Test settings, on top of the app's Vite settings (so tests build the app the same way).
export default mergeConfig(
  viteConfig,
  defineConfig({
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
  }),
)
