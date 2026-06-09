import type { Request, Response } from 'express';
import { receiver } from '../../bot/app.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: Request, res: Response): Promise<void> {
  await receiver.app(req, res);
}
