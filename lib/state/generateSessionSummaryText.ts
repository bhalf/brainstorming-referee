import { MetricSnapshot } from '../types';

/**
 * Generates a human-readable, continuously updating text summary of the current 
 * session state based on all core conversation metrics to ensure the "truth" 
 * of the session is always transparent to the user.
 */
export function generateSessionSummaryText(metrics: MetricSnapshot | null): string {
    if (!metrics) return "Waiting for speech data to begin analysis...";

    const sentences: string[] = [];
    const { participation, semanticDynamics, stagnationDuration } = metrics;

    // 1. Stagnation (Activity Flow)
    const isStagnant = stagnationDuration > 60;
    if (isStagnant) {
        if (stagnationDuration > 120) {
            sentences.push(`The conversation has been stalled for over ${Math.floor(stagnationDuration / 60)} minutes without introducing new ideas.`);
        } else {
            sentences.push("The flow of new information has paused recently.");
        }
    }

    // 2. Participation Balance
    // Use known participant count and speaking distribution to verify if we just have 1 speaker
    const speakerCount = Object.keys(metrics.speakingTimeDistribution).length;

    if (speakerCount <= 1) {
        if (!isStagnant) {
            sentences.push("Only one person is currently speaking.");
        }
    } else if (participation) {
        if (participation.participationRiskScore > 0.6) {
            sentences.push("Participation is highly imbalanced, with one or more voices dominating.");
        } else if (participation.participationRiskScore > 0.4) {
            sentences.push("Speaking time is slightly uneven among participants.");
        } else {
            if (!isStagnant) {
                sentences.push("Participation is well balanced across the group.");
            } else {
                sentences.push("When active, participation remains balanced.");
            }
        }
    }

    // 3. Idea Novelty and Content (Semantic Dynamics)
    if (semanticDynamics) {
        if (semanticDynamics.noveltyRate < 0.35) {
            sentences.push("The discussion is narrowing, focusing heavily on repeating previous points.");
        } else if (semanticDynamics.noveltyRate > 0.7 && !isStagnant && speakerCount > 1) {
            sentences.push("A healthy variety of fresh perspectives are being actively explored.");
        }
    }

    // Fallback if everything is in the exact middle / neutral
    if (sentences.length === 0) {
        return "The session is currently proceeding normally with steady activity.";
    }

    // Join the sentences intelligently
    return sentences.join(" ");
}
