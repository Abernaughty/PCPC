/**
 * Expansion Mapper Service
 * Maps set codes to their respective expansions for grouping in the UI
 */

// Define expansion patterns based on set codes
const EXPANSION_PATTERNS = [
  { pattern: /^sv|^JTG|^PRE|^SSP/, expansion: "Scarlet & Violet" },
  { pattern: /^sm|^SMP/, expansion: "Sun & Moon" },
  { pattern: /^xy|^XYP/, expansion: "XY" },
  { pattern: /^bw|^BWP/, expansion: "Black & White" },
  { pattern: /^hs|^HSP/, expansion: "HeartGold & SoulSilver" },
  { pattern: /^dp|^DPP/, expansion: "Diamond & Pearl" },
  { pattern: /^ex/, expansion: "EX" },
  { pattern: /^PL|^SV|^RR|^SF|^LA|^MD/, expansion: "Platinum" },
  { pattern: /^CL|^TM|^UD|^UL/, expansion: "Call of Legends" },
  { pattern: /^N\d/, expansion: "Neo" },
  { pattern: /^G\d/, expansion: "Gym" },
  { pattern: /^BS|^B2|^JU|^FO|^RO/, expansion: "Base Set" },
];

// Special cases for sets that don't follow the pattern
const SPECIAL_CASES = {
  "CRZ": "Sword & Shield",
  "SIT": "Sword & Shield",
  "LOR": "Sword & Shield",
  "ASR": "Sword & Shield",
  "BRS": "Sword & Shield",
  "FST": "Sword & Shield",
  "CEL": "Sword & Shield",
  "EVS": "Sword & Shield",
  "CRE": "Sword & Shield",
  "BST": "Sword & Shield",
  "SHF": "Sword & Shield",
  "VIV": "Sword & Shield",
  "CPA": "Sword & Shield",
  "DAA": "Sword & Shield",
  "RCL": "Sword & Shield",
  "SSH": "Sword & Shield",
  "SWSHP": "Sword & Shield",
  "TWM": "Scarlet & Violet",
  "TEF": "Scarlet & Violet",
  "PAF": "Scarlet & Violet",
  "PAR": "Scarlet & Violet",
  "MEW": "Scarlet & Violet",
  "OBF": "Scarlet & Violet",
  "PAL": "Scarlet & Violet",
  "SVE": "Scarlet & Violet",
  "SVI": "Scarlet & Violet",
  "SVP": "Scarlet & Violet",
};

// Name-based mapping for sets without codes (PokeData-first architecture)
const SET_NAME_MAPPINGS = {
  // Scarlet & Violet Series
  "Prismatic Evolutions": "Scarlet & Violet",
  "Surging Sparks": "Scarlet & Violet",
  "Stellar Crown": "Scarlet & Violet",
  "Shrouded Fable": "Scarlet & Violet",
  "Twilight Masquerade": "Scarlet & Violet",
  "Temporal Forces": "Scarlet & Violet",
  "Paldean Fates": "Scarlet & Violet",
  "Paradox Rift": "Scarlet & Violet",
  "Pokemon Card 151": "Scarlet & Violet",
  "Obsidian Flames": "Scarlet & Violet",
  "Paldea Evolved": "Scarlet & Violet",
  "Scarlet & Violet Base": "Scarlet & Violet",
  "Scarlet & Violet Promos": "Scarlet & Violet",
  
  // Sword & Shield Series
  "Crown Zenith": "Sword & Shield",
  "Silver Tempest": "Sword & Shield",
  "Lost Origin": "Sword & Shield",
  "Pokemon GO": "Sword & Shield",
  "Astral Radiance": "Sword & Shield",
  "Brilliant Stars": "Sword & Shield",
  "Fusion Strike": "Sword & Shield",
  "Celebrations": "Sword & Shield",
  "Celebrations: Classic Collection": "Sword & Shield",
  "Evolving Skies": "Sword & Shield",
  "Chilling Reign": "Sword & Shield",
  "Battle Styles": "Sword & Shield",
  "Shining Fates": "Sword & Shield",
  "Vivid Voltage": "Sword & Shield",
  "Champion's Path": "Sword & Shield",
  "Darkness Ablaze": "Sword & Shield",
  "Rebel Clash": "Sword & Shield",
  "Sword & Shield": "Sword & Shield",
  "Sword & Shield Promo": "Sword & Shield",
  
  // Sun & Moon Series
  "Cosmic Eclipse": "Sun & Moon",
  "Hidden Fates": "Sun & Moon",
  "Unified Minds": "Sun & Moon",
  "Unbroken Bonds": "Sun & Moon",
  "Detective Pikachu": "Sun & Moon",
  "Team Up": "Sun & Moon",
  "Lost Thunder": "Sun & Moon",
  "Dragon Majesty": "Sun & Moon",
  "Celestial Storm": "Sun & Moon",
  "Forbidden Light": "Sun & Moon",
  "Ultra Prism": "Sun & Moon",
  "Crimson Invasion": "Sun & Moon",
  "Shining Legends": "Sun & Moon",
  "Burning Shadows": "Sun & Moon",
  "Guardians Rising": "Sun & Moon",
  "Sun & Moon": "Sun & Moon",
  "Sun & Moon Black Star Promo": "Sun & Moon",
  
  // XY Series
  "Evolutions": "XY",
  "Steam Siege": "XY",
  "Fates Collide": "XY",
  "Generations Radiant Collection": "XY",
  "Generations": "XY",
  "BREAKpoint": "XY",
  "BREAKthrough": "XY",
  "Ancient Origins": "XY",
  "Roaring Skies": "XY",
  "Double Crisis": "XY",
  "Primal Clash": "XY",
  "Phantom Forces": "XY",
  "Furious Fists": "XY",
  "Flashfire": "XY",
  "XY Base": "XY",
  "Legendary Treasures Radiant Collection": "XY",
  "Legendary Treasures": "XY",
  "XY Black Star Promos": "XY",
  
  // Black & White Series
  "Plasma Blast": "Black & White",
  "Plasma Freeze": "Black & White",
  "Plasma Storm": "Black & White",
  "Dragon Vault": "Black & White",
  "Boundaries Crossed": "Black & White",
  "Dragons Exalted": "Black & White",
  "Dark Explorers": "Black & White",
  "Next Destinies": "Black & White",
  "Noble Victories": "Black & White",
  "Emerging Powers": "Black & White",
  "Black and White": "Black & White",
  "Black and White Promos": "Black & White",
  
  // HeartGold & SoulSilver Series
  "Call of Legends": "HeartGold & SoulSilver",
  "Triumphant": "HeartGold & SoulSilver",
  
  // Special Sets and Promos
  "Journey Together": "Scarlet & Violet",
  "Destined Rivals": "Scarlet & Violet",
  "Trading Card Game Classic": "Other",
  "Trick or Trade 2024": "Other",
  "Trick or Trade 2023": "Other",
  "Trick or Trade 2022": "Other",
  "Mcdonald's Dragon Discovery": "Other",
  "McDonald's Promos 2023": "Other",
  "McDonald's Promos 2022": "Other",
  "McDonald's Promos 2019": "Other",
  "McDonald's Promos 2018": "Other",
  "McDonald's Promos 2017": "Other",
  "McDonald's Promos 2016": "Other",
  "McDonald's Promos 2015": "Other",
  "McDonald's Promos 2014": "Other",
  "McDonald's Promos 2012": "Other",
  "McDonald's Promos 2011": "Other",
  "Mcdonald's 25th Anniversary": "Other",
  "Alternate Art Promos": "Other"
};

// Fallback expansion for sets that don't match any pattern
const FALLBACK_EXPANSION = "Other";

/**
 * Determine the expansion for a set based on its code or name
 * @param {Object} set - The set object
 * @returns {string} The expansion name
 */
function getExpansionForSet(set) {
  // First, try to use the code if it exists and is not null
  if (set.code && set.code !== null) {
    // Check special cases first
    if (SPECIAL_CASES[set.code]) {
      return SPECIAL_CASES[set.code];
    }

    // Check patterns
    for (const { pattern, expansion } of EXPANSION_PATTERNS) {
      if (pattern.test(set.code)) {
        return expansion;
      }
    }
  }

  // If no code or code is null, use name-based mapping (PokeData-first architecture)
  if (set.name) {
    // Check direct name mapping first (most reliable)
    if (SET_NAME_MAPPINGS[set.name]) {
      return SET_NAME_MAPPINGS[set.name];
    }

    // Check if the name contains an expansion name (fallback)
    for (const { expansion } of EXPANSION_PATTERNS) {
      if (set.name.includes(expansion)) {
        return expansion;
      }
    }

    // Check for partial name matches (for variations)
    for (const [mappedName, expansion] of Object.entries(SET_NAME_MAPPINGS)) {
      if (set.name.includes(mappedName) || mappedName.includes(set.name)) {
        return expansion;
      }
    }
  }

  // If no match found, use the fallback
  return FALLBACK_EXPANSION;
}

/**
 * Group sets by their expansion
 * @param {Array} sets - Array of set objects
 * @returns {Object} Object with expansion names as keys and arrays of sets as values
 */
function groupSetsByExpansion(sets) {
  // Safety check - if sets is not an array, return an empty object
  if (!Array.isArray(sets)) {
    console.warn('groupSetsByExpansion was called with non-array input:', sets);
    return {};
  }
  
  const groupedSets = {};

  // First pass: group sets by expansion
  sets.forEach(set => {
    const expansion = getExpansionForSet(set);
    if (!groupedSets[expansion]) {
      groupedSets[expansion] = [];
    }
    groupedSets[expansion].push(set);
  });

  // Second pass: sort sets within each expansion by release date (newest first)
  Object.keys(groupedSets).forEach(expansion => {
    groupedSets[expansion].sort((a, b) => {
      // Compare release dates in descending order (newest first)
      const dateA = new Date(a.release_date || 0);
      const dateB = new Date(b.release_date || 0);
      return dateB - dateA;
    });
  });

  return groupedSets;
}

/**
 * Convert grouped sets to a format suitable for the dropdown
 * @param {Object} groupedSets - Object with expansion names as keys and arrays of sets as values
 * @returns {Array} Array of objects with type, label, and items properties
 */
function prepareGroupedSetsForDropdown(groupedSets) {
  // Safety check - if groupedSets is not an object, return an empty array
  if (!groupedSets || typeof groupedSets !== 'object' || Array.isArray(groupedSets)) {
    console.warn('prepareGroupedSetsForDropdown was called with invalid input:', groupedSets);
    return [];
  }
  
  // Sort expansions by priority (newest first)
  const expansionPriority = [
    "Scarlet & Violet",
    "Sword & Shield",
    "Sun & Moon",
    "XY",
    "Black & White",
    "HeartGold & SoulSilver",
    "Call of Legends",
    "Platinum",
    "Diamond & Pearl",
    "EX",
    "Neo",
    "Gym",
    "Base Set",
    "Other"
  ];

  // Create an array of group objects
  const result = [];

  // Add groups in priority order
  expansionPriority.forEach(expansion => {
    if (groupedSets[expansion] && groupedSets[expansion].length > 0) {
      result.push({
        type: 'group',
        label: expansion,
        items: groupedSets[expansion]
      });
    }
  });

  // Add any remaining groups not in the priority list
  Object.keys(groupedSets).forEach(expansion => {
    if (!expansionPriority.includes(expansion) && groupedSets[expansion].length > 0) {
      result.push({
        type: 'group',
        label: expansion,
        items: groupedSets[expansion]
      });
    }
  });

  return result;
}

export const expansionMapper = {
  getExpansionForSet,
  groupSetsByExpansion,
  prepareGroupedSetsForDropdown
};
