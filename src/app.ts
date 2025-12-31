import express from 'express';
import morgan from 'morgan';
import { pool } from './db';
import { requestIdMiddleware } from './request-id';
import { errorHandler } from './error-handler';

export const app = express();

app.use(express.json());
app.use(requestIdMiddleware);
app.use(morgan('dev'));

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


app.use(errorHandler);