import 'dotenv/config';
import { app } from './app';
import { env } from './env';
import { checkDbConnection } from './db';

let server: ReturnType<typeof app.listen>;

async function start() {
  // 1. Verify critical dependencies BEFORE listening
  await checkDbConnection();

  // 2. Start accepting traffic only after DB is ready
  server = app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
  });
}

// 3. Centralized startup error handling
start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  if (!server) {
    process.exit(0);
  }

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // 4. Safety fallback
  setTimeout(() => {
    console.error('Forcing shutdown');
    process.exit(1);
  }, 10_000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
