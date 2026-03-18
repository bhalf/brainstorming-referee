'use client';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
}

/**
 * Consistent empty/placeholder state for feeds and panels.
 * Centers an icon, title, and optional subtitle vertically.
 *
 * @param icon - Emoji or icon string displayed prominently.
 * @param title - Primary message explaining the empty state.
 * @param subtitle - Optional secondary message with more detail.
 */
export default function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="h-full flex items-center justify-center text-slate-500 text-sm">
      <div className="text-center">
        <p className="mb-2 text-lg">{icon}</p>
        <p>{title}</p>
        {subtitle && (
          <p className="text-xs mt-1 text-slate-600">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
