import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    // Explícito a propósito: con el valor por defecto ("localhost"), Node
    // resuelve el nombre a una sola dirección y en Windows suele quedarse
    // con ::1. El navegador entonces busca en 127.0.0.1, no encuentra nada,
    // y devuelve ERR_CONNECTION_REFUSED aunque el servidor esté arriba.
    host: "127.0.0.1",
    port: 5173,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
