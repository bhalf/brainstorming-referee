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
import { apiGet } from '@/lib/services/apiClient';
import JoinRoomForm from '@/components/setup/JoinRoomForm';
import ScenarioSelector from '@/components/setup/ScenarioSelector';
import LanguageSelector from '@/components/setup/LanguageSelector';
import AdvancedConfig from '@/components/setup/AdvancedConfig';
import { SessionsDisplay } from '@/components/setup/SessionsDisplay';

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
      const data = await apiGet<{ scenario?: string; language?: string }>(
        '/api/session',
        { room: roomName.trim() },
      );
      setExistingRoom({ scenario: data.scenario ?? '', language: data.language ?? '' });
      setErrors([]);
      return;
    } catch {
      // Network error or no session — proceed with creation attempt
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

              {/* Participant View Restriction */}
              <section className="mb-5">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <span className="block text-xs font-medium text-slate-400 uppercase tracking-wide">
                      Restrict Participant View
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Participants only see Summary, Interventions, Transcript &amp; Ideas
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={config.PARTICIPANT_VIEW_RESTRICTED}
                    onClick={() => updateConfig('PARTICIPANT_VIEW_RESTRICTED', !config.PARTICIPANT_VIEW_RESTRICTED)}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                      config.PARTICIPANT_VIEW_RESTRICTED ? 'bg-blue-600' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                        config.PARTICIPANT_VIEW_RESTRICTED ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
              </section>

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

