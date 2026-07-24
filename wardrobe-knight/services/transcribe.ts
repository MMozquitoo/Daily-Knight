/**
 * Voice note transcription — Whisper via Replicate.
 *
 * Slack voice clips arrive as private files the transcription model can't fetch
 * (they need the bot token), so the audio is parked on Vercel Blob just long
 * enough for Whisper to read it, then deleted.
 */

import Replicate from 'replicate';
import { del } from '@vercel/blob';
import { uploadImageBuffer } from './blob.js';

let client: Replicate | null = null;

function getClient(): Replicate {
  if (!client) {
    client = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  }
  return client;
}

const EXT_BY_MIME: Record<string, string> = {
  'audio/mp4': 'mp4',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
};

/** Transcribe an audio buffer to plain text. Returns null when it can't. */
export async function transcribeAudio(buffer: Buffer, mimetype: string): Promise<string | null> {
  if (!process.env.REPLICATE_API_TOKEN) return null;

  // Slack sometimes appends ";codecs=…" — Blob and Whisper only want the base type
  const baseMime = mimetype.split(';')[0].trim();
  const ext = EXT_BY_MIME[baseMime] ?? 'mp4';
  const path = `voice/${Date.now()}.${ext}`;

  const url = await uploadImageBuffer(buffer, path, baseMime);
  try {
    const output = await getClient().run('openai/whisper', {
      input: {
        audio: url,
        model: 'large-v3',
        transcription: 'plain text',
        translate: false,
      },
    }) as any;

    const text = typeof output === 'string'
      ? output
      : output?.transcription ?? output?.text ?? null;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  } finally {
    await del(url).catch(() => {});
  }
}
