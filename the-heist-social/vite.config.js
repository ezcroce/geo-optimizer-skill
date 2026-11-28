import { defineConfig } from 'vite';

export default defineConfig({
  // Keep the user-provided stone texture inside the standalone play.html bundle.
  build: { assetsInlineLimit: 48 * 1024 },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    cors: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
