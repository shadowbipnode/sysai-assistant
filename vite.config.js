import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Base path: relativo per file:// in Electron
  base: './',
  build: {
    outDir: 'dist',
    // Ottimizzazioni per ridurre il peso
    rollupOptions: {
      output: {
        manualChunks: undefined, // Bundle singolo per Electron
      },
    },
    // Source maps solo in dev
    sourcemap: process.env.NODE_ENV === 'development',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
