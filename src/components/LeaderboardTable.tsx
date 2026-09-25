'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Trophy } from 'lucide-react';
import { ImageModal } from './ImageModal';

interface RankedContestant {
  id: string;
  rank: number;
  name: string;
  faculty: string;
  course: number;
  photoUrl: string;
  elo: number;
  matchesCount: number;
  wins: number;
  losses: number;
  winrate: number;
}

interface FilterOptions {
  faculties: string[];
  courses: number[];
}

interface RankTier {
  place: 1 | 2 | 3;
  points: number;
  label: string;
  crownEmoji: string;
  colorClass: {
    border: string;
    bg: string;
    text: string;
    badge: string;
    glow: string;
  };
  contestants: RankedContestant[];
}

export const LeaderboardTable: React.FC = () => {
  const [contestants, setContestants] = useState<RankedContestant[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({ faculties: [], courses: [] });
  const [selectedFaculty, setSelectedFaculty] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Фото-модалка
  const [activeModalPhoto, setActiveModalPhoto] = useState<RankedContestant | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedFaculty !== 'all') params.set('faculty', selectedFaculty);
      if (selectedCourse !== 'all') params.set('course', selectedCourse);
      params.set('sort', 'elo');
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/leaderboard?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setContestants(data.data.contestants);
        setFilters(data.data.filters);
      }
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedFaculty, selectedCourse, searchQuery]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const getFirstName = (fullName: string) => fullName.trim().split(/\s+/)[0];

  // Группировка топ-3 по набранным баллам (рейтинг Elo)
  const rankTiers: RankTier[] = [];

  // Допускаем на пьедестал только участниц, у которых есть хотя бы 1 победа в дуэлях
  const pool = contestants.filter((c) => c.wins > 0 && c.matchesCount > 0);

  if (pool.length > 0) {
    // Сортируем пул строго по набранным баллам (Elo)
    const sortedPool = [...pool].sort((a, b) => b.elo - a.elo || b.wins - a.wins);

    // Получаем уникальные значения набранных баллов (округленный рейтинг) по убыванию
    const distinctScores = Array.from(new Set(sortedPool.map((c) => Math.round(c.elo)))).sort(
      (a, b) => b - a
    );

    // 1 МЕСТО: максимальное количество баллов
    if (distinctScores.length >= 1) {
      const tier1 = sortedPool
        .filter((c) => Math.round(c.elo) === distinctScores[0])
        .slice(0, 4);

      rankTiers.push({
        place: 1,
        points: distinctScores[0],
        label: '1 место',
        crownEmoji: '👑',
        colorClass: {
          border: 'border-amber-400/60',
          bg: 'bg-gradient-to-b from-amber-500/15 via-yellow-950/20 to-zinc-950',
          text: 'text-amber-400',
          badge: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-zinc-950',
          glow: 'bg-amber-400',
        },
        contestants: tier1,
      });
    }

    // 2 МЕСТО: второй результат по баллам
    if (distinctScores.length >= 2) {
      const tier2 = sortedPool
        .filter((c) => Math.round(c.elo) === distinctScores[1])
        .slice(0, 4);

      rankTiers.push({
        place: 2,
        points: distinctScores[1],
        label: '2 место',
        crownEmoji: '🥈',
        colorClass: {
          border: 'border-slate-300/40',
          bg: 'bg-gradient-to-b from-slate-400/15 via-slate-900/30 to-zinc-950',
          text: 'text-slate-200',
          badge: 'bg-gradient-to-r from-slate-200 to-slate-400 text-zinc-950',
          glow: 'bg-slate-300',
        },
        contestants: tier2,
      });
    }

    // 3 МЕСТО: третий результат по баллам
    if (distinctScores.length >= 3) {
      const tier3 = sortedPool
        .filter((c) => Math.round(c.elo) === distinctScores[2])
        .slice(0, 4);

      rankTiers.push({
        place: 3,
        points: distinctScores[2],
        label: '3 место',
        crownEmoji: '🥉',
        colorClass: {
          border: 'border-amber-700/40',
          bg: 'bg-gradient-to-b from-amber-700/15 via-amber-950/25 to-zinc-950',
          text: 'text-amber-600',
          badge: 'bg-gradient-to-r from-amber-600 to-amber-800 text-white',
          glow: 'bg-amber-700',
        },
        contestants: tier3,
      });
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-zinc-400 mb-3">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>Тройка лидеров</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Топ-3 Студентки
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-md mx-auto">
          Определяется по рейтингу дуэлей.
        </p>
      </div>

      {/* Filter and Search Bar (hidden on frontend, preserved for future use) */}
      {false && (
        <div className="mb-8 flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по имени..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition"
            />
          </div>

          {/* Dropdowns for Faculty & Course */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedFaculty}
              onChange={(e) => setSelectedFaculty(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-xs text-zinc-300 focus:outline-none transition"
            >
              <option value="all">Все факультеты</option>
              {filters.faculties.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-xs text-zinc-300 focus:outline-none transition"
            >
              <option value="all">Все курсы</option>
              {filters.courses.map((c) => (
                <option key={c} value={c.toString()}>
                  {c} курс
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Top 3 Podium in 1 Row */}
      {loading ? (
        <div className="py-20 text-center text-zinc-500 text-sm">
          Загрузка лидеров...
        </div>
      ) : rankTiers.length === 0 ? (
        <div className="py-16 text-center max-w-md mx-auto p-8 rounded-3xl bg-zinc-900/60 border border-white/10 shadow-2xl backdrop-blur-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-3xl">
            👑
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Пьедестал пока пуст</h3>
          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
            Рейтинг был сброшен, либо ещё нет завершённых дуэлей. Сделайте выборы в турнире, чтобы сформировать тройку лидеров!
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs transition shadow-lg shadow-white/10"
          >
            <span>Перейти к турниру</span>
          </a>
        </div>
      ) : (
        <div className="flex md:grid md:grid-cols-3 gap-5 lg:gap-6 items-stretch overflow-x-auto pb-4 md:pb-0 snap-x snap-mandatory">
          {rankTiers.map((tier) => (
            <div
              key={tier.place}
              className={`flex flex-col min-w-[280px] sm:min-w-[320px] md:min-w-0 flex-1 snap-center rounded-3xl border ${tier.colorClass.border} ${tier.colorClass.bg} p-4 sm:p-5 shadow-2xl relative overflow-hidden backdrop-blur-sm transition-all`}
            >
              {/* Top Glow Accent */}
              <div
                className={`absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-32 rounded-full blur-3xl opacity-20 pointer-events-none ${tier.colorClass.glow}`}
              />

              {/* Tier Header: Баллы сверху, под ними место */}
              <div className="text-center pb-3 mb-3 border-b border-white/10 relative z-10">
                <div className="text-[11px] sm:text-xs uppercase tracking-wider font-semibold text-zinc-400">
                  Набранных баллов: <span className="font-extrabold text-white text-base sm:text-lg">{tier.points}</span>
                </div>
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  <span className="text-xl sm:text-2xl drop-shadow">{tier.crownEmoji}</span>
                  <span className={`text-base sm:text-lg font-black tracking-tight ${tier.colorClass.text}`}>
                    {tier.place} место
                  </span>
                </div>
                {tier.contestants.length > 1 && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 px-2 py-0.5 rounded-full bg-white/10 border border-white/15">
                    <span>{tier.contestants.length} участницы</span>
                  </div>
                )}
              </div>

              {/* Contestant(s) Showcase */}
              <div className="flex-1 flex flex-col justify-center relative z-10">
                {tier.contestants.length === 1 ? (
                  // Single contestant: Full-height showcase card
                  <div
                    onClick={() => setActiveModalPhoto(tier.contestants[0])}
                    className="group relative cursor-pointer rounded-2xl overflow-hidden border border-white/10 hover:border-white/30 transition-all bg-zinc-950/70 shadow-lg flex flex-col"
                  >
                    <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={tier.contestants[0].photoUrl}
                        alt={getFirstName(tier.contestants[0].name)}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />

                      {/* Crown badge */}
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black shadow-lg backdrop-blur-md border border-white/20 bg-zinc-900/80">
                        <span>{tier.crownEmoji}</span>
                        <span className={tier.colorClass.text}>#{tier.place}</span>
                      </div>

                      {/* Name at bottom */}
                      <div className="absolute bottom-3 left-3 right-3 text-left">
                        <h3 className="text-base sm:text-lg font-bold text-white leading-tight drop-shadow-md">
                          {getFirstName(tier.contestants[0].name)}
                        </h3>
                      </div>
                    </div>

                    <div className="p-2.5 bg-zinc-950/80 flex items-center justify-between text-xs text-zinc-400">
                      <span>
                        Победы: <strong className="text-white">{tier.contestants[0].wins}</strong> из {tier.contestants[0].matchesCount}
                      </span>
                      <span className="font-bold text-emerald-400 font-mono">{tier.contestants[0].winrate}%</span>
                    </div>
                  </div>
                ) : tier.contestants.length === 2 ? (
                  // Two contestants sharing place: Side-by-side twin cards
                  <div className="grid grid-cols-2 gap-2">
                    {tier.contestants.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setActiveModalPhoto(c)}
                        className="group relative cursor-pointer rounded-xl overflow-hidden border border-white/10 hover:border-white/30 transition-all bg-zinc-950/70 shadow-md flex flex-col"
                      >
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-900">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={c.photoUrl}
                            alt={getFirstName(c.name)}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />

                          <div className="absolute top-1.5 right-1.5 text-xs drop-shadow">
                            {tier.crownEmoji}
                          </div>

                          <div className="absolute bottom-2 left-2 right-2 text-left">
                            <h3 className="text-xs sm:text-sm font-bold text-white leading-tight truncate">
                              {getFirstName(c.name)}
                            </h3>
                          </div>
                        </div>

                        <div className="p-1.5 bg-zinc-950/80 text-[10px] text-zinc-400 flex items-center justify-between">
                          <span>{c.wins} В / {c.losses} П</span>
                          <span className="font-bold text-emerald-400 font-mono">{c.winrate}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // 3 or more contestants sharing place: Compact list
                  <div className="space-y-2">
                    {tier.contestants.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setActiveModalPhoto(c)}
                        className="group flex items-center gap-2.5 p-2 rounded-xl bg-zinc-950/70 border border-white/10 hover:border-white/30 transition cursor-pointer"
                      >
                        <div className="w-11 h-13 rounded-lg overflow-hidden shrink-0 bg-zinc-900 border border-white/10 relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={c.photoUrl}
                            alt={getFirstName(c.name)}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className="text-xs sm:text-sm font-bold text-white truncate">{getFirstName(c.name)}</h4>
                            <span className="text-xs font-bold text-emerald-400 font-mono">{c.winrate}%</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-1">{c.wins} побед из {c.matchesCount}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}


      {activeModalPhoto && (
        <ImageModal
          isOpen={!!activeModalPhoto}
          onClose={() => setActiveModalPhoto(null)}
          imageUrl={activeModalPhoto.photoUrl}
          name={getFirstName(activeModalPhoto.name)}
          faculty={activeModalPhoto.faculty}
          course={activeModalPhoto.course}
        />
      )}
    </div>
  );
};
