import type { Request, Response } from 'express';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: Request, res: Response): Promise<void> {
  const fileUrl = req.query.url as string | undefined;
  if (!fileUrl || !fileUrl.startsWith('https://files.slack.com/')) {
    res.status(400).json({ error: 'Missing or invalid url parameter' });
    return;
  }

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'Bot token not configured' });
    return;
  }

  const upstream = await fetch(fileUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!upstream.ok) {
    res.status(upstream.status).json({ error: 'Failed to fetch image from Slack' });
    return;
  }

  const contentType = upstream.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await upstream.arrayBuffer());

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.status(200).send(buffer);
}
