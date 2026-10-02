import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()], build: { outDir: "dist/client", target: "es2022", rollupOptions: { input: { app: "index.html", background: "background.html" } } } });
