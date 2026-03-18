import { useCallback } from 'react';
import { useCloudTTS } from '@/lib/tts/useCloudTTS';
import { logTTSEvent } from '@/lib/services/eventService';

interface UseTTSManagerParams {
    voiceName: string;
    rate: number;
    volume: number;
    language: string;
    sessionId: string | null;
    addError: (message: string, context?: string) => void;
}

export function useTTSManager({ voiceName, rate, volume, language, sessionId, addError }: UseTTSManagerParams) {
    const cloudTTS = useCloudTTS({
        voice: (voiceName as import('@/lib/tts/useCloudTTS').CloudTTSVoice) || 'nova',
        speed: rate,
        volume: volume,
        onError: (err) => {
            console.warn('Cloud TTS error:', err);
            addError(err, 'tts');
        },
        onTTSEvent: (event) => {
            logTTSEvent(sessionId, {
                event: event.type,
                durationMs: event.durationMs,
                voice: voiceName,
                method: event.method,
                error: event.error,
                textLength: event.textLength,
            });
        },
    });

    const speak = useCallback((text: string): boolean => {
        return cloudTTS.speak(text);
    }, [cloudTTS]);

    const cancelSpeech = useCallback(() => {
        cloudTTS.cancel();
    }, [cloudTTS]);

    const handleTestVoice = useCallback(() => {
        const testText = language.startsWith('de')
            ? 'Dies ist ein Test der Sprachausgabe. Die Stimme klingt jetzt klar und deutlich.'
            : 'This is a test of the voice output. The voice should sound clear and natural.';
        speak(testText);
    }, [speak, language]);

    const handleCancelVoice = useCallback(() => {
        cancelSpeech();
    }, [cancelSpeech]);

    return {
        speak,
        cancelSpeech,
        isSpeaking: cloudTTS.isSpeaking,
        isTTSSupported: cloudTTS.isSupported,
        handleTestVoice,
        handleCancelVoice,
    };
}
