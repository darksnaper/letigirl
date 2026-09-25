'use client';

import React, { useState } from 'react';
import { Contestant } from '@prisma/client';
import { ZoomIn } from 'lucide-react';
import { ImageModal } from './ImageModal';

interface ContestantCardProps {
  contestant: Contestant;
  onVote: (contestantId: string) => void;
  disabled?: boolean;
  shortcutKey: string;
}

export const ContestantCard: React.FC<ContestantCardProps> = ({
  contestant,
  onVote,
  disabled = false,
  shortcutKey,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);

  // Фото считается готовым ТОЛЬКО если загрузился именно текущий photoUrl
  const isImageReady = loadedUrl === contestant.photoUrl;

  // Только имя, без фамилии
  const firstName = contestant.name.trim().split(/\s+/)[0];

  return (
    <>
      <div
        onClick={() => {
          if (!disabled) onVote(contestant.id);
        }}
        className={`group relative flex flex-col w-full max-w-[340px] sm:max-w-[380px] bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 shadow-lg hover:border-white/30 hover:shadow-2xl transition-all duration-200 cursor-pointer select-none active:scale-[0.99] ${
          disabled ? 'opacity-60 pointer-events-none' : ''
        }`}
      >
        {/* Photo Container */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-950">
          {/* Skeleton загрузки: мгновенно скрывает старое фото до загрузки нового */}
          {!isImageReady && (
            <div className="absolute inset-0 bg-zinc-800/80 animate-pulse flex items-center justify-center z-10">
              <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
            </div>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={contestant.photoUrl}
            src={contestant.photoUrl}
            alt={firstName}
            onLoad={() => setLoadedUrl(contestant.photoUrl)}
            className={`w-full h-full object-cover object-center transition-all duration-200 group-hover:scale-[1.03] ${
              isImageReady ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Dark gradient for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none z-10" />

          {/* Zoom button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(true);
            }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white backdrop-blur-md flex items-center justify-center transition-all active:scale-95 z-20"
            title="Открыть фото"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Shortcut key indicator */}
          <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-black/50 text-[11px] font-mono text-zinc-300 backdrop-blur-md z-20">
            {shortcutKey}
          </div>

          {/* Info overlay at bottom */}
          <div className="absolute bottom-4 left-4 right-4 text-left z-20">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {firstName}
            </h2>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-3 bg-zinc-900 border-t border-white/5">
          <div className="w-full py-2.5 rounded-xl bg-white/10 group-hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold text-center transition-colors">
            Выбрать
          </div>
        </div>
      </div>

      <ImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageUrl={contestant.photoUrl}
        name={firstName}
        faculty={contestant.faculty}
        course={contestant.course}
      />
    </>
  );
};
