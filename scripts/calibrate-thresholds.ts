/**
 * Cosine Threshold Calibration Script
 *
 * Generates embeddings for representative brainstorming sentences and computes
 * pairwise cosine similarities. Use this to empirically determine the correct
 * threshold values for your specific embedding model.
 *
 * Usage: npx ts-node scripts/calibrate-thresholds.ts
 *
 * Requires: OPENAI_API_KEY environment variable
 */

const SAMPLE_SENTENCES = [
    // Same-topic cluster (should be HIGH similarity)
    'Wir könnten eine Gamification-Lösung mit Punkten und Belohnungen einbauen',
    'Ein Belohnungssystem mit Badges und Leveln motiviert die Nutzer',
    'Gamification mit Leaderboards und Achievements wäre super',

    // Different-topic cluster (should be LOWER similarity)
    'KI-Integration könnte automatisierte Empfehlungen generieren',
    'Machine Learning Modelle analysieren das Nutzerverhalten',

    // Completely different topic (should be LOWEST similarity)
    'Das UI-Design sollte minimalistisch und modern sein',
    'Ein Dark-Mode würde die Augen schonen',

    // Very short stichworte (Popcorn-Brainstorming)
    'Gamification!',
    'Punkte-System!',
    'KI-Integration!',
    'Nachhaltigkeit!',
    'Community-Building!',

    // English variants
    'We should add a recommendation engine powered by AI',
    'The user interface needs to be more intuitive',
    'Social features like comments and likes increase engagement',
    'Data privacy is critical for user trust',
];

interface EmbeddingResponse {
    data: Array<{ embedding: number[] }>;
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: texts,
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as EmbeddingResponse;
    return data.data.map(d => d.embedding);
}

function cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dotProduct / denom : 0;
}

async function main() {
    console.log('🎯 Cosine Threshold Calibration');
    console.log('================================\n');
    console.log(`Embedding model: text-embedding-3-small`);
    console.log(`Sample sentences: ${SAMPLE_SENTENCES.length}\n`);

    console.log('Fetching embeddings...');
    const embeddings = await getEmbeddings(SAMPLE_SENTENCES);
    console.log('Done!\n');

    // Compute all pairwise similarities
    const similarities: { i: number; j: number; sim: number }[] = [];
    for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
            similarities.push({
                i,
                j,
                sim: cosineSimilarity(embeddings[i], embeddings[j]),
            });
        }
    }

    // Sort by similarity descending
    similarities.sort((a, b) => b.sim - a.sim);

    // Print results
    console.log('📊 Pairwise Cosine Similarities (sorted)\n');
    console.log('Sim   | Sentence A (truncated)              | Sentence B (truncated)');
    console.log('------+-------------------------------------+-------------------------------------');

    for (const { i, j, sim } of similarities) {
        const a = SAMPLE_SENTENCES[i].substring(0, 35).padEnd(35);
        const b = SAMPLE_SENTENCES[j].substring(0, 35).padEnd(35);
        const simStr = sim.toFixed(4);
        console.log(`${simStr} | ${a} | ${b}`);
    }

    // Statistics
    const allSims = similarities.map(s => s.sim);
    const min = Math.min(...allSims);
    const max = Math.max(...allSims);
    const mean = allSims.reduce((a, b) => a + b, 0) / allSims.length;
    const sorted = [...allSims].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];

    console.log('\n📈 Distribution Statistics\n');
    console.log(`  Min:      ${min.toFixed(4)}`);
    console.log(`  P25:      ${p25.toFixed(4)}`);
    console.log(`  Median:   ${median.toFixed(4)}`);
    console.log(`  Mean:     ${mean.toFixed(4)}`);
    console.log(`  P75:      ${p75.toFixed(4)}`);
    console.log(`  Max:      ${max.toFixed(4)}`);

    console.log('\n🎯 Recommended Threshold Ranges\n');
    console.log(`  NOVELTY_COSINE_THRESHOLD:      ${(p75 + 0.02).toFixed(2)} - ${(max - 0.05).toFixed(2)}  (current: 0.65)`);
    console.log(`  CLUSTER_MERGE_THRESHOLD:       ${(median).toFixed(2)} - ${(p75).toFixed(2)}  (current: 0.60)`);
    console.log(`  STAGNATION_NOVELTY_THRESHOLD:  ${(p75).toFixed(2)} - ${(max - 0.03).toFixed(2)}  (current: 0.70)`);
    console.log(`  EXPLORATION_COSINE_THRESHOLD:  ${(p25).toFixed(2)} - ${(median).toFixed(2)}  (current: 0.55)`);
    console.log(`  ELABORATION_COSINE_THRESHOLD:  ${(p75).toFixed(2)} - ${(max - 0.05).toFixed(2)}  (current: 0.70)`);
    console.log('\n⚠️  Review the pairwise table above to validate these ranges.');
    console.log('   Adjust thresholds so that "same-topic" pairs are ABOVE the threshold');
    console.log('   and "different-topic" pairs are BELOW it.');
}

main().catch(console.error);
