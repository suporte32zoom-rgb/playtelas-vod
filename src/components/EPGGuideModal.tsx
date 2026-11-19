import React, { useState } from 'react';
import {
  List,
  Clock,
  Bell,
  CheckCircle2,
  Play,
  X,
  Search,
  Filter,
  AlertCircle
} from 'lucide-react';
import { Channel, EPGProgram } from '../types/tv';
import { getCurrentProgram, getNextProgram, getProgramProgress } from '../data/channels';

interface EPGGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
  currentChannel: Channel;
  onSelectChannel: (channelId: string) => void;
  onScheduleAlert: (channelId: string, channelName: string, programTitle: string, startTime: string) => void;
  isAlertScheduled: (channelId: string, programTitle: string) => boolean;
}

export const EPGGuideModal: React.FC<EPGGuideModalProps> = ({
  isOpen,
  onClose,
  channels,
  currentChannel,
  onSelectChannel,
  onScheduleAlert,
  isAlertScheduled
}) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string>(currentChannel.id);
  const [selectedProgram, setSelectedProgram] = useState<EPGProgram | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');

  if (!isOpen) return null;

  const activeChannel = channels.find((c) => c.id === selectedChannelId) || currentChannel;
  const currentProg = getCurrentProgram(activeChannel);

  // Filter channels in guide sidebar
  const filteredChannels = channels.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.epgSchedule.some((p) => p.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchCat = selectedCategory === 'todos' || c.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const getRatingBadgeColor = (rating: string) => {
    switch (rating) {
      case '18':
        return 'bg-black text-white border-black';
      case '16':
        return 'bg-red-600 text-white border-red-500';
      case '14':
        return 'bg-orange-500 text-white border-orange-400';
      case '12':
        return 'bg-amber-500 text-black border-amber-400';
      case '10':
        return 'bg-blue-600 text-white border-blue-500';
      case 'Livre':
      default:
        return 'bg-emerald-600 text-white border-emerald-500';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[90vh] rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100 flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <List className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Guia de Programação em Tempo Real (EPG)
              </h3>
              <p className="text-xs text-slate-400">
                Grade completa 24 horas • Horário Oficial de Brasília
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar canal ou programa na grade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 max-w-full">
            {['todos', 'esportes', 'filmes-series', 'infantil', 'tv-ao-vivo', 'noticias'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {cat === 'todos' ? 'Todos' : cat.replace('-', ' & ')}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body: Left Channel List + Right Detailed Schedule */}
        <div className="flex-1 flex overflow-hidden">
          {/* Channel Selector Sidebar */}
          <div className="w-1/3 min-w-[180px] sm:min-w-[240px] max-w-[280px] border-r border-slate-800 overflow-y-auto p-2 space-y-1 bg-slate-950/40">
            {filteredChannels.map((c) => {
              const isSelected = c.id === selectedChannelId;
              const prog = getCurrentProgram(c);
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedChannelId(c.id)}
                  className={`p-2.5 rounded-2xl transition cursor-pointer text-left border ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500/60 shadow-md'
                      : 'border-transparent hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] font-bold text-indigo-400">
                      #{c.channelNumber.toString().padStart(3, '0')}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                      {c.bestQuality}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white truncate">{c.name}</h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {prog.title}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Right Schedule View */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/50">
            {/* Active Channel Banner */}
            <div className="p-4 border-b border-slate-800/80 bg-slate-900 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{activeChannel.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-600 text-white tracking-widest animate-pulse">
                    AO VIVO
                  </span>
                  <span className="text-xs text-slate-400">
                    {activeChannel.subcategory}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 line-clamp-1">
                  Agora: <strong className="text-white">{currentProg.title}</strong> ({currentProg.startTime} - {currentProg.endTime})
                </p>
              </div>

              <button
                onClick={() => {
                  onSelectChannel(activeChannel.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition cursor-pointer active:scale-95 shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Sintonizar Agora</span>
              </button>
            </div>

            {/* Program Timeline List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeChannel.epgSchedule.map((program) => {
                const isCurrent = program.id === currentProg.id;
                const isScheduled = isAlertScheduled(activeChannel.id, program.title);

                return (
                  <div
                    key={program.id}
                    className={`p-4 rounded-2xl border transition ${
                      isCurrent
                        ? 'bg-indigo-600/10 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30'
                        : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center shrink-0">
                          <span className="font-mono text-xs font-bold text-slate-300 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                            {program.startTime}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono mt-1">
                            {program.endTime}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-white">
                              {program.title}
                            </h4>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${getRatingBadgeColor(
                                program.rating
                              )}`}
                            >
                              {program.rating}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Passando Agora ({getProgramProgress(program)}%)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                            {program.description}
                          </p>
                        </div>
                      </div>

                      {/* Reminder / Alert Button */}
                      <button
                        onClick={() =>
                          onScheduleAlert(
                            activeChannel.id,
                            activeChannel.name,
                            program.title,
                            program.startTime
                          )
                        }
                        title={isScheduled ? 'Lembrete ativado' : 'Agendar lembrete deste programa'}
                        className={`p-2 rounded-xl transition cursor-pointer shrink-0 active:scale-95 ${
                          isScheduled
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700'
                        }`}
                      >
                        {isScheduled ? (
                          <CheckCircle2 className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Bell className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {isCurrent && (
                      <div className="w-full h-1 bg-slate-800 rounded-full mt-3 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-rose-500"
                          style={{ width: `${getProgramProgress(program)}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
