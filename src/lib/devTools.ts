import { migrateLeagueToSubcollection } from './migrateLeague';

// Expose dev/admin helpers on window so they can be invoked from the browser
// console without shipping a UI for them. Manual triggers only.
declare global {
  interface Window {
    migrateLeagueToSubcollection: typeof migrateLeagueToSubcollection;
  }
}

if (typeof window !== 'undefined') {
  window.migrateLeagueToSubcollection = migrateLeagueToSubcollection;
}

export {};
