/**
 * User Store — Zustand
 *
 * Manages user profile and onboarding state.
 * Persisted to SQLite.
 *
 * State:
 *   - profile: UserProfile | null
 *
 * Actions:
 *   - load()                        → reads profile from DB
 *   - updateProfile(changes)        → patches profile
 *   - completeOnboarding()          → marks onboarding done
 *   - updatePermissions(perms)      → updates permission flags
 */

// TODO: create(set, get) → UserStore
