import { createServer } from 'node:http';
import { loadAiConfig } from './ai/config.js';
import { createHandler } from './http.js';

try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const server = createServer(createHandler(loadAiConfig()));
server.listen(8787, '127.0.0.1', () =>
  console.info('Seite API: http://127.0.0.1:8787 (local access only)'),
);
