const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Load the set data files
const pokemonTcgSets = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/pokemon-tcg-sets.json'), 'utf8'));
const pokeDataSets = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/pokedata-sets.json'), 'utf8'));

// Helper functions
function normalizeDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

function dateDiffInDays(date1, date2) {
    if (!date1 || !date2) return Infinity;
    const diffTime = Math.abs(date2 - date1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function normalizeName(name) {
    return name
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Manual mappings for known cases where automatic matching fails
const manualMappings = {
    'sv8pt5': 'PRE',  // Prismatic Evolutions
    'sv8': 'SSP',     // Surging Sparks  
    'sv7': 'SCR',     // Stellar Crown
    'sv6pt5': 'SFA',  // Shrouded Fable
    'sv6': 'TWM',     // Twilight Masquerade
    'sv5': 'TEF',     // Temporal Forces
    'sv4pt5': 'PAF',  // Paldean Fates
    'sv4': 'PAR',     // Paradox Rift
    'sv3pt5': 'MEW',  // 151
    'sv3': 'OBF',     // Obsidian Flames
    'sv2': 'PAL',     // Paldea Evolved
    'sv1': 'SVI',     // Scarlet & Violet
    'sv9': 'JTG',     // Journey Together
};

function analyzeMapping() {
    console.log('🔍 Analyzing PTCGO Code vs PokeData Code Mapping');
    console.log('=' .repeat(60));
    console.log(`Pokemon TCG API: ${pokemonTcgSets.data.length} sets`);
    console.log(`PokeData API: ${pokeDataSets.length} sets`);

    const englishPokeDataSets = pokeDataSets.filter(set => set.language === 'ENGLISH');
    console.log(`PokeData API (English only): ${englishPokeDataSets.length} sets`);

    const pokeDataByCode = {};
    englishPokeDataSets.forEach(set => {
        if (set.code) {
            pokeDataByCode[set.code] = set;
        }
    });

    const tcgByPtcgoCode = {};
    pokemonTcgSets.data.forEach(set => {
        if (set.ptcgoCode) {
            tcgByPtcgoCode[set.ptcgoCode] = set;
        }
    });

    console.log(`\nPokeData sets with codes: ${Object.keys(pokeDataByCode).length}`);
    console.log(`Pokemon TCG sets with PTCGO codes: ${Object.keys(tcgByPtcgoCode).length}`);

    const exactMatches = [];
    const tcgWithoutPtcgo = [];
    const pokeDataWithoutCode = [];
    const unmatchedTcg = [];
    const unmatchedPokeData = [];

    console.log('\n🎯 Exact PTCGO Code Matches:');
    console.log('-'.repeat(40));

    for (const tcgSet of pokemonTcgSets.data) {
        if (!tcgSet.ptcgoCode) {
            tcgWithoutPtcgo.push(tcgSet);
            continue;
        }
        
        const matchingPokeDataSet = pokeDataByCode[tcgSet.ptcgoCode];
        if (matchingPokeDataSet) {
            exactMatches.push({
                tcgId: tcgSet.id,
                tcgName: tcgSet.name,
                ptcgoCode: tcgSet.ptcgoCode,
                pokeDataId: matchingPokeDataSet.id,
                pokeDataName: matchingPokeDataSet.name,
            });
            console.log(`✅ ${tcgSet.ptcgoCode}: ${tcgSet.name} → ${matchingPokeDataSet.name}`);
        } else {
            unmatchedTcg.push(tcgSet);
        }
    }

    for (const pokeDataSet of englishPokeDataSets) {
        if (!pokeDataSet.code) {
            pokeDataWithoutCode.push(pokeDataSet);
            continue;
        }
        
        const matchingTcgSet = tcgByPtcgoCode[pokeDataSet.code];
        if (!matchingTcgSet) {
            unmatchedPokeData.push(pokeDataSet);
        }
    }

    console.log('\n📊 Analysis Results:');
    console.log('=' .repeat(40));
    console.log(`✅ Exact PTCGO → PokeData matches: ${exactMatches.length}`);
    console.log(`❌ TCG sets without PTCGO codes: ${tcgWithoutPtcgo.length}`);
    console.log(`❌ TCG sets with unmatched PTCGO codes: ${unmatchedTcg.length}`);
    console.log(`❌ PokeData sets without codes: ${pokeDataWithoutCode.length}`);
    console.log(`❌ PokeData sets with unmatched codes: ${unmatchedPokeData.length}`);

    const tcgSetsWithPtcgo = pokemonTcgSets.data.filter(set => set.ptcgoCode).length;
    const coveragePercentage = ((exactMatches.length / tcgSetsWithPtcgo) * 100).toFixed(1);
    console.log(`\n📈 Coverage: ${exactMatches.length}/${tcgSetsWithPtcgo} (${coveragePercentage}%) of TCG sets with PTCGO codes have matching PokeData codes`);

    if (unmatchedTcg.length > 0) {
        console.log('\n❌ TCG sets with unmatched PTCGO codes (first 10):');
        unmatchedTcg.slice(0, 10).forEach(set => {
            console.log(`   ${set.ptcgoCode}: ${set.name} (${set.id})`);
        });
    }

    if (unmatchedPokeData.length > 0) {
        console.log('\n❌ PokeData sets with unmatched codes (first 10):');
        unmatchedPokeData.slice(0, 10).forEach(set => {
            console.log(`   ${set.code}: ${set.name} (ID: ${set.id})`);
        });
    }

    console.log('\n📋 Summary:');
    console.log('=' .repeat(40));
    if (coveragePercentage > 80) {
        console.log('🎉 EXCELLENT: PTCGO codes provide very good coverage for set mapping!');
    } else if (coveragePercentage > 60) {
        console.log('👍 GOOD: PTCGO codes provide decent coverage, but may need supplementation.');
    } else {
        console.log('⚠️  LIMITED: PTCGO codes provide limited coverage, need alternative strategies.');
    }
}

function generateMapping(includeManual = false) {
    console.log('🔍 Generating Set Mapping');
    console.log('=' .repeat(50));
    console.log(`Pokemon TCG API: ${pokemonTcgSets.data.length} sets`);
    console.log(`PokeData API: ${pokeDataSets.length} sets`);

    const englishPokeDataSets = pokeDataSets.filter(set => set.language === 'ENGLISH');
    console.log(`PokeData API (English only): ${englishPokeDataSets.length} sets`);

    const mapping = {};
    const unmappedTcg = [];
    const unmappedPokeData = [];

    // Apply manual mappings if requested
    if (includeManual) {
        console.log('\n🔧 Processing manual mappings...');
        for (const [tcgId, pokeDataCode] of Object.entries(manualMappings)) {
            const tcgSet = pokemonTcgSets.data.find(set => set.id === tcgId);
            const pokeDataSet = englishPokeDataSets.find(set => 
                set.code === pokeDataCode
            );
            
            if (tcgSet && pokeDataSet) {
                mapping[tcgId] = {
                    pokeDataCode: pokeDataCode,
                    pokeDataId: pokeDataSet.id,
                    tcgName: tcgSet.name,
                    pokeDataName: pokeDataSet.name,
                    matchType: 'manual'
                };
                console.log(`✅ Manual: ${tcgId} (${tcgSet.name}) → ${pokeDataCode} (${pokeDataSet.name})`);
            }
        }
    }

    console.log('\n🤖 Processing automatic mappings...');
    
    for (const tcgSet of pokemonTcgSets.data) {
        if (mapping[tcgSet.id]) continue;
        
        let pokeDataMatch = null;
        let matchType = 'none';
        
        // Strategy 1: PTCGO Code match
        if (tcgSet.ptcgoCode) {
            pokeDataMatch = englishPokeDataSets.find(set => 
                set.code === tcgSet.ptcgoCode
            );
            if (pokeDataMatch) {
                matchType = 'ptcgo_code';
            }
        }
        
        // Strategy 2: Exact name match
        if (!pokeDataMatch) {
            pokeDataMatch = englishPokeDataSets.find(set => 
                normalizeName(set.name) === normalizeName(tcgSet.name)
            );
            if (pokeDataMatch) {
                matchType = 'exact_name';
            }
        }
        
        // Strategy 3: Name similarity + date proximity
        if (!pokeDataMatch) {
            const tcgDate = normalizeDate(tcgSet.releaseDate);
            const tcgNameNorm = normalizeName(tcgSet.name);
            
            const similarSets = englishPokeDataSets.filter(set => {
                const pokeDataNameNorm = normalizeName(set.name);
                return tcgNameNorm.includes(pokeDataNameNorm) || 
                       pokeDataNameNorm.includes(tcgNameNorm) ||
                       tcgNameNorm.split(' ').filter(word => 
                           word.length > 2 && pokeDataNameNorm.includes(word)
                       ).length >= 2;
            });
            
            if (similarSets.length > 0 && tcgDate) {
                let bestMatch = null;
                let bestDateDiff = Infinity;
                
                for (const candidate of similarSets) {
                    const pokeDataDate = normalizeDate(candidate.release_date);
                    if (pokeDataDate) {
                        const dateDiff = dateDiffInDays(tcgDate, pokeDataDate);
                        if (dateDiff < bestDateDiff && dateDiff <= 90) {
                            bestDateDiff = dateDiff;
                            bestMatch = candidate;
                        }
                    }
                }
                
                if (bestMatch) {
                    pokeDataMatch = bestMatch;
                    matchType = 'name_date_similarity';
                }
            }
        }
        
        // Strategy 4: Cleaned name matching
        if (!pokeDataMatch) {
            const cleanTcgName = normalizeName(tcgSet.name)
                .replace(/^(ex\s+|xy\s+|sm\s+|swsh\s+|sv\s+)/i, '')
                .replace(/\s+(base|set)$/i, '');
            
            pokeDataMatch = englishPokeDataSets.find(set => {
                const cleanPokeDataName = normalizeName(set.name)
                    .replace(/^(ex\s+|xy\s+|sm\s+|swsh\s+|sv\s+)/i, '')
                    .replace(/\s+(base|set)$/i, '');
                
                return cleanPokeDataName === cleanTcgName;
            });
            
            if (pokeDataMatch) {
                matchType = 'cleaned_name';
            }
        }
        
        if (pokeDataMatch) {
            mapping[tcgSet.id] = {
                pokeDataCode: pokeDataMatch.code,
                pokeDataId: pokeDataMatch.id,
                tcgName: tcgSet.name,
                pokeDataName: pokeDataMatch.name,
                matchType: matchType
            };
            console.log(`🔄 Auto (${matchType}): ${tcgSet.id} (${tcgSet.name}) → ${pokeDataMatch.code || 'null'} (${pokeDataMatch.name})`);
        } else {
            unmappedTcg.push({
                id: tcgSet.id,
                name: tcgSet.name,
                ptcgoCode: tcgSet.ptcgoCode,
                releaseDate: tcgSet.releaseDate
            });
        }
    }

    // Find unmapped PokeData sets
    for (const pokeDataSet of englishPokeDataSets) {
        const isMapped = Object.values(mapping).some(m => m.pokeDataId === pokeDataSet.id);
        if (!isMapped) {
            unmappedPokeData.push({
                id: pokeDataSet.id,
                code: pokeDataSet.code,
                name: pokeDataSet.name,
                releaseDate: pokeDataSet.release_date
            });
        }
    }

    // Generate the final mapping file
    const mappingResult = {
        metadata: {
            generated: new Date().toISOString(),
            totalMappings: Object.keys(mapping).length,
            unmappedTcg: unmappedTcg.length,
            unmappedPokeData: unmappedPokeData.length,
            mappingStrategies: {
                manual: includeManual ? Object.values(mapping).filter(m => m.matchType === 'manual').length : 0,
                ptcgo_code: Object.values(mapping).filter(m => m.matchType === 'ptcgo_code').length,
                exact_name: Object.values(mapping).filter(m => m.matchType === 'exact_name').length,
                name_date_similarity: Object.values(mapping).filter(m => m.matchType === 'name_date_similarity').length,
                cleaned_name: Object.values(mapping).filter(m => m.matchType === 'cleaned_name').length
            }
        },
        mappings: mapping,
        unmapped: {
            pokemonTcg: unmappedTcg,
            pokeData: unmappedPokeData
        }
    };

    // Write the mapping file
    const outputPath = path.join(__dirname, '../data/set-mapping.json');
    fs.writeFileSync(outputPath, JSON.stringify(mappingResult, null, 2));

    console.log('\n📊 Mapping Results:');
    console.log(`✅ Successfully mapped: ${Object.keys(mapping).length} sets`);
    console.log(`❌ Unmapped Pokemon TCG sets: ${unmappedTcg.length}`);
    console.log(`❌ Unmapped PokeData sets: ${unmappedPokeData.length}`);

    console.log('\n📈 Mapping Strategy Breakdown:');
    Object.entries(mappingResult.metadata.mappingStrategies).forEach(([strategy, count]) => {
        console.log(`   ${strategy}: ${count} sets`);
    });

    if (unmappedTcg.length > 0) {
        console.log('\n🔍 Unmapped Pokemon TCG sets (first 10):');
        unmappedTcg.slice(0, 10).forEach(set => {
            console.log(`  - ${set.id}: ${set.name} (PTCGO: ${set.ptcgoCode || 'N/A'})`);
        });
    }

    console.log(`\n💾 Mapping saved to: ${outputPath}`);
}

async function main() {
    const args = process.argv.slice(2);
    
    console.log('Set Mapping Tool');
    console.log('================\n');
    
    if (args.includes('--analyze')) {
        analyzeMapping();
    } else if (args.includes('--generate')) {
        const includeManual = args.includes('--manual');
        generateMapping(includeManual);
    } else {
        console.log('Usage:');
        console.log('  node set-mapping.js --analyze           - Analyze PTCGO code coverage');
        console.log('  node set-mapping.js --generate          - Generate set mapping');
        console.log('  node set-mapping.js --generate --manual - Generate with manual mappings');
        console.log('\nExample:');
        console.log('  node set-mapping.js --generate --manual');
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
