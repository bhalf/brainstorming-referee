'use client';

import { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
}

/** Consistent card/section wrapper used across all panels. */
export default function Panel({ children, className = '' }: PanelProps) {
  return (
    <section className={`bg-slate-700/30 rounded-lg p-4 ${className}`}>
      {children}
    </section>
  );
}
