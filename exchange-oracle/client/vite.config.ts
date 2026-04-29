/// <reference types="vite/client" />

import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: [{ find: "src", replacement: path.resolve(__dirname, "src") }],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
  server: {
    port: 3003,
  },
});
