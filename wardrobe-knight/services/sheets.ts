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
import { daysAgo } from './dates.js';

const SHEET_NAME = 'Armoire';
const RANGE = `${SHEET_NAME}!A:R`; // 18 columns A–R (P = image URL, Q = try-on URL, R = product image URL)
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
    tryonUrl: row[16] || undefined,
    productUrl: row[17] || undefined,
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
    item.tryonUrl ?? '',
    item.productUrl ?? '',
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

/**
 * Serialise every read-modify-write against the sheet.
 *
 * append() and update() each read the sheet, compute a row, then write it back.
 * Run two concurrently and they interleave: two appends compute the same next row
 * (or the same generated ID) and one garment vanishes; two updates to different
 * columns of the same item both read first, and the last write silently discards
 * the other's column. Both were reproduced. Chaining through one promise makes the
 * sequence atomic within this process — which is where the concurrency actually
 * happens (two quick "ajoute" photos, or a tryon and a product-image write racing
 * inside the same handler).
 */
let writeChain: Promise<unknown> = Promise.resolve();
function serialise<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task, task);
  // Keep the chain alive even if a task rejects, without unhandled-rejection noise
  writeChain = run.then(() => undefined, () => undefined);
  return run;
}

/**
 * Create an item, assigning its ID atomically.
 *
 * generateId() and append() as two separate calls let two concurrent "ajoute"
 * photos both read max=JE-02, both mint JE-03, and both append — a duplicate ID,
 * after which getById/update silently hit only the first row. Assigning the ID
 * inside the same locked section as the append closes that window.
 */
export async function createItem(item: Omit<ClothingItem, 'id'>): Promise<string> {
  return serialise(async () => {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId(),
      range: RANGE,
    });
    const rows = res.data.values ?? [];

    const prefix = CATEGORY_PREFIXES[item.categorie.toLowerCase()] ?? 'XX';
    const used = rows
      .slice(1)
      .map((row) => row[0] as string)
      .filter((id) => id?.startsWith(prefix + '-'))
      .map((id) => parseInt(id.split('-')[1] ?? '0', 10))
      .filter((n) => !isNaN(n));
    const id = `${prefix}-${(used.length ? Math.max(...used) + 1 : 1).toString().padStart(2, '0')}`;

    const nextRow = rows.length + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId(),
      range: `${SHEET_NAME}!A${nextRow}:R${nextRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [itemToRow({ ...item, id } as ClothingItem)] },
    });
    return id;
  });
}

/** Append a new item to the sheet */
export async function append(item: ClothingItem): Promise<void> {
  return serialise(async () => {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId(),
      range: `${SHEET_NAME}!A:A`,
    });
    const nextRow = (res.data.values?.length ?? 1) + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId(),
      range: `${SHEET_NAME}!A${nextRow}:R${nextRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [itemToRow(item)],
      },
    });
  });
}

/** Update an existing item by ID (finds row, overwrites) */
export async function update(id: string, fields: Partial<ClothingItem>): Promise<boolean> {
  return serialise(async () => {
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
      range: `${SHEET_NAME}!A${rowNumber}:R${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [itemToRow(updated)],
      },
    });

    return true;
  });
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

// The history tab is created once; after that this always threw "already exists"
// and swallowed it — a wasted round-trip on every logWorn AND getWornRecently, so
// two per /outfit, straight onto the 3s Slack budget. Remember it exists.
let historySheetReady = false;

async function ensureHistorySheet(): Promise<void> {
  if (historySheetReady) return;
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
    historySheetReady = true;
  } catch (err: any) {
    if (err?.message?.includes('already exists')) {
      historySheetReady = true;
      return;
    }
    throw err;
  }
}

/** Log an outfit as worn on a given date */
export async function logWorn(
  date: string,
  itemIds: { top?: string; bottom?: string; shoes?: string; outerwear?: string },
): Promise<void> {
  await ensureHistorySheet();
  return serialise(async () => {
    const sheets = getSheets();
    const row = [date, itemIds.top ?? '', itemIds.bottom ?? '', itemIds.shoes ?? '', itemIds.outerwear ?? ''];

    // Upsert on date. logWorn fires on every /outfit AND every "regenerate"/"more
    // formal" click, so appending would write a fresh "worn today" row per click —
    // browsing four alternatives then puts a dozen never-worn items on cooldown.
    // One row per day, overwritten, keeps the record to the outfit last shown.
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId(),
      range: HISTORY_RANGE,
    });
    const rows = res.data.values ?? [];
    const existing = rows.findIndex((r, i) => i > 0 && r[0] === date);

    if (existing >= 0) {
      const rowNumber = existing + 1; // 1-based
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId(),
        range: `${HISTORY_SHEET}!A${rowNumber}:E${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId(),
        range: HISTORY_RANGE,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] },
      });
    }
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

  // The log stores Europe/Paris dates, so the window has to be measured the same
  // way — a UTC cutoff would slip the 7-day edge by a day around midnight.
  return rows
    .slice(1)
    .filter((row) => row[0] && daysAgo(row[0]) <= days)
    .map((row) => ({
      date: row[0],
      top: row[1] || undefined,
      bottom: row[2] || undefined,
      shoes: row[3] || undefined,
      outerwear: row[4] || undefined,
    }));
}
