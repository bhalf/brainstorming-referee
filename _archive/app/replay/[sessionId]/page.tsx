'use client';

import { use } from 'react';
import SessionReplayView from '@/components/SessionReplayView';

interface ReplayPageProps {
  params: Promise<{ sessionId: string }>;
}

export default function ReplayPage({ params }: ReplayPageProps) {
  const { sessionId } = use(params);
  return <SessionReplayView sessionId={sessionId} />;
}
