import { google } from 'googleapis';
import { Readable } from 'stream';
import { getGoogleServiceAccount } from './env.js';

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: getGoogleServiceAccount(),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() });
}

const FOLDER_NAME = 'Wardrobe Knight Photos';
let folderId: string | null = null;

async function getOrCreateFolder(): Promise<string> {
  if (folderId) return folderId;

  const drive = getDrive();
  const res = await drive.files.list({
    q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });

  if (res.data.files?.length) {
    folderId = res.data.files[0].id!;
    return folderId;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  folderId = folder.data.id!;

  // Make folder publicly readable
  await drive.permissions.create({
    fileId: folderId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return folderId;
}

export async function uploadImage(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const drive = getDrive();
  const parentId = await getOrCreateFolder();

  const file = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [parentId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id',
  });

  const fileId = file.data.id!;

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return `https://drive.google.com/uc?id=${fileId}`;
}
