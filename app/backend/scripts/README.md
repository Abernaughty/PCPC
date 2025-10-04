# PokeDataFunc Scripts Documentation

This directory contains utility scripts for managing Pokemon card data, specifically for mapping between Pokemon TCG API and PokeData API sets, and optimizing image URLs for better performance.

## Prerequisites

Before running any scripts, ensure you have:

1. **Node.js** installed (v14 or higher)
2. **Required npm packages** installed:
   ```bash
   cd PokeDataFunc
   npm install
   ```
3. **Data files** in `PokeDataFunc/data/`:
   - `pokemon-tcg-sets.json` - Set data from Pokemon TCG API
   - `pokedata-sets.json` - Set data from PokeData API
   - `set-mapping.json` - Generated mapping between the two APIs

4. **Environment variables** (for database scripts):
   - Create a `.env` file in `PokeDataFunc/` with:
     ```
     COSMOS_DB_CONNECTION_STRING=your_connection_string_here
     ```

## Consolidated Scripts

After consolidation, we now have 3 main scripts instead of the original 9:

### 1. set-mapping.js
**Purpose:** Analyze and generate mappings between Pokemon TCG API and PokeData API sets.

**Commands:**
```bash
# Analyze PTCGO code coverage
node scripts/set-mapping.js --analyze

# Generate basic set mapping (automatic strategies only)
node scripts/set-mapping.js --generate

# Generate set mapping with manual mappings for known edge cases
node scripts/set-mapping.js --generate --manual
```

**What it does:**
- `--analyze`: Shows statistics about PTCGO code matches between the two APIs
- `--generate`: Creates `data/set-mapping.json` using automatic matching strategies:
  - PTCGO code matching
  - Exact name matching
  - Name similarity with date proximity
  - Cleaned name matching (removes prefixes like "sv", "xy", etc.)
- `--manual`: Includes hardcoded mappings for recent sets that don't match automatically

**Output:** Saves mapping to `data/set-mapping.json`

### 2. manage-image-urls.js
**Purpose:** Add or fix image URLs in the CosmosDB database for faster card loading.

**Commands:**
```bash
# Update Prismatic Evolutions set (default test)
node scripts/manage-image-urls.js

# Fix leading zero issues in Prismatic Evolutions
node scripts/manage-image-urls.js --fix

# Update a specific set by ID
node scripts/manage-image-urls.js --set=557

# Update all mapped sets
node scripts/manage-image-urls.js --all

# Fix leading zero issues in all sets
node scripts/manage-image-urls.js --fix --all
```

**What it does:**
- **Update mode** (default): Adds missing image URLs to cards
- **Fix mode** (`--fix`): Corrects URLs with leading zero issues (e.g., "020" → "20")
- Constructs URLs using pattern: `https://images.pokemontcg.io/{tcgSetId}/{cardNumber}.png`
- Updates both `imageUrl` and `imageUrlHiRes` fields
- Creates/updates the `images` object with small/large/original URLs

**Requirements:** 
- Valid `COSMOS_DB_CONNECTION_STRING` in `.env`
- Existing `set-mapping.json` file

### 3. test-image-urls.js
**Purpose:** Test and verify image URL patterns and optimization status.

**Commands:**
```bash
# Test URL pattern without database
node scripts/test-image-urls.js --simple

# Test with database connection
node scripts/test-image-urls.js --with-db

# Test leading zero URL fixes
node scripts/test-image-urls.js --test-fix

# Verify optimization status
node scripts/test-image-urls.js --verify
```

**What it does:**
- `--simple`: Tests URL construction pattern against GitHub data (no DB needed)
- `--with-db`: Compares constructed URLs with actual database data
- `--test-fix`: Tests if URLs with/without leading zeros are accessible
- `--verify`: Checks if specific cards have been optimized in the database

**Requirements:**
- `--simple` and `--test-fix`: No database needed
- `--with-db` and `--verify`: Requires valid `COSMOS_DB_CONNECTION_STRING`

## Typical Workflow

### Initial Setup
1. Generate set mapping:
   ```bash
   node scripts/set-mapping.js --generate --manual
   ```

2. Test the URL pattern works:
   ```bash
   node scripts/test-image-urls.js --simple
   ```

### Optimize Database
1. Update all sets with image URLs:
   ```bash
   node scripts/manage-image-urls.js --all
   ```

2. Verify optimization worked:
   ```bash
   node scripts/test-image-urls.js --verify
   ```

3. If you encounter leading zero issues:
   ```bash
   node scripts/manage-image-urls.js --fix --all
   ```

### Testing Specific Sets
1. Test a single set update:
   ```bash
   # Update Prismatic Evolutions (ID: 557)
   node scripts/manage-image-urls.js --set=557
   
   # Verify it worked
   node scripts/test-image-urls.js --verify
   ```

## Performance Impact

Before optimization:
- Response time: 20+ seconds per card
- Multiple API calls to Pokemon TCG API required
- Poor user experience with long wait times

After optimization:
- Response time: <1 second per card
- No external API calls needed (uses cached URLs)
- 95%+ reduction in response time
- Excellent user experience with instant loading

## Troubleshooting

### "COSMOS_DB_CONNECTION_STRING not found"
- Ensure `.env` file exists in `PokeDataFunc/` directory
- Check that the connection string is properly formatted

### "No TCG mapping found for set"
- Run `node scripts/set-mapping.js --generate --manual` to create/update mappings
- Check if the set exists in both APIs

### URLs returning 404 errors
- Run fix mode: `node scripts/manage-image-urls.js --fix --set=ID`
- This removes leading zeros from card numbers in URLs

### Script hangs or times out
- Check your internet connection
- Verify CosmosDB connection string is valid
- Try processing smaller batches (use `--set=ID` instead of `--all`)

## Original Scripts (Now Deprecated)

The following scripts have been consolidated and should no longer be used:
- ❌ `analyze-ptcgo-mapping.js` → Use `set-mapping.js --analyze`
- ❌ `generate-set-mapping.js` → Use `set-mapping.js --generate --manual`
- ❌ `generate-optimized-set-mapping.js` → Use `set-mapping.js --generate`
- ❌ `update-image-urls.js` → Use `manage-image-urls.js`
- ❌ `fix-image-urls.js` → Use `manage-image-urls.js --fix`
- ❌ `test-image-url-update.js` → Use `test-image-urls.js --with-db`
- ❌ `test-image-url-simple.js` → Use `test-image-urls.js --simple`
- ❌ `test-url-fix.js` → Use `test-image-urls.js --test-fix`
- ❌ `verify-optimization.js` → Use `test-image-urls.js --verify`

## Notes

- All scripts use the set mapping from `data/set-mapping.json`
- Image URLs follow the pattern: `https://images.pokemontcg.io/{tcgSetId}/{cardNumber}[_hires].png`
- Card numbers with leading zeros (e.g., "020") must be cleaned to work (e.g., "20")
- The scripts are idempotent - running them multiple times is safe
- Progress is shown for long-running operations
