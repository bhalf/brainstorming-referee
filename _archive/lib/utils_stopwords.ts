/**
 * Shared stopwords for English and German.
 * Used by Jaccard-based metrics (prevents common function words from inflating similarity).
 * Single source of truth — imported by computeMetrics and semanticDynamics.
 */
export const STOPWORDS = new Set([
    // English
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was',
    'one', 'our', 'out', 'has', 'have', 'that', 'this', 'with', 'they', 'from', 'been',
    'will', 'also', 'just', 'more', 'some', 'than', 'them', 'then', 'very', 'what', 'when',
    'who', 'how', 'its', 'let', 'into', 'about', 'would', 'could', 'should', 'there',
    'their', 'which', 'other', 'were', 'does', 'done', 'being', 'these', 'those',
    // German
    'der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'für', 'von', 'mit', 'auf', 'den',
    'dem', 'des', 'sich', 'als', 'auch', 'nach', 'wie', 'über', 'nicht', 'noch', 'bei',
    'aber', 'aus', 'dass', 'hat', 'ich', 'wir', 'sie', 'man', 'mir', 'uns', 'was', 'war',
    'wird', 'haben', 'sind', 'oder', 'nur', 'schon', 'dann', 'eben', 'also', 'wenn',
    'doch', 'kann', 'hier', 'gibt', 'zum', 'zur', 'einen', 'einer', 'einem', 'eines',
]);
