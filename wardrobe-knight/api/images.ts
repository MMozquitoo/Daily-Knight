import type { Request, Response } from 'express';
import { verifyFileUrl } from './_sign.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: Request, res: Response): Promise<void> {
  const fileUrl = req.query.url as string | undefined;
  if (!fileUrl || !fileUrl.startsWith('https://files.slack.com/')) {
    res.status(400).json({ error: 'Missing or invalid url parameter' });
    return;
  }

  // Only serve URLs the bot itself signed. Without this, anyone who sees one proxy
  // link can swap the url param and pull any other private workspace file, because
  // we fetch it with the bot token on their behalf.
  if (!verifyFileUrl(fileUrl, req.query.sig as string | undefined)) {
    res.status(403).json({ error: 'Invalid or missing signature' });
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
