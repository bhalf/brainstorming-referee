import { ReactNode } from 'react';

interface ConfigGroupProps {
  title: string;
  children: ReactNode;
}

export default function ConfigGroup({ title, children }: ConfigGroupProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide border-b border-slate-700 pb-2">
        {title}
      </h4>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
