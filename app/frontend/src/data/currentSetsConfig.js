/**
 * Configuration for current Pokémon TCG sets
 * This defines which sets are considered "current" and should be cached
 */
export const currentSetsConfig = {
  // Last updated timestamp
  lastUpdated: '2025-04-25',
  
  // Current expansion name
  currentExpansion: 'Scarlet & Violet',
  
  // Maximum age in months to consider a set "current"
  maxAgeMonths: 24,
  
  // Baseline list of current set codes (will be validated and updated)
  baselineCodes: [
    'JOT', // Journey Together
    'PRE', // Prismatic Evolutions
    'SSP', // Surging Sparks
    'SCR', // Stellar Crown
    'SFA', // Shrouded Fable
    'TWM', // Twilight Masquerade
    'TEF', // Temporal Forces
    'PAF', // Paldean Fates
    'PAR', // Paradox Rift
    'MEW', // 151
    'OBF', // Obsidian Flames
    'PAL', // Paldea Evolved
    'SVE', // Scarlet & Violet Energies
    'SVI', // Scarlet & Violet
    'SVP'  // Scarlet & Violet Black Star Promos
  ]
};
