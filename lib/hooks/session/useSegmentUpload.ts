import { useEffect, useRef, useCallback } from 'react';
import { TranscriptSegment } from '@/lib/types';
import { uploadSegment as uploadSegmentApi } from '@/lib/services/segmentService';

/**
 * Manages segment uploads to the backend, including a pending queue
 * for segments created before the sessionId is available.
 */

interface UseSegmentUploadParams {
    sessionId: string | null;
}

interface UseSegmentUploadReturn {
    uploadSegment: (segment: TranscriptSegment) => void;
}

export function useSegmentUpload({ sessionId }: UseSegmentUploadParams): UseSegmentUploadReturn {
    const sessionIdRef = useRef<string | null>(null);
    const pendingUploadsRef = useRef<TranscriptSegment[]>([]);

    // Flush pending queue when sessionId becomes available
    useEffect(() => {
        sessionIdRef.current = sessionId;
        if (sessionId && pendingUploadsRef.current.length > 0) {
            const pending = [...pendingUploadsRef.current];
            pendingUploadsRef.current = [];
            for (const seg of pending) {
                uploadSegmentApi(sessionId, seg);
            }
        }
    }, [sessionId]);

    const uploadSegment = useCallback((segment: TranscriptSegment) => {
        const sid = sessionIdRef.current;
        if (!sid) {
            pendingUploadsRef.current.push(segment);
            return;
        }
        uploadSegmentApi(sid, segment);
    }, []);

    return { uploadSegment };
}
