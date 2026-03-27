'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { IAProject, IAInterview, IAGuideQuestion, MatrixData } from '@/types/interview-analysis';
import { useIALang, t } from '@/lib/interview-analysis/i18n';
import UploadTab from '@/components/interview-analysis/UploadTab';
import PipelineControls from '@/components/interview-analysis/PipelineControls';
import GuideEditor from '@/components/interview-analysis/GuideEditor';
import MatrixView from '@/components/interview-analysis/MatrixView';
import ChatView from '@/components/interview-analysis/ChatView';
import DashboardView from '@/components/interview-analysis/DashboardView';
import HeatmapView from '@/components/interview-analysis/HeatmapView';
import ComparisonView from '@/components/interview-analysis/ComparisonView';
import GroupComparisonView from '@/components/interview-analysis/GroupComparisonView';

type Tab = 'upload' | 'guide' | 'matrix' | 'heatmap' | 'comparison' | 'groups' | 'dashboard' | 'chat';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<IAProject | null>(null);
  const [interviews, setInterviews] = useState<IAInterview[]>([]);
  const [guideQuestions, setGuideQuestions] = useState<IAGuideQuestion[]>([]);
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [loading, setLoading] = useState(true);
  const lang = useIALang();

  const loadProject = useCallback(async () => {
    try {
      const [projRes, intRes] = await Promise.all([
        fetch(`/api/interview-analysis/projects/${projectId}`),
        fetch(`/api/interview-analysis/projects/${projectId}/interviews`),
      ]);
      if (projRes.ok) {
        setProject(await projRes.json());
      }
      if (intRes.ok) {
        const ints = await intRes.json();
        setInterviews(Array.isArray(ints) ? ints : []);
      }
    } catch {
      // Network error — keep previous state
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadGuide = useCallback(async () => {
    const res = await fetch(`/api/interview-analysis/projects/${projectId}/guide-questions`);
    if (res.ok) {
      const data = await res.json();
      setGuideQuestions(Array.isArray(data) ? data : []);
    }
  }, [projectId]);

  const loadMatrix = useCallback(async () => {
    const res = await fetch(`/api/interview-analysis/projects/${projectId}/matrix`);
    if (res.ok) {
      const data = await res.json();
      setMatrixData(data);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
    loadGuide();
    loadMatrix();
  }, [loadProject, loadGuide, loadMatrix]);

  function handleRefresh() {
    loadProject();
    loadGuide();
    loadMatrix();
  }

  async function handleGenerateSummary(canonicalQuestionId: string) {
    try {
      const res = await fetch(`/api/interview-analysis/projects/${projectId}/summarize-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonicalQuestionId }),
      });
      if (!res.ok) return;
    } catch {
      return;
    }
    loadMatrix();
  }

  if (loading) {
    return (
      <div className="ia-page flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="ia-skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
      </div>
    );
  }

  const hasCanonicalQuestions = (matrixData?.questions.length ?? 0) > 0;
  const hasAnswers = (matrixData?.questions.some(q => q.answers.length > 0)) ?? false;

  const tabs = [
    { key: 'upload' as Tab, label: t('tab_upload', lang), count: interviews.length, icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    )},
    { key: 'guide' as Tab, label: t('tab_guide', lang), count: guideQuestions.length, icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    )},
    { key: 'matrix' as Tab, label: t('tab_matrix', lang), count: matrixData?.questions.length ?? 0, icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    )},
    ...(hasAnswers ? [
      { key: 'heatmap' as Tab, label: t('tab_heatmap', lang), count: 0, icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <rect x="7" y="7" width="3" height="3" /><rect x="14" y="7" width="3" height="3" />
          <rect x="7" y="14" width="3" height="3" /><rect x="14" y="14" width="3" height="3" />
        </svg>
      )},
      { key: 'comparison' as Tab, label: t('tab_comparison', lang), count: 0, icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="8" height="18" rx="1" /><rect x="14" y="3" width="8" height="18" rx="1" />
        </svg>
      )},
      ...(interviews.some(i => i.group_label) ? [
        { key: 'groups' as Tab, label: t('tab_groups', lang), count: new Set(interviews.map(i => i.group_label).filter(Boolean)).size, icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        )},
      ] : []),
      { key: 'dashboard' as Tab, label: t('tab_dashboard', lang), count: 0, icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
        </svg>
      )},
      { key: 'chat' as Tab, label: t('tab_chat', lang), count: 0, icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )},
    ] : []),
  ];

  return (
    <div className="ia-page">
      <div className="max-w-6xl mx-auto">
        {/* Back + Header */}
        <div className="mb-6">
          <Link
            href="/interview-analysis"
            className="ia-btn ia-btn-ghost ia-btn-sm inline-flex items-center gap-1.5 mb-3"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
            {t('back', lang)}
          </Link>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--ia-text)' }}>
              {project?.name}
            </h1>
            {project?.description && (
              <p className="text-sm mt-1" style={{ color: 'var(--ia-text-secondary)' }}>
                {project.description}
              </p>
            )}
          </div>
        </div>

        {/* Pipeline Controls */}
        <PipelineControls
          projectId={projectId}
          interviews={interviews}
          hasCanonicalQuestions={hasCanonicalQuestions}
          hasAnswers={hasAnswers}
          onRefresh={handleRefresh}
          guideQuestionCount={guideQuestions.length}
        />

        {/* Tabs */}
        <div className="ia-tabs mt-6 mb-5">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`ia-tab ${activeTab === tab.key ? 'ia-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span className="ia-badge ia-badge-neutral" style={{ fontSize: '11px', marginLeft: '4px' }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'upload' && (
          <UploadTab
            projectId={projectId}
            interviews={interviews}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'guide' && (
          <GuideEditor
            projectId={projectId}
            guideQuestions={guideQuestions}
            rawText={project?.guide_raw_text ?? null}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'matrix' && (
          <MatrixView
            questions={matrixData?.questions ?? []}
            interviews={matrixData?.interviews ?? []}
            projectId={projectId}
            onGenerateSummary={handleGenerateSummary}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'heatmap' && (
          <HeatmapView
            questions={matrixData?.questions ?? []}
            interviews={matrixData?.interviews ?? []}
          />
        )}

        {activeTab === 'comparison' && (
          <ComparisonView
            questions={matrixData?.questions ?? []}
            interviews={matrixData?.interviews ?? []}
          />
        )}

        {activeTab === 'groups' && (
          <GroupComparisonView
            questions={matrixData?.questions ?? []}
            interviews={matrixData?.interviews ?? []}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            questions={matrixData?.questions ?? []}
            interviews={matrixData?.interviews ?? []}
          />
        )}

        {activeTab === 'chat' && (
          <ChatView
            projectId={projectId}
            interviewCount={(matrixData?.interviews ?? []).filter(i => ['transcribed', 'analyzed'].includes(i.status)).length}
            answerCount={(matrixData?.questions ?? []).reduce((sum, q) => sum + q.answers.length, 0)}
            questionCount={(matrixData?.questions ?? []).length}
          />
        )}
      </div>
    </div>
  );
}
