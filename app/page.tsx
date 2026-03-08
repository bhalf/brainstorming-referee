'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DEFAULT_CONFIG,
  validateConfig,
  generateRoomName,
  saveConfigToStorage,
  loadConfigFromStorage,
  saveRoomToStorage,
  loadRoomFromStorage,
  encodeConfig,
} from '@/lib/config';
import { ExperimentConfig, Scenario } from '@/lib/types';
import JoinRoomForm from '@/components/setup/JoinRoomForm';
import ScenarioSelector from '@/components/setup/ScenarioSelector';
import LanguageSelector from '@/components/setup/LanguageSelector';
import AdvancedConfig from '@/components/setup/AdvancedConfig';

type Tab = 'new' | 'join';

export default function SetupPage() {
  const router = useRouter();

  // --- Tab State ---
  const [activeTab, setActiveTab] = useState<Tab>('new');

  // --- Form State ---
  const [roomName, setRoomName] = useState('');
  const [scenario, setScenario] = useState<Scenario>('A');
  const [language, setLanguage] = useState('en-US');
  const [config, setConfig] = useState<ExperimentConfig>(DEFAULT_CONFIG);
  const [errors, setErrors] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [existingRoom, setExistingRoom] = useState<{ scenario: string; language: string } | null>(null);

  // --- Load from localStorage on mount ---
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsHydrated(true);
    const savedConfig = loadConfigFromStorage();
    if (savedConfig) setConfig(savedConfig);
    const savedRoom = loadRoomFromStorage();
    setRoomName(savedRoom || generateRoomName());
  }, []);

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // --- Handlers ---
  const updateConfig = (key: keyof ExperimentConfig, value: number | boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleJoinRoom = (joinRoomName: string, joinName: string) => {
    if (!joinRoomName.trim()) { setErrors(['Please enter a room name to join']); return; }
    if (!joinName.trim()) { setErrors(['Please enter your name']); return; }
    router.push(
      `/call/${encodeURIComponent(joinRoomName.trim())}?role=participant&name=${encodeURIComponent(joinName.trim())}`
    );
  };

  const handleStartSession = async () => {
    const validation = validateConfig(config);
    if (!validation.isValid) { setErrors(validation.errors); return; }
    if (!roomName.trim()) { setErrors(['Room name is required']); return; }

    // Check if room already has an active session
    try {
      const res = await fetch(`/api/session?room=${encodeURIComponent(roomName.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setExistingRoom({ scenario: data.scenario, language: data.language });
        setErrors([]);
        return;
      }
    } catch {
      // Network error — proceed with creation attempt
    }

    saveConfigToStorage(config);
    saveRoomToStorage(roomName);
    const encodedConfig = encodeConfig(config);
    router.push(`/call/${encodeURIComponent(roomName)}?scenario=${scenario}&lang=${language}&config=${encodedConfig}`);
  };

  const handleJoinExisting = () => {
    router.push(`/call/${encodeURIComponent(roomName.trim())}?role=participant&name=Researcher`);
  };

  const handleResetConfig = () => {
    setConfig(DEFAULT_CONFIG);
    setErrors([]);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="mx-auto px-4 pt-16 pb-10 max-w-[540px]">

        {/* Header */}
        <header className="text-center mb-10">
          <div className="inline-block text-[11px] font-semibold tracking-widest uppercase text-slate-400 border border-slate-700 rounded-full px-3 py-1 mb-4">
            University of Zurich
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Brainstorming Lab
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">AI-Assisted Research Prototype</p>
        </header>

        {/* Tab Switcher */}
        <div className="flex bg-slate-800/60 rounded-lg p-1 mb-6">
          <button
            onClick={() => { setActiveTab('new'); setErrors([]); }}
            className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${activeTab === 'new'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-300'
              }`}
          >
            New Session
          </button>
          <button
            onClick={() => { setActiveTab('join'); setErrors([]); }}
            className={`flex-1 text-sm font-medium py-2 rounded-md transition-colors ${activeTab === 'join'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-300'
              }`}
          >
            Join Room
          </button>
        </div>

        {/* Card */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5">

          {activeTab === 'join' ? (
            <JoinRoomForm onJoin={handleJoinRoom} errors={errors} />
          ) : (
            <>
              {/* Room Name */}
              <section className="mb-5">
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                  Room Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => { setRoomName(e.target.value); setExistingRoom(null); }}
                    placeholder="Enter room name..."
                    className="flex-1 px-3 py-2.5 text-sm bg-slate-900/60 border border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors placeholder:text-slate-600"
                  />
                  <button
                    onClick={() => { setRoomName(generateRoomName()); setExistingRoom(null); }}
                    className="px-3 py-2.5 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 rounded-lg transition-colors text-slate-400 hover:text-white text-sm"
                    title="Generate random room name"
                  >
                    ↻
                  </button>
                </div>
              </section>

              <ScenarioSelector value={scenario} onChange={setScenario} />
              <LanguageSelector value={language} onChange={setLanguage} />
              <AdvancedConfig config={config} onUpdateConfig={updateConfig} onReset={handleResetConfig} />

              {/* Errors */}
              {errors.length > 0 && (
                <div className="mb-4 p-3 bg-red-950/40 border border-red-900/50 rounded-lg">
                  <ul className="text-sm text-red-400 list-disc list-inside space-y-0.5">
                    {errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Existing Room Warning */}
              {existingRoom && (
                <div className="mb-4 p-3 bg-yellow-950/30 border border-yellow-800/40 rounded-lg">
                  <p className="font-medium text-yellow-300 text-sm mb-0.5">
                    Room &quot;{roomName}&quot; is already active
                  </p>
                  <p className="text-xs text-yellow-500 mb-3">
                    Scenario {existingRoom.scenario} · {existingRoom.language}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleJoinExisting}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-medium text-white transition-colors"
                    >
                      Join as Participant
                    </button>
                    <button
                      onClick={() => setExistingRoom(null)}
                      className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium text-white transition-colors"
                    >
                      Choose Different Name
                    </button>
                  </div>
                </div>
              )}

              {/* Start Button */}
              <button
                onClick={handleStartSession}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium text-sm text-white transition-colors"
              >
                Start Brainstorming Session
              </button>
            </>
          )}
        </div>

        {/* Past Sessions */}
        <SessionsDisplay />

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-slate-600">
          <p>University of Zurich — Research Prototype</p>
        </footer>
      </div>
    </div>
  );
}

// --- Sessions Lists ---

interface SessionListItem {
  id: string;
  roomName: string;
  scenario: string;
  language: string;
  startedAt: string;
  endedAt: string | null;
  participantCount: number;
  hostIdentity?: string;
}

function formatDuration(startedAt: string): string {
  const seconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function SessionsDisplay() {
  const router = useRouter();
  const [active, setActive] = useState<SessionListItem[]>([]);
  const [past, setPast] = useState<SessionListItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions?limit=20');
      if (res.ok) {
        const data = await res.json();
        setActive(data.active || []);
        setPast(data.past || []);
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh every 10 seconds
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [load]);

  if (!loaded) return null;

  return (
    <>
      {/* Active Rooms */}
      {active.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active Rooms
          </h2>
          <div className="space-y-2">
            {active.map(s => (
              <div
                key={s.id}
                className="bg-slate-800/60 border border-emerald-900/30 rounded-xl p-4 flex items-center justify-between gap-3 hover:border-emerald-700/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium text-sm truncate">{s.roomName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 shrink-0">
                      Live
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>Scenario {s.scenario}</span>
                    <span>{s.language}</span>
                    <span>{formatDuration(s.startedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1 text-sm text-slate-300 bg-slate-700/50 px-2.5 py-1 rounded-lg">
                    <span>👥</span>
                    <span className="font-medium">{s.participantCount}</span>
                  </div>
                  <button
                    onClick={() => router.push(`/call/${encodeURIComponent(s.roomName)}?role=participant&name=Observer`)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-medium text-white transition-colors"
                  >
                    Join
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Sessions */}
      {past.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Past Sessions</h2>

          {/* Mobile: Card list */}
          <div className="sm:hidden space-y-2">
            {past.map(s => (
              <div key={s.id} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium text-sm truncate">{s.roomName}</div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                    <span>Scenario {s.scenario}</span>
                    <span>·</span>
                    <span>{new Date(s.startedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <Link
                  href={`/replay/${s.id}`}
                  className="shrink-0 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium text-blue-400 transition-colors min-h-[36px] flex items-center"
                >
                  Replay
                </Link>
              </div>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden sm:block bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/60 text-slate-500 text-left">
                  <th className="px-4 py-2.5 font-medium">Room</th>
                  <th className="px-4 py-2.5 font-medium">Scenario</th>
                  <th className="px-4 py-2.5 font-medium">Started</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {past.map(s => (
                  <tr key={s.id} className="border-b border-slate-700/30 last:border-b-0 hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-2.5 text-white font-medium">{s.roomName}</td>
                    <td className="px-4 py-2.5 text-slate-400">{s.scenario}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {new Date(s.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/replay/${s.id}`}
                        className="text-blue-400 hover:text-blue-300 text-[10px] font-medium"
                      >
                        Replay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
