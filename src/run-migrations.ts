import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from './db';

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log('Migrations found:', files);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    // 1️⃣ Bootstrap migration — ALWAYS run
    if (file === '000_schema_migrations.sql') {
      console.log(`→ Running ${file} (bootstrap)`);
      await pool.query(sql);
      continue;
    }

    // 2️⃣ Check if migration already ran
    const alreadyRun = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE filename = $1',
      [file]
    );

    if (alreadyRun.rowCount) {
      console.log(`↷ Skipping ${file} (already applied)`);
      continue;
    }

    // 3️⃣ Run migration transactionally
    console.log(`→ Running ${file}`);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [file]
      );
      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  }

  console.log('Migrations complete');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed', err);
  process.exit(1);
});
