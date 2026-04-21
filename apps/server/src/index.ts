import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { migrate } from './db.js';
import { registerRoutes } from './routes.js';
import { HOST, PORT, ensureDirs } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  ensureDirs();
  migrate();

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await registerRoutes(app);

  const webDist = path.resolve(__dirname, '..', '..', 'web', 'dist');
  if (fs.existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist, prefix: '/' });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) {
        reply.code(404).send({ error: 'not found' });
        return;
      }
      reply.sendFile('index.html');
    });
  }

  try {
    await app.listen({ port: PORT, host: HOST });
    const url = `http://${HOST}:${PORT}`;
    app.log.info(`agbook server ready at ${url}`);
    // Machine-readable ready marker consumed by the Tauri sidecar host.
    // Keep this line format stable — the desktop Rust code greps for it.
    process.stdout.write(`AGBOOK_READY_URL=${url}\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

function shutdown() {
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main();
