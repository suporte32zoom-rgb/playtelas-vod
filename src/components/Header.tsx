import React, { useState, useEffect } from 'react';
import {
  Tv,
  Search,
  Mic,
  Cast,
  List,
  ShieldCheck,
  Bell,
  BellOff,
  Baby,
  Users,
  User,
  X
} from 'lucide-react';
import { UserProfileType } from '../types/tv';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenVoiceSearch: () => void;
  onOpenCastModal: () => void;
  onOpenEPGModal: () => void;
  onOpenParentalModal: () => void;
  activeProfile: UserProfileType;
  isCasting: boolean;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onOpenVoiceSearch,
  onOpenCastModal,
  onOpenEPGModal,
  onOpenParentalModal,
  activeProfile,
  isCasting,
  notificationsEnabled,
  onToggleNotifications
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const getProfileIcon = () => {
    switch (activeProfile) {
      case 'kids':
        return <Baby className="w-4 h-4 text-cyan-400" />;
      case 'familia':
        return <Users className="w-4 h-4 text-emerald-400" />;
      case 'adulto':
      default:
        return <User className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-3 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        
        {/* Brand Logo & Live Clock */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-black tracking-tight text-white">
                  CineLive<span className="text-indigo-500">TV</span>
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-red-600 text-white tracking-widest animate-pulse">
                  AO VIVO
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono hidden md:block">
                Brasília: {currentTime}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Search & Voice Input */}
        <div className="flex-1 max-w-md mx-2 relative">
          <div className="relative flex items-center w-full">
            <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome, categoria ou canal..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800/90 rounded-2xl pl-9 pr-16 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
            />
            
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-9 text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Voice Search Mic Button inside input */}
            <button
              onClick={onOpenVoiceSearch}
              title="Buscar por Voz (Falar canal)"
              className="absolute right-2 p-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-300 transition cursor-pointer active:scale-95"
            >
              <Mic className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Action Icons & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Smart TV Cast Button */}
          <button
            onClick={onOpenCastModal}
            title="Enviar para Smart TV"
            className={`p-2 rounded-xl transition cursor-pointer border active:scale-95 ${
              isCasting
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30 animate-pulse'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-indigo-400 hover:bg-slate-800'
            }`}
          >
            <Cast className="w-4 h-4" />
          </button>

          {/* EPG Guide Button */}
          <button
            onClick={onOpenEPGModal}
            title="Guia EPG de Programação"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-indigo-400 hover:bg-slate-800 transition cursor-pointer active:scale-95 hidden sm:flex items-center gap-1 text-xs font-semibold"
          >
            <List className="w-4 h-4" />
            <span>Guia</span>
          </button>


          {/* Push Notifications Toggle */}
          <button
            onClick={onToggleNotifications}
            title={notificationsEnabled ? 'Notificações Ativas' : 'Ativar Notificações'}
            className={`p-2 rounded-xl transition cursor-pointer border active:scale-95 ${
              notificationsEnabled
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>

          {/* Parental Control / Profile Badge */}
          <button
            onClick={onOpenParentalModal}
            title={`Perfil: ${activeProfile}. Clique para gerenciar`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition cursor-pointer active:scale-95"
          >
            {getProfileIcon()}
            <span className="text-xs font-semibold capitalize hidden lg:inline text-slate-300">
              {activeProfile}
            </span>
          </button>

          {/* In-App PWA Install Button */}
          <PWAInstallButton />
        </div>
      </div>
    </header>
  );
};
