/**
 * Google Sheets Service — API v4
 *
 * CRUD operations on the "Armoire" sheet.
 * Each row maps to a ClothingItem (15 columns A–O).
 *
 * Columns: ID | Catégorie | Sous-catégorie | Marque | Modèle
 *          Couleur | Palette | Matière | Coupe | Niveau
 *          Saison | Formalité | Impact | Polyvalence | État
 */

import { google } from 'googleapis';
import type { ClothingItem } from '../types/wardrobe.js';
import { CATEGORY_PREFIXES } from '../types/wardrobe.js';
import { getGoogleServiceAccount, getRequiredEnv } from './env.js';

const SHEET_NAME = 'Armoire';
const RANGE = `${SHEET_NAME}!A:P`; // 16 columns A–P (P = image URL)
const HISTORY_SHEET = 'Historique';
const HISTORY_RANGE = `${HISTORY_SHEET}!A:E`; // Date | Top | Bottom | Shoes | Outerwear

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

/** Parse a sheet row (string[]) into a ClothingItem */
function rowToItem(row: string[]): ClothingItem {
  return {
    id: row[0] ?? '',
    categorie: row[1] ?? '',
    sousCategorie: row[2] ?? '',
    marque: row[3] ?? '',
    modele: row[4] ?? '',
    couleur: row[5] ?? '',
    palette: (row[6] ?? 'neutre') as ClothingItem['palette'],
    matiere: row[7] ?? '',
    coupe: row[8] ?? '',
    niveau: row[9] ?? '',
    saison: row[10] ?? 'toutes',
    formalite: parseInt(row[11] ?? '3', 10) || 3,
    impact: parseInt(row[12] ?? '3', 10) || 3,
    polyvalence: parseInt(row[13] ?? '3', 10) || 3,
    etat: (row[14] ?? 'bon') as ClothingItem['etat'],
    imageUrl: row[15] || undefined,
  };
}

/** Convert a ClothingItem to a sheet row (string[]) */
function itemToRow(item: ClothingItem): string[] {
  return [
    item.id,
    item.categorie,
    item.sousCategorie,
    item.marque,
    item.modele,
    item.couleur,
    item.palette,
    item.matiere,
    item.coupe,
    item.niveau,
    item.saison,
    item.formalite.toString(),
    item.impact.toString(),
    item.polyvalence.toString(),
    item.etat,
    item.imageUrl ?? '',
  ];
}

/** Read all items from the sheet */
export async function getAll(): Promise<ClothingItem[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: RANGE,
  });

  const rows = res.data.values ?? [];
  // Skip header row
  return rows.slice(1).filter((row) => row[0]).map(rowToItem);
}

/** Get a single item by ID */
export async function getById(id: string): Promise<ClothingItem | undefined> {
  const items = await getAll();
  return items.find((item) => item.id === id);
}

/** Generate the next ID for a given category name */
export async function generateId(categorie: string): Promise<string> {
  const prefix = CATEGORY_PREFIXES[categorie.toLowerCase()] ?? 'XX';
  const items = await getAll();
  const existing = items
    .filter((item) => item.id.startsWith(prefix + '-'))
    .map((item) => parseInt(item.id.split('-')[1] ?? '0', 10))
    .filter((n) => !isNaN(n));

  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}-${next.toString().padStart(2, '0')}`;
}

/** Append a new item to the sheet */
export async function append(item: ClothingItem): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: RANGE,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [itemToRow(item)],
    },
  });
}

/** Update an existing item by ID (finds row, overwrites) */
export async function update(id: string, fields: Partial<ClothingItem>): Promise<boolean> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: RANGE,
  });

  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === id);
  if (rowIndex === -1) return false;

  const current = rowToItem(rows[rowIndex]);
  const updated = { ...current, ...fields };
  const rowNumber = rowIndex + 1; // 1-based for Sheets API

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId(),
    range: `${SHEET_NAME}!A${rowNumber}:P${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [itemToRow(updated)],
    },
  });

  return true;
}

/** Delete an item by ID (finds row, deletes it) */
export async function deleteById(id: string): Promise<boolean> {
  const sheets = getSheets();
  const spreadsheetId = sheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: RANGE,
  });

  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === id);
  if (rowIndex === -1) return false;

  const sheetMeta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  });
  const sheet = sheetMeta.data.sheets?.find((s) => s.properties?.title === SHEET_NAME);
  if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });

  return true;
}

// ---------------------------------------------------------------------------
// Worn History ("Historique" tab)
// ---------------------------------------------------------------------------

export interface WornEntry {
  date: string;
  top?: string;
  bottom?: string;
  shoes?: string;
  outerwear?: string;
}

async function ensureHistorySheet(): Promise<void> {
  const sheets = getSheets();
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId(),
      requestBody: {
        requests: [{ addSheet: { properties: { title: HISTORY_SHEET } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId(),
      range: `${HISTORY_SHEET}!A1:E1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['Date', 'Top', 'Bottom', 'Shoes', 'Outerwear']] },
    });
  } catch (err: any) {
    if (err?.message?.includes('already exists')) return;
    throw err;
  }
}

/** Log an outfit as worn on a given date */
export async function logWorn(
  date: string,
  itemIds: { top?: string; bottom?: string; shoes?: string; outerwear?: string },
): Promise<void> {
  await ensureHistorySheet();
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: HISTORY_RANGE,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[date, itemIds.top ?? '', itemIds.bottom ?? '', itemIds.shoes ?? '', itemIds.outerwear ?? '']],
    },
  });
}

/** Get worn history for the last N days */
export async function getWornRecently(days: number = 7): Promise<WornEntry[]> {
  await ensureHistorySheet();
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: HISTORY_RANGE,
  });

  const rows = res.data.values ?? [];
  if (rows.length <= 1) return [];

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return rows
    .slice(1)
    .filter((row) => row[0] && row[0] >= cutoffStr)
    .map((row) => ({
      date: row[0],
      top: row[1] || undefined,
      bottom: row[2] || undefined,
      shoes: row[3] || undefined,
      outerwear: row[4] || undefined,
    }));
}
