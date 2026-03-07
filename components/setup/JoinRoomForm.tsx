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
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6 shadow-xl h-fit">
      <h2 className="text-2xl font-semibold mb-6 text-white flex items-center gap-2">
        <span>👋</span> Join Existing Room
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        Enter the name of a room that is already in progress to join as a participant.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Your Name
          </label>
          <input
            type="text"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="e.g. Alice"
            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Room Name or ID
          </label>
          <input
            type="text"
            value={joinRoomName}
            onChange={(e) => setJoinRoomName(e.target.value)}
            placeholder="e.g. creative-minds-123"
            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
          />
        </div>

        <button
          onClick={handleJoin}
          className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium text-white border border-slate-600 transition-colors"
        >
          Join Room
        </button>
      </div>
    </div>
  );
}
