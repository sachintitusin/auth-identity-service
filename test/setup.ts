import 'dotenv/config';

import { pool } from '../src/db';

beforeEach(async () => {
  await pool.query(`
    TRUNCATE TABLE
      refresh_tokens,
      sessions,
      verifications,
      password_credentials,
      credentials,
      identity_identifiers,
      identities
    RESTART IDENTITY CASCADE
  `);
});