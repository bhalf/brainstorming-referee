'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function SetupPage() {
  const router = useRouter();

  // --- Form State ---
  const [roomName, setRoomName] = useState('');
  const [scenario, setScenario] = useState<Scenario>('A');
  const [language, setLanguage] = useState('en-US');
  const [config, setConfig] = useState<ExperimentConfig>(DEFAULT_CONFIG);
  const [errors, setErrors] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

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
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // --- Handlers ---
  const updateConfig = (key: keyof ExperimentConfig, value: number) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleJoinRoom = (joinRoomName: string, joinName: string) => {
    if (!joinRoomName.trim()) { setErrors(['Please enter a room name to join']); return; }
    if (!joinName.trim()) { setErrors(['Please enter your name']); return; }
    router.push(
      `/call/${encodeURIComponent(joinRoomName.trim())}?role=participant&name=${encodeURIComponent(joinName.trim())}`
    );
  };

  const handleStartSession = () => {
    const validation = validateConfig(config);
    if (!validation.isValid) { setErrors(validation.errors); return; }
    if (!roomName.trim()) { setErrors(['Room name is required']); return; }

    saveConfigToStorage(config);
    saveRoomToStorage(roomName);
    const encodedConfig = encodeConfig(config);
    router.push(`/call/${encodeURIComponent(roomName)}?scenario=${scenario}&lang=${language}&config=${encodedConfig}`);
  };

  const handleResetConfig = () => {
    setConfig(DEFAULT_CONFIG);
    setErrors([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">

        {/* Header */}
        <header className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            UZH Brainstorming
          </h1>
          <p className="text-slate-400">AI-Assisted Brainstorming Research Prototype</p>
        </header>

        {/* Main Grid: Join Existing vs Create New */}
        <div className="grid md:grid-cols-2 gap-8">

          {/* Left Column: Join Existing Room */}
          <JoinRoomForm onJoin={handleJoinRoom} errors={errors} />

          {/* Right Column: Create New Room */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 shadow-xl">
            <h2 className="text-2xl font-semibold mb-6 text-white flex items-center gap-2">
              <span>🚀</span> Start New Session
            </h2>

            {/* Room Name */}
            <section className="mb-8">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Room Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Enter room name..."
                  className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  onClick={() => setRoomName(generateRoomName())}
                  className="px-4 py-3 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
                  title="Generate random room name"
                >
                  🎲
                </button>
              </div>
            </section>

            <ScenarioSelector value={scenario} onChange={setScenario} />
            <LanguageSelector value={language} onChange={setLanguage} />
            <AdvancedConfig config={config} onUpdateConfig={updateConfig} onReset={handleResetConfig} />

            {/* Errors */}
            {errors.length > 0 && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg">
                <h4 className="font-medium text-red-400 mb-2">Validation Errors</h4>
                <ul className="text-sm text-red-300 list-disc list-inside">
                  {errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Start Button */}
            <button
              onClick={handleStartSession}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]"
            >
              Start Brainstorming Session
            </button>
          </div>

        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-slate-500">
          <p>University of Zurich - Research Prototype</p>
        </footer>
      </div>
    </div>
  );
}
