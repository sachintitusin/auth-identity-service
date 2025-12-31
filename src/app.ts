import express from 'express';
import { errorHandler } from './error-handler';

export const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});


app.use(errorHandler);