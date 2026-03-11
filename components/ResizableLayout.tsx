'use client';

import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';

// --- Storage helpers ---
const STORAGE_KEY_H = 'brainstorming-layout-h';
const STORAGE_KEY_V = 'brainstorming-layout-v';

function loadRatio(key: string, fallback: number): number {
    if (typeof window === 'undefined') return fallback;
    const v = localStorage.getItem(key);
    if (v) {
        const n = parseFloat(v);
        if (!isNaN(n) && n > 0 && n < 1) return n;
    }
    return fallback;
}

function saveRatio(key: string, value: number) {
    localStorage.setItem(key, value.toFixed(4));
}

// --- Constants ---
const DEFAULT_H = 0.6;   // left column = 60%
const DEFAULT_V = 0.65;  // video = 65% of left column height
const MIN_H = 0.3;
const MAX_H = 0.8;
const MIN_V = 0.25;
const MAX_V = 0.85;
const HANDLE_SIZE = 5; // px

interface ResizableLayoutProps {
    /** Top-left zone (Video) */
    topLeft: ReactNode;
    /** Bottom-left zone (IdeaBoard) */
    bottomLeft: ReactNode;
    /** Right zone (OverlayPanel) */
    right: ReactNode;
}

/**
 * Desktop-only resizable 2-column layout with a vertical splitter in the left column.
 * Persists horizontal (left/right) and vertical (video/idea board) ratios to localStorage.
 * Double-click a handle to reset to default ratios.
 *
 * @param topLeft - Content for the top-left zone (typically video).
 * @param bottomLeft - Content for the bottom-left zone (typically idea board).
 * @param right - Content for the right zone (typically overlay panel).
 */
export default function ResizableLayout({ topLeft, bottomLeft, right }: ResizableLayoutProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [hRatio, setHRatio] = useState(() => loadRatio(STORAGE_KEY_H, DEFAULT_H));
    const [vRatio, setVRatio] = useState(() => loadRatio(STORAGE_KEY_V, DEFAULT_V));

    // Persist on change
    useEffect(() => { saveRatio(STORAGE_KEY_H, hRatio); }, [hRatio]);
    useEffect(() => { saveRatio(STORAGE_KEY_V, vRatio); }, [vRatio]);

    // Tracks which handle is being dragged ('h' for horizontal, 'v' for vertical)
    const dragging = useRef<'h' | 'v' | null>(null);

    const onMouseMove = useCallback((e: MouseEvent) => {
        if (!dragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        if (dragging.current === 'h') {
            const ratio = (e.clientX - rect.left) / rect.width;
            setHRatio(Math.min(MAX_H, Math.max(MIN_H, ratio)));
        } else {
            const ratio = (e.clientY - rect.top) / rect.height;
            setVRatio(Math.min(MAX_V, Math.max(MIN_V, ratio)));
        }
    }, []);

    const onMouseUp = useCallback(() => {
        dragging.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    useEffect(() => {
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [onMouseMove, onMouseUp]);

    const startDragH = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        dragging.current = 'h';
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    const startDragV = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        dragging.current = 'v';
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
    }, []);

    const resetH = useCallback(() => setHRatio(DEFAULT_H), []);
    const resetV = useCallback(() => setVRatio(DEFAULT_V), []);

    const leftWidth = `calc(${(hRatio * 100).toFixed(2)}% - ${HANDLE_SIZE / 2}px)`;
    const rightWidth = `calc(${((1 - hRatio) * 100).toFixed(2)}% - ${HANDLE_SIZE / 2}px)`;
    const topHeight = `calc(${(vRatio * 100).toFixed(2)}% - ${HANDLE_SIZE / 2}px)`;
    const bottomHeight = `calc(${((1 - vRatio) * 100).toFixed(2)}% - ${HANDLE_SIZE / 2}px)`;

    return (
        <div ref={containerRef} className="hidden lg:flex h-full w-full">
            {/* Left Column */}
            <div className="flex flex-col min-w-0 min-h-0" style={{ width: leftWidth }}>
                {/* Top Left (Video) */}
                <div className="min-h-0 overflow-hidden p-2 pb-0" style={{ height: topHeight }}>
                    {topLeft}
                </div>

                {/* Vertical Handle */}
                <div
                    className="group shrink-0 flex items-center justify-center cursor-row-resize mx-2 touch-handle"
                    style={{ height: HANDLE_SIZE }}
                    onMouseDown={startDragV}
                    onDoubleClick={resetV}
                >
                    <div className="w-12 h-[3px] rounded-full bg-slate-700 group-hover:bg-blue-500 transition-colors" />
                </div>

                {/* Bottom Left (IdeaBoard) */}
                <div className="min-h-0 overflow-hidden p-2 pt-0" style={{ height: bottomHeight }}>
                    {bottomLeft}
                </div>
            </div>

            {/* Horizontal Handle */}
            <div
                className="group shrink-0 flex items-center justify-center cursor-col-resize py-2 touch-handle"
                style={{ width: HANDLE_SIZE }}
                onMouseDown={startDragH}
                onDoubleClick={resetH}
            >
                <div className="h-12 w-[3px] rounded-full bg-slate-700 group-hover:bg-blue-500 transition-colors" />
            </div>

            {/* Right Column (OverlayPanel) */}
            <div className="min-w-0 min-h-0 p-2 pl-0" style={{ width: rightWidth }}>
                {right}
            </div>
        </div>
    );
}
