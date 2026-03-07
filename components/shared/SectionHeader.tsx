'use client';

interface SectionHeaderProps {
  icon?: string;
  children: React.ReactNode;
  /** Optional smaller description below the heading. */
  description?: string;
  /** Use 'panel' (smaller) inside panels, 'page' (larger) for top-level. */
  size?: 'panel' | 'page';
}

/** Consistent section heading used across all panels and pages. */
export default function SectionHeader({
  icon,
  children,
  description,
  size = 'panel',
}: SectionHeaderProps) {
  const headingClass = size === 'page'
    ? 'text-sm font-semibold text-slate-300'
    : 'text-xs font-medium text-slate-400 uppercase tracking-wide';

  return (
    <div className="mb-3">
      <h3 className={headingClass}>
        {icon && <span className="mr-1.5">{icon}</span>}
        {children}
      </h3>
      {description && (
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      )}
    </div>
  );
}
