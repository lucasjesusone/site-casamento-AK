import Fastify from 'fastify';
import cors from '@fastify/cors';

const app = Fastify({
  logger: true
});

async function start() {
  await app.register(cors, {
    origin: true
  });

  app.get('/api/health', async () => {
    return {
      status: 'UP',
      message: 'Backend do casamento funcionando ❤️❤️'
    };
  });

  await app.listen({
    port: 3000,
    host: '0.0.0.0'
  });
}

void start();