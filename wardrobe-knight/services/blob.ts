import { put, list } from '@vercel/blob';

/** Return the public URL of an already-stored blob at this path, or null. */
export async function findBlob(filename: string): Promise<string | null> {
  const pathname = `wardrobe-knight/${filename}`;
  const { blobs } = await list({ prefix: pathname, limit: 1 });
  const hit = blobs.find((b) => b.pathname === pathname);
  return hit ? hit.url : null;
}

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
    addRandomSuffix: false,
    allowOverwrite: true,
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
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return blob.url;
}
