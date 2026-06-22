import { put } from '@vercel/blob';

export async function uploadImageFromUrl(
  sourceUrl: string,
  filename: string,
): Promise<string> {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'image/png';

  const blob = await put(`wardrobe-knight/${filename}`, buffer, {
    access: 'public',
    contentType,
  });

  return blob.url;
}

export async function uploadImageBuffer(
  buffer: Buffer,
  filename: string,
  contentType: string = 'image/png',
): Promise<string> {
  const blob = await put(`wardrobe-knight/${filename}`, buffer, {
    access: 'public',
    contentType,
  });

  return blob.url;
}
