'use client';

import { useState } from 'react';

interface JoinRoomFormProps {
  onJoin: (roomName: string, name: string) => void;
  errors: string[];
}

export default function JoinRoomForm({ onJoin, errors }: JoinRoomFormProps) {
  const [joinRoomName, setJoinRoomName] = useState('');
  const [joinName, setJoinName] = useState('');

  const handleJoin = () => {
    onJoin(joinRoomName, joinName);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 mb-1">
        Enter the name of an active room to join as a participant.
      </p>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
          Your Name
        </label>
        <input
          type="text"
          value={joinName}
          onChange={(e) => setJoinName(e.target.value)}
          placeholder="e.g. Alice"
          className="w-full px-3 py-2.5 text-sm bg-slate-900/60 border border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors placeholder:text-slate-600"
          onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
          Room Name or ID
        </label>
        <input
          type="text"
          value={joinRoomName}
          onChange={(e) => setJoinRoomName(e.target.value)}
          placeholder="e.g. creative-minds-123"
          className="w-full px-3 py-2.5 text-sm bg-slate-900/60 border border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors placeholder:text-slate-600"
          onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
        />
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg">
          <ul className="text-sm text-red-400 list-disc list-inside space-y-0.5">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={handleJoin}
        className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium text-sm text-white transition-colors"
      >
        Join Room
      </button>
    </div>
  );
}
