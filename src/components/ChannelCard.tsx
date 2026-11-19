import React from 'react';
import { Star, Play, Lock, Radio, Clock } from 'lucide-react';
import { Channel } from '../types/tv';
import { getCurrentProgram, getNextProgram, getProgramProgress } from '../data/channels';

interface ChannelCardProps {
  channel: Channel;
  isActive: boolean;
  isFavorite: boolean;
  isLocked: boolean;
  onSelect: (channelId: string) => void;
  onToggleFavorite: (channelId: string) => void;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  isActive,
  isFavorite,
  isLocked,
  onSelect,
  onToggleFavorite
}) => {
  const currentProg = getCurrentProgram(channel);
  const nextProg = getNextProgram(channel);
  const progressPercent = getProgramProgress(currentProg);

  return (
    <div
      onClick={() => onSelect(channel.id)}
      className={`group relative rounded-2xl border p-3.5 transition-all duration-200 cursor-pointer flex flex-col justify-between select-none ${
        isActive
          ? 'bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border-indigo-500 shadow-xl shadow-indigo-500/20 ring-1 ring-indigo-500/50 scale-[1.02]'
          : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/80 hover:border-slate-700/80 hover:shadow-lg hover:-translate-y-0.5'
      }`}
    >
      {/* Top Header: Channel Number, Badges, Favorite Button */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 truncate">
          <span className="font-mono text-xs font-extrabold text-indigo-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 shrink-0">
            #{channel.channelNumber.toString().padStart(3, '0')}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase shrink-0">
            {channel.bestQuality}
          </span>
          {isLocked && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 shrink-0">
              <Lock className="w-2.5 h-2.5" />
              Bloqueado
            </span>
          )}
        </div>

        {/* Favorite Star Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(channel.id);
          }}
          title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          className={`p-1.5 rounded-xl transition cursor-pointer shrink-0 active:scale-90 ${
            isFavorite
              ? 'text-amber-400 hover:text-amber-300 bg-amber-400/10'
              : 'text-slate-500 hover:text-amber-400 hover:bg-slate-800'
          }`}
        >
          <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Center: Channel Name & Category Subtitle */}
      <div className="my-1">
        <div className="flex items-center gap-1.5">
          {isActive && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
          )}
          <h3 className="text-sm font-bold text-white tracking-tight truncate group-hover:text-indigo-300 transition">
            {channel.name}
          </h3>
        </div>
        <p className="text-[11px] text-slate-400 truncate mt-0.5">
          {channel.subcategory}
        </p>
      </div>

      {/* Bottom: EPG Current Program & Progress */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/80">
        <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
          <span className="font-semibold truncate max-w-[70%]">
            {currentProg.title}
          </span>
          <span className="font-mono text-[10px] text-slate-400 shrink-0">
            {currentProg.startTime}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-1.5">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Next show preview */}
        {nextProg && (
          <div className="flex items-center gap-1 text-[10px] text-slate-500 truncate">
            <span className="font-semibold text-slate-400">A seguir:</span>
            <span className="truncate">{nextProg.title} ({nextProg.startTime})</span>
          </div>
        )}
      </div>

      {/* Hover Action Overlay Play Icon */}
      <div className="absolute inset-0 bg-indigo-600/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
        {!isActive && (
          <div className="w-10 h-10 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        )}
      </div>
    </div>
  );
};
