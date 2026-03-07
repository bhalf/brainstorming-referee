'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getHelpEntry } from '@/lib/help/helpContent';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';

interface InfoPopoverProps {
  helpKey: string;
  size?: 'xs' | 'sm';
}

export default function InfoPopover({ helpKey, size = 'xs' }: InfoPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const iconRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 640px)');

  const entry = getHelpEntry(helpKey);
  if (!entry) return null;

  const iconSize = size === 'xs' ? 12 : 14;

  const close = useCallback(() => setIsOpen(false), []);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, close]);

  // Close on click-outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        iconRef.current && !iconRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, close]);

  // Close on scroll (any ancestor)
  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = () => close();
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen, close]);

  // Compute desktop position
  const getPosition = (): React.CSSProperties => {
    if (isMobile || !iconRef.current) return {};
    const rect = iconRef.current.getBoundingClientRect();
    const popoverWidth = 320;
    const popoverMaxHeight = 384;
    const gap = 8;

    // Prefer right, fallback left
    let left = rect.right + gap;
    if (left + popoverWidth > window.innerWidth - 16) {
      left = rect.left - popoverWidth - gap;
    }
    if (left < 16) left = 16;

    // Prefer aligned to top of icon, fallback upwards
    let top = rect.top;
    if (top + popoverMaxHeight > window.innerHeight - 16) {
      top = window.innerHeight - popoverMaxHeight - 16;
    }
    if (top < 16) top = 16;

    return { position: 'fixed', left, top, width: popoverWidth, zIndex: 60 };
  };

  const popoverContent = (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-slate-200 leading-tight">{entry.title}</h4>
        <button
          onClick={close}
          className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 mt-0.5"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Summary */}
      <p className="text-xs text-slate-300 leading-relaxed mb-3">{entry.summary}</p>

      {/* Calculation */}
      {entry.calculation && (
        <div className="mb-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500 mb-1">Calculation</div>
          <p className="text-xs text-slate-400 leading-relaxed font-mono">{entry.calculation}</p>
        </div>
      )}

      {/* Good / Bad values */}
      {(entry.goodValue || entry.badValue) && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {entry.goodValue && (
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-green-500 mb-1">Good</div>
              <p className="text-xs text-slate-400 leading-relaxed">{entry.goodValue}</p>
            </div>
          )}
          {entry.badValue && (
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-red-400 mb-1">Warning</div>
              <p className="text-xs text-slate-400 leading-relaxed">{entry.badValue}</p>
            </div>
          )}
        </div>
      )}

      {/* Relevance */}
      {entry.relevance && (
        <div className="mb-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-blue-400 mb-1">Why it matters</div>
          <p className="text-xs text-slate-400 leading-relaxed">{entry.relevance}</p>
        </div>
      )}

      {/* Technical note */}
      {entry.technicalNote && (
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500 mb-1">Technical</div>
          <p className="text-xs text-slate-500 leading-relaxed italic">{entry.technicalNote}</p>
        </div>
      )}
    </>
  );

  return (
    <>
      <button
        ref={iconRef}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center justify-center"
        aria-label={`Info: ${entry.title}`}
        type="button"
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <text x="8" y="12" textAnchor="middle" fill="currentColor" fontSize="10" fontWeight="600" fontFamily="serif">i</text>
        </svg>
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        isMobile ? (
          // Mobile: Bottom Sheet
          <>
            <div className="fixed inset-0 bg-black/40 z-[60]" onClick={close} />
            <div
              ref={popoverRef}
              className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-600 rounded-t-xl max-h-[60vh] overflow-y-auto p-4 z-[61]"
            >
              {popoverContent}
            </div>
          </>
        ) : (
          // Desktop: Positioned Popover
          <div
            ref={popoverRef}
            style={getPosition()}
            className="max-h-96 overflow-y-auto bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-4"
          >
            {popoverContent}
          </div>
        ),
        document.body,
      )}
    </>
  );
}
