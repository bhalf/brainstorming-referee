import PasswordGate from '@/components/interview-analysis/PasswordGate';
import LanguageToggle from '@/components/interview-analysis/LanguageToggle';
import { IALanguageProvider } from '@/lib/interview-analysis/i18n';
import './theme.css';

export const metadata = {
  title: 'Interview-Analyse',
};

export default function InterviewAnalysisLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ia-theme">
      <IALanguageProvider>
        <LanguageToggle />
        <PasswordGate>{children}</PasswordGate>
      </IALanguageProvider>
    </div>
  );
}
