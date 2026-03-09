import { useCallback } from 'react';
import { useCloudTTS } from '@/lib/tts/useCloudTTS';

interface UseTTSManagerParams {
    voiceName: string;
    rate: number;
    volume: number;
    language: string;
    addError: (message: string, context?: string) => void;
}

export function useTTSManager({ voiceName, rate, volume, language, addError }: UseTTSManagerParams) {
    const cloudTTS = useCloudTTS({
        voice: (voiceName as import('@/lib/tts/useCloudTTS').CloudTTSVoice) || 'nova',
        speed: rate,
        volume: volume,
        onError: (err) => {
            console.warn('Cloud TTS error:', err);
            addError(err, 'tts');
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
