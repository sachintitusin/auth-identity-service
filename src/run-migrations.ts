import fs from 'fs';
import path from 'path';
import { pool } from './db';

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log('Running migrations:', files);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`→ ${file}`);
    await pool.query(sql);
  }

  console.log('All migrations completed');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed', err);
  process.exit(1);
});
