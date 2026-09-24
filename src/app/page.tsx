'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { DuelArena } from '@/components/DuelArena';

export default function HomePage() {
  const [votesCount, setVotesCount] = useState<number>(0);

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col justify-between">
      <Navbar userVotesCount={votesCount} />

      <main className="flex-1 flex flex-col justify-center items-center">
        <DuelArena onVoteSuccess={(newCount) => setVotesCount(newCount)} />
      </main>

      <footer className="py-4 border-t border-white/5 text-center text-xs text-zinc-500">
        LetiGirl
      </footer>
    </div>
  );
}
