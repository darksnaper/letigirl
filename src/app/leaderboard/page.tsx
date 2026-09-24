'use client';

import React from 'react';
import { Navbar } from '@/components/Navbar';
import { LeaderboardTable } from '@/components/LeaderboardTable';

export default function LeaderboardPage() {
  const votesCount = 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar userVotesCount={votesCount} />
      <main className="flex-1">
        <LeaderboardTable />
      </main>
      <footer className="py-4 border-t border-white/5 text-center text-xs text-zinc-500">
        LetiGirl
      </footer>
    </div>
  );
}
