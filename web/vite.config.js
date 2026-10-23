import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxy = {
  '/api': 'http://127.0.0.1:4000',
  '/collages': 'http://127.0.0.1:4000',
};

// Cloudflare quick tunnels (*.trycloudflare.com) are allowed so the demo can be shared.
const allowedHosts = ['.trycloudflare.com'];

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy, allowedHosts },
  preview: { port: 4173, proxy, allowedHosts },
});
