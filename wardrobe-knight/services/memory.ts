import { google } from 'googleapis';
import { getGoogleServiceAccount, getRequiredEnv } from './env.js';

const MEMORY_SHEET = 'Mémoire';
const MEMORY_RANGE = `${MEMORY_SHEET}!A:F`;

export interface MemoryEntry {
  date: string;
  userId: string;
  type: 'preference' | 'suggestion' | 'observation' | 'joke';
  content: string;
  followUpDate?: string;
  done: boolean;
  rowIndex?: number;
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: getGoogleServiceAccount(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

function sheetId(): string {
  return getRequiredEnv('GOOGLE_SHEET_ID');
}

async function ensureMemorySheet(): Promise<void> {
  const sheets = getSheets();
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId(),
      requestBody: {
        requests: [{ addSheet: { properties: { title: MEMORY_SHEET } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId(),
      range: `${MEMORY_SHEET}!A1:F1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['Date', 'UserId', 'Type', 'Content', 'FollowUpDate', 'Done']],
      },
    });
  } catch (err: any) {
    if (err?.message?.includes('already exists')) return;
    throw err;
  }
}

export async function saveMemory(
  userId: string,
  type: MemoryEntry['type'],
  content: string,
  followUpDate?: string,
): Promise<void> {
  await ensureMemorySheet();
  const sheets = getSheets();
  const date = new Date().toISOString().slice(0, 10);
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: MEMORY_RANGE,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[date, userId, type, content, followUpDate ?? '', 'FALSE']],
    },
  });
}

export async function getMemories(userId: string, limit = 50): Promise<MemoryEntry[]> {
  await ensureMemorySheet();
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: MEMORY_RANGE,
  });

  const rows = res.data.values ?? [];
  return rows
    .slice(1)
    .map((row, i) => ({
      date: row[0] ?? '',
      userId: row[1] ?? '',
      type: (row[2] ?? 'observation') as MemoryEntry['type'],
      content: row[3] ?? '',
      followUpDate: row[4] || undefined,
      done: row[5] === 'TRUE',
      rowIndex: i + 2,
    }))
    .filter((m) => m.userId === userId)
    .slice(-limit);
}

export async function getPendingFollowUps(userId: string): Promise<MemoryEntry[]> {
  const memories = await getMemories(userId);
  const today = new Date().toISOString().slice(0, 10);
  return memories.filter(
    (m) => m.followUpDate && m.followUpDate <= today && !m.done,
  );
}

export async function markDone(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId(),
    range: `${MEMORY_SHEET}!F${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['TRUE']] },
  });
}

export async function deleteMemory(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  const spreadsheetId = sheetId();

  const sheetMeta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  });
  const sheet = sheetMeta.data.sheets?.find((s) => s.properties?.title === MEMORY_SHEET);
  if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1,
            endIndex: rowIndex,
          },
        },
      }],
    },
  });
}
