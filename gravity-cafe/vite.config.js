import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  server: { host: "0.0.0.0", allowedHosts: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three/")) return "three";
        },
      },
    },
  },
});
