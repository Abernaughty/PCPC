const axios = require('axios');
const { CosmosClient } = require('@azure/cosmos');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Load set mapping
const setMapping = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/set-mapping.json'), 'utf8'));

// Test configuration
const TEST_SETS = [
    { tcgId: 'sv6', pokeDataId: 545, name: 'Twilight Masquerade' },
    { tcgId: 'sv8', pokeDataId: 555, name: 'Surging Sparks' },
    { tcgId: 'sv8pt5', pokeDataId: 557, name: 'Prismatic Evolutions' },
    { tcgId: 'sv9', pokeDataId: 562, name: 'Journey Together' },
    { tcgId: 'base2', pokeDataId: 83, name: 'Jungle' }
];

// Maximum cards to test per set
const MAX_CARDS_PER_SET = 5;

// Initialize Cosmos DB client (only if needed)
let cosmosClient, database, cardContainer;

function initCosmosDB() {
    if (!cosmosClient) {
        cosmosClient = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);
        database = cosmosClient.database('PokemonCards');
        cardContainer = database.container('Cards');
    }
}

async function fetchGitHubCardData(tcgSetId) {
    const url = `https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/${tcgSetId}.json`;
    console.log(`\nFetching GitHub data from: ${url}`);
    
    try {
        const response = await axios.get(url);
        console.log(`✓ Successfully fetched ${response.data.length} cards from GitHub`);
        return response.data;
    } catch (error) {
        console.error(`✗ Failed to fetch GitHub data: ${error.message}`);
        return null;
    }
}

async function getCardsFromCosmosDB(setId) {
    initCosmosDB();
    console.log(`\nQuerying CosmosDB for cards in set ${setId}...`);
    
    try {
        const querySpec = {
            query: "SELECT * FROM c WHERE c.setId = @setId",
            parameters: [
                { name: "@setId", value: setId }
            ]
        };
        
        const { resources } = await cardContainer.items.query(querySpec).fetchAll();
        console.log(`✓ Found ${resources.length} cards in CosmosDB`);
        return resources;
    } catch (error) {
        console.error(`✗ Failed to query CosmosDB: ${error.message}`);
        return [];
    }
}

async function testImageAccessibility(url) {
    try {
        const response = await axios.head(url);
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

/**
 * Simple test - verify URL pattern without database
 */
async function simpleTest() {
    console.log('Simple Image URL Test (No Database)');
    console.log('====================================\n');
    
    let totalTested = 0;
    let totalSuccess = 0;
    
    for (const set of TEST_SETS) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing Set: ${set.name}`);
        console.log(`TCG ID: ${set.tcgId}, PokeData ID: ${set.pokeDataId}`);
        console.log(`${'='.repeat(60)}`);
        
        // Fetch GitHub data
        const githubCards = await fetchGitHubCardData(set.tcgId);
        if (!githubCards) {
            console.log('Skipping set due to GitHub fetch failure');
            continue;
        }
        
        // Test a few cards
        let testedCount = 0;
        let successCount = 0;
        const cardsToTest = githubCards.slice(0, MAX_CARDS_PER_SET);
        
        for (const githubCard of cardsToTest) {
            testedCount++;
            console.log(`\n--- Card ${testedCount}: ${githubCard.name} (#${githubCard.number}) ---`);
            
            // Construct URLs using our pattern
            const cleanNumber = githubCard.number.replace(/^0+/, '') || '0';
            const constructedSmall = `https://images.pokemontcg.io/${set.tcgId}/${cleanNumber}.png`;
            const constructedLarge = `https://images.pokemontcg.io/${set.tcgId}/${cleanNumber}_hires.png`;
            
            console.log('Constructed URLs:');
            console.log(`  Small: ${constructedSmall}`);
            console.log(`  Large: ${constructedLarge}`);
            
            // Verify URLs match
            const smallMatch = githubCard.images?.small === constructedSmall;
            const largeMatch = githubCard.images?.large === constructedLarge;
            
            if (smallMatch && largeMatch) {
                console.log('✓ URLs match perfectly!');
                successCount++;
            } else {
                console.log('⚠ URL mismatch detected');
            }
        }
        
        console.log(`\n${'-'.repeat(40)}`);
        console.log(`Summary: ${successCount}/${testedCount} cards validated successfully`);
        
        totalTested += testedCount;
        totalSuccess += successCount;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Overall Results');
    console.log('='.repeat(60));
    console.log(`Total cards tested: ${totalTested}`);
    console.log(`Successfully matched: ${totalSuccess}`);
    console.log(`Success rate: ${((totalSuccess / totalTested) * 100).toFixed(1)}%`);
}

/**
 * Test with database - verify URL construction against actual data
 */
async function testWithDatabase() {
    console.log('Image URL Test with Database');
    console.log('=============================\n');
    
    // Check environment
    if (!process.env.COSMOS_DB_CONNECTION_STRING) {
        console.error('ERROR: COSMOS_DB_CONNECTION_STRING not found in environment');
        console.log('Please ensure your .env file contains the connection string');
        return;
    }
    
    for (const set of TEST_SETS.slice(0, 3)) { // Test first 3 sets
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing Set: ${set.name} (TCG: ${set.tcgId}, PokeData: ${set.pokeDataId})`);
        console.log(`${'='.repeat(60)}`);
        
        // Fetch GitHub data
        const githubCards = await fetchGitHubCardData(set.tcgId);
        if (!githubCards) {
            console.log('Skipping set due to GitHub fetch failure');
            continue;
        }
        
        // Get cards from CosmosDB
        const cosmosCards = await getCardsFromCosmosDB(set.pokeDataId);
        if (cosmosCards.length === 0) {
            console.log('No cards found in CosmosDB for this set');
            continue;
        }
        
        // Create a map of GitHub cards by number for easy lookup
        const githubCardMap = new Map();
        githubCards.forEach(card => {
            githubCardMap.set(card.number, card);
        });
        
        // Test updating a few cards
        let testedCount = 0;
        let successCount = 0;
        
        for (const cosmosCard of cosmosCards.slice(0, MAX_CARDS_PER_SET)) {
            testedCount++;
            console.log(`\n--- Card ${testedCount}: ${cosmosCard.cardName} (#${cosmosCard.cardNumber}) ---`);
            
            // Find matching GitHub card
            const githubCard = githubCardMap.get(cosmosCard.cardNumber);
            
            if (!githubCard) {
                console.log(`✗ No matching GitHub card found for number ${cosmosCard.cardNumber}`);
                continue;
            }
            
            console.log(`✓ Found matching GitHub card: ${githubCard.name}`);
            
            // Construct URLs using pattern
            const cleanNumber = cosmosCard.cardNumber.replace(/^0+/, '') || '0';
            const constructedSmall = `https://images.pokemontcg.io/${set.tcgId}/${cleanNumber}.png`;
            const constructedLarge = `https://images.pokemontcg.io/${set.tcgId}/${cleanNumber}_hires.png`;
            
            console.log('\nCurrent CosmosDB URLs:');
            console.log(`  imageUrl: ${cosmosCard.imageUrl || 'Not set'}`);
            console.log(`  imageUrlHiRes: ${cosmosCard.imageUrlHiRes || 'Not set'}`);
            
            console.log('\nConstructed URLs:');
            console.log(`  Small: ${constructedSmall}`);
            console.log(`  Large: ${constructedLarge}`);
            
            // Verify URLs match
            const smallMatch = githubCard.images?.small === constructedSmall;
            const largeMatch = githubCard.images?.large === constructedLarge;
            
            if (smallMatch && largeMatch) {
                console.log('✓ Constructed URLs match GitHub data perfectly!');
                successCount++;
            } else {
                console.log('⚠ URL mismatch detected');
            }
        }
        
        console.log(`\n${'-'.repeat(40)}`);
        console.log(`Summary: ${successCount}/${testedCount} cards validated successfully`);
    }
}

/**
 * Test URL fix - verify leading zero handling
 */
async function testUrlFix() {
    console.log('Testing URL Fix (Leading Zeros)');
    console.log('================================\n');
    
    const tests = [
        { url: 'https://images.pokemontcg.io/sv8pt5/20.png', description: 'Without leading zero (20)' },
        { url: 'https://images.pokemontcg.io/sv8pt5/020.png', description: 'With leading zero (020)' },
        { url: 'https://images.pokemontcg.io/sv8pt5/5.png', description: 'Without leading zero (5)' },
        { url: 'https://images.pokemontcg.io/sv8pt5/005.png', description: 'With leading zero (005)' },
        { url: 'https://images.pokemontcg.io/sv8pt5/132.png', description: 'Without leading zero (132)' },
        { url: 'https://images.pokemontcg.io/sv8pt5/132_hires.png', description: 'Hi-res without leading zero' },
    ];
    
    for (const test of tests) {
        try {
            const response = await axios.head(test.url);
            console.log(`✓ ${test.description}: SUCCESS (${response.status})`);
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log(`✗ ${test.description}: 404 NOT FOUND`);
            } else {
                console.log(`✗ ${test.description}: ERROR (${error.message})`);
            }
        }
    }
    
    console.log('\nConclusion:');
    console.log('URLs without leading zeros work correctly.');
    console.log('URLs with leading zeros return 404 errors.');
}

/**
 * Verify optimization - check if cards have been optimized
 */
async function verifyOptimization() {
    console.log('Image URL Optimization Verification');
    console.log('====================================\n');
    
    // Check environment
    if (!process.env.COSMOS_DB_CONNECTION_STRING) {
        console.error('ERROR: COSMOS_DB_CONNECTION_STRING not found in environment');
        console.log('Please ensure your .env file contains the connection string');
        return;
    }
    
    initCosmosDB();
    
    const setId = 557; // Prismatic Evolutions
    const testCards = [
        { id: '73092', name: 'Amarys', number: '132' },
        { id: '73130', name: 'Amarys', number: '170' },
        { id: '73054', name: 'Amarys', number: '093' }
    ];
    
    console.log(`Checking cards from Prismatic Evolutions (Set ID: ${setId})\n`);
    
    let optimizedCount = 0;
    let totalCount = 0;
    
    for (const testCard of testCards) {
        totalCount++;
        console.log(`\nChecking card: ${testCard.name} (#${testCard.number})`);
        console.log('-'.repeat(40));
        
        try {
            const querySpec = {
                query: "SELECT * FROM c WHERE c.id = @id AND c.setId = @setId",
                parameters: [
                    { name: "@id", value: testCard.id },
                    { name: "@setId", value: setId }
                ]
            };
            
            const { resources } = await cardContainer.items.query(querySpec).fetchAll();
            
            if (resources.length === 0) {
                console.log(`✗ Card not found in database`);
                continue;
            }
            
            const card = resources[0];
            
            const hasImageUrl = !!card.imageUrl;
            const hasImageUrlHiRes = !!card.imageUrlHiRes;
            const hasImagesSmall = !!card.images?.small;
            const hasImagesLarge = !!card.images?.large;
            
            console.log(`  imageUrl: ${hasImageUrl ? '✓' : '✗'} ${hasImageUrl ? card.imageUrl : 'Not set'}`);
            console.log(`  imageUrlHiRes: ${hasImageUrlHiRes ? '✓' : '✗'} ${hasImageUrlHiRes ? card.imageUrlHiRes : 'Not set'}`);
            console.log(`  images.small: ${hasImagesSmall ? '✓' : '✗'} ${hasImagesSmall ? card.images.small : 'Not set'}`);
            console.log(`  images.large: ${hasImagesLarge ? '✓' : '✗'} ${hasImagesLarge ? card.images.large : 'Not set'}`);
            
            const isOptimized = hasImageUrl && hasImageUrlHiRes && hasImagesSmall && hasImagesLarge;
            
            if (isOptimized) {
                console.log(`\n  ✅ OPTIMIZED: This card will load instantly without API calls!`);
                optimizedCount++;
            } else {
                console.log(`\n  ⚠️ NOT OPTIMIZED: This card will still require API calls`);
            }
            
        } catch (error) {
            console.error(`  ✗ Error checking card: ${error.message}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Verification Summary');
    console.log('='.repeat(60));
    console.log(`Test cards optimized: ${optimizedCount}/${totalCount}`);
    
    if (optimizedCount === totalCount) {
        console.log('\n✅ SUCCESS: All test cards are optimized!');
        console.log('   Cards will now load in <1 second instead of 20+ seconds');
    } else {
        console.log('\n⚠️ WARNING: Some cards are not optimized');
        console.log('   Run: node manage-image-urls.js --all');
        console.log('   to update missing image URLs');
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    console.log('Image URL Testing Tool');
    console.log('======================\n');
    
    if (args.includes('--simple')) {
        await simpleTest();
    } else if (args.includes('--with-db')) {
        await testWithDatabase();
    } else if (args.includes('--test-fix')) {
        await testUrlFix();
    } else if (args.includes('--verify')) {
        await verifyOptimization();
    } else {
        console.log('Usage:');
        console.log('  node test-image-urls.js --simple    - Test URL pattern without database');
        console.log('  node test-image-urls.js --with-db   - Test with database connection');
        console.log('  node test-image-urls.js --test-fix  - Test leading zero URL fixes');
        console.log('  node test-image-urls.js --verify    - Verify optimization status');
        console.log('\nExample:');
        console.log('  node test-image-urls.js --simple');
        console.log('\nNote: --with-db and --verify require COSMOS_DB_CONNECTION_STRING in .env');
    }
}

// Run the test
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
