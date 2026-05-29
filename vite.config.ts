import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.join(process.cwd(), 'data'), '');
  const serverPort = Number(env['PORT'] ?? 3000);
  const frontendPort = Number(env['FRONTEND_PORT'] ?? 5173);
  const apiTarget = `http://localhost:${serverPort}`;

  return {
    plugins: [react()],
    root: 'src/frontend',
    build: {
      outDir: '../../dist/frontend',
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/frontend'),
        '@shared': path.resolve(__dirname, 'shared'),
      },
    },
    server: {
      port: frontendPort,
      strictPort: true,
      fs: {
        allow: [path.resolve(__dirname, '.'), path.resolve(__dirname, 'shared')],
      },
      proxy: {
        '/api': apiTarget,
        '/events': apiTarget,
        '/profiles': apiTarget,
      },
    },
  };
});
