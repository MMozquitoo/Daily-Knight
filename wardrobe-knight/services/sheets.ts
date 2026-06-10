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
