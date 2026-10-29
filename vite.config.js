import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(async ({ command }) => {
  const plugins = [react()];

  // In development, run the PHP API (php -S) next to Vite and proxy to it.
  // The local database and photos live in data/ and uploads/.
  if (command === 'serve') {
    const { startPhpServer } = await import('./scripts/php.mjs');
    plugins.push({
      name: 'tourneur-php-api',
      async configureServer(viteServer) {
        const api = await startPhpServer({ port: 3001, quiet: false, env: { TURNERY_ENV: 'development', TURNERY_DATA_DIR: 'data', TURNERY_UPLOADS_DIR: 'uploads' } });
        console.log('PHP API ready on http://127.0.0.1:3001');
        viteServer.httpServer?.once('close', () => api.stop());
      },
    });
  }

  return {
    plugins,
    server: {
      host: '0.0.0.0',
      port: 7100,
      strictPort: false,
      proxy: {
        '/api': 'http://127.0.0.1:3001',
        '/uploads': 'http://127.0.0.1:3001',
      },
    },
    build: { outDir: 'dist' },
  };
});
