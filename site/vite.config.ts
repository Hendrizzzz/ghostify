import { copyFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, searchForWorkspaceRoot, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const statusSource = resolve(process.cwd(), 'src/app/statusData.json');

function publicStatusFeed(): Plugin {
  return {
    name: 'ghostify-public-status-feed',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/status.json') {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Cache-Control', 'no-store');
        response.end(readFileSync(statusSource));
      });
    },
    closeBundle() {
      copyFileSync(statusSource, resolve(process.cwd(), 'dist/status.json'));
    },
  };
}

export default defineConfig({
  publicDir: 'public',
  plugins: [react(), publicStatusFeed()],
  server: {
    fs: {
      // The landing page embeds the shipped popup markup and styles 1:1.
      allow: [searchForWorkspaceRoot(process.cwd()), resolve(process.cwd(), '../dist')],
    },
  },
});
