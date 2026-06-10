import type { Request, Response } from 'express';
import { receiver } from '../../bot/app.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: Request, res: Response): Promise<void> {
  // Slack retries if no 200 within 3s — ignore retries to prevent duplicate processing
  if (req.headers['x-slack-retry-num']) {
    res.status(200).json({ ok: true });
    return;
  }
  await receiver.app(req, res);
}
