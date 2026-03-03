'use client';

import { ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative inline-flex group">
      {children}
      <div
        className={`absolute ${positionClasses[position]} z-50 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none whitespace-nowrap max-w-xs`}
      >
        {content}
        <div className="absolute w-2 h-2 bg-slate-900 rotate-45 left-1/2 -translate-x-1/2 -bottom-1" />
      </div>
    </div>
  );
}

