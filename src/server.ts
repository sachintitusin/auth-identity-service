import 'dotenv/config';
import { app } from './app';
import { env } from './env';

const server = app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // safety fallback (force exit)
  setTimeout(() => {
    console.error('Forcing shutdown');
    process.exit(1);
  }, 10_000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);