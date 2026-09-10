// Expo inlines EXPO_PUBLIC_* vars into `process.env` at build time, but this
// project has no @types/node (RN's own globals aren't Node's) — just enough
// of a shape to type-check the read, matching src/polyfills.ts's precedent
// of avoiding @types/node.
declare const process: { env: Record<string, string | undefined> };
