'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Contestant } from '@prisma/client';
import { ContestantCard } from './ContestantCard';
import { Crown, Trophy } from 'lucide-react';
import Link from 'next/link';

interface PairData {
  contestant1: Contestant;
  contestant2: Contestant;
  stageName: string;
  currentStage: number;
  matchIndexInStage: number;
  totalMatchesInStage: number;
  isFinished: boolean;
  champion?: Contestant | null;
  runnerUp?: Contestant | null;
  thirdPlace?: Contestant | null;
}

interface DuelArenaProps {
  onVoteSuccess?: (newCount: number) => void;
}

export const DuelArena: React.FC<DuelArenaProps> = ({ onVoteSuccess }) => {
  const [pair, setPair] = useState<PairData | null>(null);
  const [champion, setChampion] = useState<Contestant | null>(null);
  const [runnerUp, setRunnerUp] = useState<Contestant | null>(null);
  const [thirdPlace, setThirdPlace] = useState<Contestant | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  // Получить следующую пару
  const fetchNextPair = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/match/next', { cache: 'no-store' });
      const data = await res.json();

      if (data.success && data.data) {
        if (data.data.isFinished) {
          setIsFinished(true);
          setChampion(data.data.champion || null);
          setRunnerUp(data.data.runnerUp || null);
          setThirdPlace(data.data.thirdPlace || null);
          setPair(null);
        } else {
          setPair(data.data);
          setIsFinished(false);
          setChampion(null);
          setRunnerUp(null);
          setThirdPlace(null);
        }
      } else {
        setPair(null);
      }
    } catch (err) {
      console.error('Failed to load pair:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNextPair();
  }, [fetchNextPair]);

  // Отправка голоса
  const handleVote = useCallback(
    async (winnerId: string) => {
      if (!pair || voting) return;

      const loserId = pair.contestant1.id === winnerId ? pair.contestant2.id : pair.contestant1.id;

      try {
        setVoting(true);

        const res = await fetch('/api/match/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ winnerId, loserId }),
        });

        const data = await res.json();

        if (data.success) {
          if (onVoteSuccess) {
            onVoteSuccess(data.data.votesCount);
          }

          if (data.data.nextPair) {
            if (data.data.nextPair.isFinished) {
              setIsFinished(true);
              setChampion(data.data.nextPair.champion || null);
              setRunnerUp(data.data.nextPair.runnerUp || null);
              setThirdPlace(data.data.nextPair.thirdPlace || null);
              setPair(null);
            } else {
              setPair(data.data.nextPair);
              setIsFinished(false);
            }
          } else {
            await fetchNextPair();
          }
        }
      } catch (error) {
        console.error('Error voting:', error);
      } finally {
        setVoting(false);
      }
    },
    [pair, voting, onVoteSuccess, fetchNextPair]
  );

  // Горячие клавиши 1, 2 и стрелки
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (!pair || voting || loading) return;

      if (e.key === '1' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handleVote(pair.contestant1.id);
      } else if (e.key === '2' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleVote(pair.contestant2.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pair, voting, loading, handleVote]);

  if (loading && !pair && !isFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  // Экран победительницы турнира! 👑
  if (isFinished && champion) {
    const firstName = champion.name.trim().split(/\s+/)[0];
    return (
      <div className="max-w-md w-full mx-auto my-10 p-6 sm:p-8 bg-zinc-900/90 rounded-3xl border border-white/10 text-center shadow-2xl animate-in fade-in duration-300">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-400 mb-4">
          <Crown className="w-4 h-4" />
          <span>Твой личный выбор</span>
        </div>

        {/* Photo of Champion */}
        <div className="relative aspect-[3/4] max-w-[280px] mx-auto rounded-2xl overflow-hidden border-2 border-amber-500/40 shadow-2xl mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={champion.photoUrl}
            alt={firstName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-3 left-3 right-3 text-left">
            <h2 className="text-2xl font-black text-white">{firstName}</h2>
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-1">
          {firstName} — твой топ-1! 👑
        </h2>
        <p className="text-zinc-400 text-xs mb-6">
          Она победила во всех этапах твоего персонального турнира.
        </p>

        <div className="flex flex-col gap-2.5">
          <Link
            href="/leaderboard"
            className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg"
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Посмотреть общий рейтинг</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!pair) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 text-center">
        <p className="text-zinc-400 text-sm">Недостаточно участниц для турнира.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto px-4 py-6">
      {/* Tournament Stage Indicator */}
      <div className="mb-4 flex items-center gap-2">
        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-zinc-300">
          {pair.stageName}
        </span>
        {pair.totalMatchesInStage > 1 && (
          <span className="text-xs font-medium text-zinc-500">
            • Пара {pair.matchIndexInStage} из {pair.totalMatchesInStage}
          </span>
        )}
      </div>

      {/* Cards container */}
      <div
        className={`flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 w-full transition-opacity duration-150 ${
          voting ? 'opacity-40 pointer-events-none' : 'opacity-100'
        }`}
      >
        {/* Card 1 */}
        <div className="w-full flex justify-center">
          <ContestantCard
            key={pair.contestant1.id}
            contestant={pair.contestant1}
            onVote={handleVote}
            disabled={voting}
            shortcutKey="1"
          />
        </div>

        {/* Minimal VS divider */}
        <div className="shrink-0 flex items-center justify-center my-1 sm:my-0">
          <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-xs font-bold text-zinc-400">
            VS
          </div>
        </div>

        {/* Card 2 */}
        <div className="w-full flex justify-center">
          <ContestantCard
            key={pair.contestant2.id}
            contestant={pair.contestant2}
            onVote={handleVote}
            disabled={voting}
            shortcutKey="2"
          />
        </div>
      </div>
    </div>
  );
};
