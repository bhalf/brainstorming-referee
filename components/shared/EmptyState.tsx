'use client';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
}

/** Consistent empty/placeholder state for feeds and panels. */
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
