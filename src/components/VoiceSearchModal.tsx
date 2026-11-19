import React, { useEffect } from 'react';
import { Mic, MicOff, X, Tv, Search } from 'lucide-react';
import { Channel } from '../types/tv';

interface VoiceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  isListening: boolean;
  transcript: string;
  onStartListening: () => void;
  onStopListening: () => void;
  onSelectChannel: (channelId: string) => void;
  channels: Channel[];
}

export const VoiceSearchModal: React.FC<VoiceSearchModalProps> = ({
  isOpen,
  onClose,
  isListening,
  transcript,
  onStartListening,
  onStopListening,
  onSelectChannel,
  channels
}) => {
  useEffect(() => {
    if (isOpen && !isListening) {
      onStartListening();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter channels matching the voice transcript
  const cleanQuery = transcript.toLowerCase().trim();
  const matchedChannels = cleanQuery
    ? channels.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(cleanQuery);
        const catMatch = c.category.toLowerCase().includes(cleanQuery);
        const subMatch = c.subcategory.toLowerCase().includes(cleanQuery);
        const numberMatch = cleanQuery.includes(String(c.channelNumber));
        return nameMatch || catMatch || subMatch || numberMatch;
      }).slice(0, 8)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700/80 p-6 shadow-2xl text-slate-100 flex flex-col items-center text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Mic Pulse Graphic */}
        <div className="relative my-6 flex items-center justify-center">
          {isListening && (
            <>
              <div className="absolute w-28 h-28 rounded-full bg-rose-500/20 animate-ping" />
              <div className="absolute w-20 h-20 rounded-full bg-rose-500/30 animate-pulse" />
            </>
          )}
          <button
            onClick={isListening ? onStopListening : onStartListening}
            className={`relative w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-transform active:scale-90 cursor-pointer ${
              isListening
                ? 'bg-gradient-to-tr from-rose-600 to-pink-500 text-white shadow-rose-600/40 ring-4 ring-rose-500/20'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            {isListening ? <Mic className="w-8 h-8" /> : <MicOff className="w-7 h-7" />}
          </button>
        </div>

        {/* State Label */}
        <h3 className="text-xl font-bold text-white mb-1">
          {isListening ? 'Ouvindo... Fale o nome do canal' : 'Microfone pausado'}
        </h3>
        <p className="text-xs text-slate-400 max-w-xs mb-4">
          Exemplos: "Globo", "CazéTV", "ESPN", "Telecine", "Desenhos", "Notícias" ou o número do canal.
        </p>

        {/* Live Transcript Box */}
        <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 min-h-[64px] flex items-center justify-center text-center shadow-inner mb-4">
          {transcript ? (
            <p className="text-base font-semibold text-indigo-300 italic">
              "{transcript}"
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Aguardando sua voz...
            </p>
          )}
        </div>

        {/* Matched Results */}
        {matchedChannels.length > 0 && (
          <div className="w-full space-y-1.5 max-h-56 overflow-y-auto pr-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block text-left mb-1">
              Canais Encontrados:
            </span>
            {matchedChannels.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  onSelectChannel(c.id);
                  onClose();
                }}
                className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-indigo-600/30 border border-slate-700/60 hover:border-indigo-500/50 flex items-center justify-between cursor-pointer transition active:scale-98 group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-6 rounded-lg bg-slate-900 border border-slate-700 text-indigo-400 font-mono text-[11px] font-bold flex items-center justify-center">
                    #{c.channelNumber}
                  </span>
                  <div className="text-left">
                    <h5 className="text-xs font-bold text-white group-hover:text-indigo-200 truncate">
                      {c.name}
                    </h5>
                    <span className="text-[10px] text-slate-400">{c.subcategory}</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                  Assistir
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
