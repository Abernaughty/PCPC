const { CosmosClient } = require('@azure/cosmos');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Load set mapping
const setMapping = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/set-mapping.json'), 'utf8'));

// Initialize Cosmos DB client
const cosmosClient = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);
const database = cosmosClient.database('PokemonCards');
const cardContainer = database.container('Cards');

/**
 * Get TCG set ID from PokeData set ID using the mapping
 */
function getTcgSetId(pokeDataSetId) {
    for (const [tcgId, mapping] of Object.entries(setMapping.mappings)) {
        if (mapping.pokeDataId === pokeDataSetId) {
            return tcgId;
        }
    }
    return null;
}

/**
 * Construct image URLs for a card (with leading zero fix)
 */
function constructImageUrls(tcgSetId, cardNumber) {
    // Remove leading zeros from card number (e.g., "020" -> "20")
    // But keep at least one zero if the number is "000" or similar
    const cleanCardNumber = cardNumber.replace(/^0+/, '') || '0';
    
    return {
        small: `https://images.pokemontcg.io/${tcgSetId}/${cleanCardNumber}.png`,
        large: `https://images.pokemontcg.io/${tcgSetId}/${cleanCardNumber}_hires.png`
    };
}

/**
 * Check if a URL is accessible
 */
async function checkUrl(url) {
    try {
        const response = await axios.head(url);
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

/**
 * Update image URLs for all cards in a set (adds missing URLs)
 */
async function updateSetImageUrls(setId, setName, mode = 'update') {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${mode === 'fix' ? 'Fixing' : 'Updating'} Image URLs for: ${setName} (ID: ${setId})`);
    console.log(`${'='.repeat(60)}`);
    
    // Get TCG set ID from mapping
    const tcgSetId = getTcgSetId(setId);
    if (!tcgSetId) {
        console.error(`✗ No TCG mapping found for set ${setId}`);
        return { updated: 0, skipped: 0, errors: 0 };
    }
    
    console.log(`✓ Found TCG set ID: ${tcgSetId}`);
    
    // Query cards from CosmosDB
    console.log(`\nQuerying cards from CosmosDB...`);
    let querySpec;
    
    if (mode === 'fix') {
        // For fix mode, only get cards with existing URLs that might have leading zero issues
        querySpec = {
            query: "SELECT * FROM c WHERE c.setId = @setId AND (c.imageUrl != null OR c.imageUrlHiRes != null)",
            parameters: [
                { name: "@setId", value: setId }
            ]
        };
    } else {
        // For update mode, get all cards
        querySpec = {
            query: "SELECT * FROM c WHERE c.setId = @setId",
            parameters: [
                { name: "@setId", value: setId }
            ]
        };
    }
    
    let cards;
    try {
        const { resources } = await cardContainer.items.query(querySpec).fetchAll();
        cards = resources;
        console.log(`✓ Found ${cards.length} cards${mode === 'fix' ? ' with image URLs' : ' in set'}`);
    } catch (error) {
        console.error(`✗ Failed to query cards: ${error.message}`);
        return { updated: 0, skipped: 0, errors: 0 };
    }
    
    if (cards.length === 0) {
        console.log('No cards to process');
        return { updated: 0, skipped: 0, errors: 0 };
    }
    
    // Process cards
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let checkedCount = 0;
    
    console.log(`\n${mode === 'fix' ? 'Checking and fixing cards with leading zero issues' : 'Processing cards'}...`);
    
    for (const card of cards) {
        checkedCount++;
        
        if (mode === 'fix') {
            // Fix mode: only fix cards with leading zeros
            const hasLeadingZeros = card.cardNumber && card.cardNumber.match(/^0+\d/);
            
            if (!hasLeadingZeros) {
                skippedCount++;
                continue;
            }
            
            // Construct correct URLs
            const correctUrls = constructImageUrls(tcgSetId, card.cardNumber);
            
            // Check if current URLs are incorrect
            const needsFixing = card.imageUrl !== correctUrls.small || 
                              card.imageUrlHiRes !== correctUrls.large ||
                              card.images?.small !== correctUrls.small ||
                              card.images?.large !== correctUrls.large;
            
            if (!needsFixing) {
                skippedCount++;
                continue;
            }
            
            console.log(`\n  Fixing ${card.cardName} (#${card.cardNumber})`);
            console.log(`    Old URLs:`);
            console.log(`      Small: ${card.imageUrl}`);
            console.log(`      Large: ${card.imageUrlHiRes}`);
            console.log(`    New URLs:`);
            console.log(`      Small: ${correctUrls.small}`);
            console.log(`      Large: ${correctUrls.large}`);
            
            // Update card with correct URLs
            card.imageUrl = correctUrls.small;
            card.imageUrlHiRes = correctUrls.large;
            
        } else {
            // Update mode: add missing URLs
            if (card.imageUrl && card.imageUrlHiRes) {
                skippedCount++;
                if (skippedCount <= 3) {
                    console.log(`  ⏭ Skipping ${card.cardName} (#${card.cardNumber}) - already has URLs`);
                }
                continue;
            }
            
            // Construct image URLs
            const imageUrls = constructImageUrls(tcgSetId, card.cardNumber);
            
            // Update card
            card.imageUrl = imageUrls.small;
            card.imageUrlHiRes = imageUrls.large;
            
            if (updatedCount < 5) {
                console.log(`  ✓ Updating ${card.cardName} (#${card.cardNumber})`);
                console.log(`    Small: ${imageUrls.small}`);
                console.log(`    Large: ${imageUrls.large}`);
            }
        }
        
        // Update the images object
        if (!card.images) {
            card.images = {
                small: card.imageUrl,
                large: card.imageUrlHiRes,
                original: card.imageUrlHiRes,
                variants: {}
            };
        } else {
            card.images.small = card.imageUrl;
            card.images.large = card.imageUrlHiRes;
            card.images.original = card.imageUrlHiRes;
        }
        
        // Save the card
        try {
            await cardContainer.items.upsert(card);
            updatedCount++;
            if (mode === 'fix') {
                console.log(`    ✓ Fixed successfully`);
            }
        } catch (error) {
            errorCount++;
            console.error(`    ✗ Failed to update: ${error.message}`);
        }
        
        // Show progress every 10 cards
        if (checkedCount % 10 === 0) {
            const progress = Math.round((checkedCount / cards.length) * 100);
            console.log(`\n  Progress: ${progress}% (${checkedCount}/${cards.length})`);
        }
    }
    
    console.log(`\n${'-'.repeat(40)}`);
    console.log('Summary:');
    console.log(`  ✓ ${mode === 'fix' ? 'Fixed' : 'Updated'}: ${updatedCount} cards`);
    console.log(`  ⏭ Skipped: ${skippedCount} cards${mode === 'fix' ? ' (no leading zeros or already correct)' : ' (already had URLs)'}`);
    console.log(`  ✗ Errors: ${errorCount} cards`);
    
    return { updated: updatedCount, skipped: skippedCount, errors: errorCount };
}

async function main() {
    console.log('Image URL Management Tool');
    console.log('=========================\n');
    
    // Check environment
    if (!process.env.COSMOS_DB_CONNECTION_STRING) {
        console.error('ERROR: COSMOS_DB_CONNECTION_STRING not found in environment');
        console.log('Please ensure your .env file contains the connection string');
        process.exit(1);
    }
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const mode = args.includes('--fix') ? 'fix' : 'update';
    const processAll = args.includes('--all');
    const setIdArg = args.find(arg => arg.startsWith('--set='));
    const specificSetId = setIdArg ? parseInt(setIdArg.split('=')[1]) : null;
    
    if (specificSetId) {
        // Process specific set
        const setName = Object.values(setMapping.mappings).find(m => m.pokeDataId === specificSetId)?.pokeDataName || 'Unknown';
        console.log(`Mode: ${mode === 'fix' ? 'Fix' : 'Update'} single set (${setName})\n`);
        
        await updateSetImageUrls(specificSetId, setName, mode);
        
    } else if (processAll) {
        console.log(`Mode: ${mode === 'fix' ? 'Fix' : 'Update'} ALL mapped sets\n`);
        
        // Get all unique set IDs from mappings
        const setIds = new Set();
        for (const mapping of Object.values(setMapping.mappings)) {
            setIds.add(mapping.pokeDataId);
        }
        
        console.log(`Found ${setIds.size} mapped sets to process\n`);
        
        let totalUpdated = 0;
        let totalSkipped = 0;
        let totalErrors = 0;
        
        for (const setId of setIds) {
            // Find set name
            const setName = Object.values(setMapping.mappings).find(m => m.pokeDataId === setId)?.pokeDataName || 'Unknown';
            
            const result = await updateSetImageUrls(setId, setName, mode);
            totalUpdated += result.updated;
            totalSkipped += result.skipped;
            totalErrors += result.errors;
            
            // Small delay between sets
            if (result.updated > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('FINAL SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total cards ${mode === 'fix' ? 'fixed' : 'updated'}: ${totalUpdated}`);
        console.log(`Total cards skipped: ${totalSkipped}`);
        console.log(`Total errors: ${totalErrors}`);
        
    } else {
        // Default: Process Prismatic Evolutions as test
        console.log(`Mode: ${mode === 'fix' ? 'Fix' : 'Update'} Prismatic Evolutions (default test set)\n`);
        console.log('Usage:');
        console.log('  node manage-image-urls.js                - Update Prismatic Evolutions');
        console.log('  node manage-image-urls.js --fix          - Fix Prismatic Evolutions URLs');
        console.log('  node manage-image-urls.js --set=557      - Update specific set by ID');
        console.log('  node manage-image-urls.js --all          - Update all sets');
        console.log('  node manage-image-urls.js --fix --all    - Fix all sets\n');
        
        await updateSetImageUrls(557, 'Prismatic Evolutions', mode);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`${mode === 'fix' ? 'Fix' : 'Update'} Complete!`);
    console.log('='.repeat(60));
    
    if (mode === 'update') {
        console.log('\nNext Steps:');
        console.log('1. Verify the updates in CosmosDB');
        console.log('2. Test the application to see if images load faster');
        console.log('3. Run with --fix flag if you encounter leading zero issues');
    }
}

// Run the script
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
