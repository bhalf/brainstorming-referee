'use client';

import { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
}

/**
 * Consistent card/section wrapper used across all panels.
 * Provides a dark translucent background with rounded corners.
 *
 * @param children - Panel content.
 * @param className - Additional CSS classes (use !p-3 to override default padding).
 */
export default function Panel({ children, className = '' }: PanelProps) {
  return (
    <section className={`bg-slate-700/30 rounded-lg p-4 ${className}`}>
      {children}
    </section>
  );
}
