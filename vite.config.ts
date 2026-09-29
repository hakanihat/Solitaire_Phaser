/// <reference types="vitest" />
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  base: "./",
  build: {
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Keep the engine in its own long-cacheable chunk.
        manualChunks: { phaser: ["phaser"] },
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "./assets/img/cards2.png", dest: "./assets/img" },
        { src: "./assets/sfx/*", dest: "./assets/sfx" },
        { src: "./assets/fonts/*", dest: "./assets/fonts" },
      ],
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
