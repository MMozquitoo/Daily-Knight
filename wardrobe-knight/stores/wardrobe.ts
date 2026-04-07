/**
 * Wardrobe Store — Zustand
 *
 * Manages the user's clothing library.
 * Reads from and writes to SQLite via Drizzle.
 *
 * State:
 *   - items: WardrobeItem[]
 *
 * Actions:
 *   - load()                     → reads all items from DB
 *   - addItem(item)              → inserts into DB + updates state
 *   - updateItem(id, changes)    → patches item in DB + updates state
 *   - toggleAvailability(id)     → flips available/unavailable
 *   - deleteItem(id)             → removes from DB + updates state
 */

// TODO: create(set, get) → WardrobeStore
