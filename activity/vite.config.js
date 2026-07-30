import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '^/\\.proxy/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/\.proxy/, ''),
      },
      '^/\\.proxy/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        rewrite: (p) => p.replace(/^\/\.proxy/, ''),
      },
    },
  },
});
