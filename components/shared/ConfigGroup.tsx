import { ReactNode } from 'react';
import InfoPopover from './InfoPopover';

interface ConfigGroupProps {
  title: string;
  children: ReactNode;
  helpKey?: string;
}

export default function ConfigGroup({ title, children, helpKey }: ConfigGroupProps) {
  return (
    <div className="space-y-3 min-w-0">
      <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wide border-b border-slate-700 pb-2">
        {title}
        {helpKey && <span className="ml-1.5 inline-flex align-middle"><InfoPopover helpKey={helpKey} size="xs" /></span>}
      </h4>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}
