// Supabase-backed reads/writes for the wardrobe domain. Every query below
// relies on RLS (owner_id = auth.uid()) to scope rows to the signed-in user —
// no explicit owner_id filter is needed on reads. Writes still set owner_id
// explicitly since RLS's `with check` requires it to match auth.uid().

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClothingItem, ItemCondition, PaletteTemp, UsableParis } from '../engine/types/wardrobe';
import type { StyleRule } from '../engine/types/rules';

interface WardrobeItemRow {
  id: string;
  categorie: string;
  sous_categorie: string;
  marque: string | null;
  modele: string | null;
  couleur: string;
  palette: PaletteTemp;
  matiere: string | null;
  coupe: string | null;
  niveau: string | null;
  saison: string;
  formalite: number;
  impact: number;
  polyvalence: number;
  etat: ItemCondition;
  image_url: string | null;
  tryon_url: string | null;
  product_url: string | null;
  origine: string | null;
  usable_paris: UsableParis | null;
}

function rowToClothingItem(row: WardrobeItemRow): ClothingItem {
  return {
    id: row.id,
    categorie: row.categorie,
    sousCategorie: row.sous_categorie,
    marque: row.marque ?? '',
    modele: row.modele ?? '',
    couleur: row.couleur,
    palette: row.palette,
    matiere: row.matiere ?? '',
    coupe: row.coupe ?? '',
    niveau: row.niveau ?? '',
    saison: row.saison,
    formalite: row.formalite,
    impact: row.impact,
    polyvalence: row.polyvalence,
    etat: row.etat,
    imageUrl: row.image_url ?? undefined,
    tryonUrl: row.tryon_url ?? undefined,
    productUrl: row.product_url ?? undefined,
    origine: row.origine ?? undefined,
    usableParis: row.usable_paris ?? undefined,
  };
}

/** Every wardrobe item for the signed-in user, keyed by its ClothingItem shape. */
export async function fetchWardrobeItems(supabase: SupabaseClient): Promise<ClothingItem[]> {
  const { data, error } = await supabase.from('wardrobe_items').select('*');
  if (error) throw error;
  return (data as WardrobeItemRow[]).map(rowToClothingItem);
}

interface StyleRuleRow {
  created_at: string;
  context: StyleRule['context'];
  target: string;
  action: StyleRule['action'];
  color: string | null;
  cut: string | null;
  note: string | null;
}

export async function fetchStyleRules(supabase: SupabaseClient): Promise<StyleRule[]> {
  const { data, error } = await supabase.from('style_rules').select('*');
  if (error) throw error;
  return (data as StyleRuleRow[]).map((row) => ({
    date: row.created_at,
    context: row.context,
    target: row.target,
    action: row.action,
    color: (row.color as StyleRule['color']) ?? undefined,
    cut: row.cut ?? undefined,
    note: row.note ?? undefined,
  }));
}

/** itemId -> days since it was last worn, from worn_history. */
export async function fetchCooldownMap(supabase: SupabaseClient): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('worn_history')
    .select('item_id, date')
    .order('date', { ascending: false });
  if (error) throw error;

  const today = new Date();
  const map = new Map<string, number>();
  for (const row of data as { item_id: string; date: string }[]) {
    if (map.has(row.item_id)) continue; // first hit per item is the most recent, thanks to the order() above
    const worn = new Date(row.date);
    const days = Math.round((today.getTime() - worn.getTime()) / (1000 * 60 * 60 * 24));
    map.set(row.item_id, days);
  }
  return map;
}

/** itemId -> net thumbs up/down votes, from item_feedback. */
export async function fetchFeedbackScores(supabase: SupabaseClient): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('item_feedback').select('item_id, vote');
  if (error) throw error;

  const map = new Map<string, number>();
  for (const row of data as { item_id: string; vote: number }[]) {
    map.set(row.item_id, (map.get(row.item_id) ?? 0) + row.vote);
  }
  return map;
}

/** Records today's picks as worn, for tomorrow's cooldown map. */
export async function recordWornToday(
  supabase: SupabaseClient,
  ownerId: string,
  date: string,
  itemIds: string[],
): Promise<void> {
  const rows = itemIds.map((item_id) => ({ owner_id: ownerId, date, item_id }));
  const { error } = await supabase.from('worn_history').upsert(rows, { onConflict: 'owner_id,date,item_id' });
  if (error) throw error;
}

export interface ProfileRow {
  display_name: string | null;
  latitude: number;
  longitude: number;
}

export async function fetchProfile(supabase: SupabaseClient, ownerId: string): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, latitude, longitude')
    .eq('id', ownerId)
    .single();
  if (error) throw error;
  return data as ProfileRow;
}

export interface PlannedOutfitRow {
  date: string;
  top_item_id: string;
  bottom_item_id: string;
  shoes_item_id: string;
  outerwear_item_id: string | null;
  carry: string[];
  why: string;
  weather: unknown;
  agenda: unknown;
  status: 'proposed' | 'accepted' | 'rejected';
}

export async function fetchPlannedOutfit(supabase: SupabaseClient, date: string): Promise<PlannedOutfitRow | null> {
  const { data, error } = await supabase.from('planned_outfits').select('*').eq('date', date).maybeSingle();
  if (error) throw error;
  return data as PlannedOutfitRow | null;
}

export async function upsertPlannedOutfit(
  supabase: SupabaseClient,
  ownerId: string,
  row: Omit<PlannedOutfitRow, 'status'> & { status?: PlannedOutfitRow['status'] },
): Promise<void> {
  const { error } = await supabase
    .from('planned_outfits')
    .upsert({ owner_id: ownerId, ...row }, { onConflict: 'owner_id,date' });
  if (error) throw error;
}

export async function updatePlannedOutfitStatus(
  supabase: SupabaseClient,
  date: string,
  status: PlannedOutfitRow['status'],
): Promise<void> {
  const { error } = await supabase.from('planned_outfits').update({ status }).eq('date', date);
  if (error) throw error;
}
