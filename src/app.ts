import express from 'express';
import morgan from 'morgan';
import { pool } from './db';
import { requestIdMiddleware } from './request-id';
import { errorHandler } from './error-handler';

import { register } from './auth.register';
import { validateBody } from './middleware/validate';
import { registerSchema } from './schemas/register.schema';

export const app = express();

app.use(express.json());
app.use(requestIdMiddleware);

morgan.token('request-id', (req) => (req as any).requestId);

app.use(
  morgan(':method :url :status :response-time ms - reqId=:request-id')
);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/health/db', async (_req, res, next) => {
  try {
    await pool.query('select 1');
    res.status(200).json({ status: 'ok', db: 'up' });
  } catch (err) {
    next(err);
  }
});

app.post('/auth/register', validateBody(registerSchema), register);


app.use(errorHandler);