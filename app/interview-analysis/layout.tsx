import PasswordGate from '@/components/interview-analysis/PasswordGate';
import './theme.css';

export const metadata = {
  title: 'Interview-Analyse',
};

export default function InterviewAnalysisLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ia-theme">
      <PasswordGate>{children}</PasswordGate>
    </div>
  );
}
