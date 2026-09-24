'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavbarProps {
  userVotesCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ userVotesCount = 0 }) => {
  const pathname = usePathname();

  return (
    <header className="w-full bg-slate-950/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="font-bold text-lg tracking-tight text-white">
            Leti<span className="text-rose-500">Girl</span>
          </span>
        </Link>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
          <Link
            href="/"
            className={`px-3.5 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              pathname === '/'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Голосование
          </Link>

          <Link
            href="/leaderboard"
            className={`px-3.5 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              pathname === '/leaderboard'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Рейтинг
          </Link>
        </nav>

        {/* Vote Counter */}
        <div className="flex items-center">
          <span className="text-xs font-medium text-zinc-400">
            Голосов: <strong className="text-white font-semibold">{userVotesCount}</strong>
          </span>
        </div>
      </div>
    </header>
  );
};
