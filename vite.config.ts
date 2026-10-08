import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss()
  ],
  resolve: {
    alias: {
      // Maps '@/' directly to your 'src' folder for cleaner import paths
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    // 🚀 FIXED: Added proxy route maps to cleanly forward all frontend api calls to Express (Port 5000)
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
    // Restores default file-watching mechanics so Tailwind builds your high-density utilities locally
    watch: {
      usePolling: true,
    }
  }
});