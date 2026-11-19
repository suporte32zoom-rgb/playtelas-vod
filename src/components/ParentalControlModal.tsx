import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Users,
  Baby,
  User,
  X,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Channel, ParentalControlSettings, UserProfileType } from '../types/tv';

interface ParentalControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ParentalControlSettings;
  channels: Channel[];
  onSetProfile: (profile: UserProfileType) => void;
  onToggleChannelLock: (channelId: string) => void;
  onChangePin: (oldPin: string, newPin: string) => { success: boolean; message: string };
  verifyPin: (pin: string) => boolean;
}

export const ParentalControlModal: React.FC<ParentalControlModalProps> = ({
  isOpen,
  onClose,
  settings,
  channels,
  onSetProfile,
  onToggleChannelLock,
  onChangePin,
  verifyPin
}) => {
  const [activeTab, setActiveTab] = useState<'profiles' | 'locked-channels' | 'change-pin'>('profiles');
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinMessage, setPinMessage] = useState<{ text: string; isError: boolean } | null>(null);

  if (!isOpen) return null;

  const handleUpdatePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPinInput !== confirmPinInput) {
      setPinMessage({ text: 'A confirmação do PIN não confere.', isError: true });
      return;
    }
    const res = onChangePin(currentPinInput, newPinInput);
    setPinMessage({ text: res.message, isError: !res.success });
    if (res.success) {
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700/80 p-6 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Controle Parental & Perfis
              </h3>
              <p className="text-xs text-slate-400">
                Gerencie restrições de idade, PIN de segurança e perfil Kids
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-4 mb-3 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('profiles')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'profiles' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Perfis de Usuário</span>
          </button>
          <button
            onClick={() => setActiveTab('locked-channels')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'locked-channels' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Bloqueio Individual</span>
          </button>
          <button
            onClick={() => setActiveTab('change-pin')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'change-pin' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Alterar PIN</span>
          </button>
        </div>

        {/* Tab 1: Profiles (Adulto, Familia, Kids) */}
        {activeTab === 'profiles' && (
          <div className="space-y-3 overflow-y-auto pr-1 my-2">
            {/* Kids Profile Card */}
            <div
              onClick={() => onSetProfile('kids')}
              className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3.5 ${
                settings.activeProfile === 'kids'
                  ? 'bg-cyan-500/15 border-cyan-400/60 shadow-lg ring-1 ring-cyan-400/30'
                  : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shrink-0">
                <Baby className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Perfil Kids (Modo Infantil Seguro)
                    {settings.activeProfile === 'kids' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-cyan-500 text-slate-950 uppercase">
                        Ativo
                      </span>
                    )}
                  </h4>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Ambiente 100% blindado para crianças. Apenas desenhos infantis, classificação Livre e conteúdos educativos. Canais com violência, notícias pesadas ou 14+/16+/18+ ficam completamente ocultos.
                </p>
              </div>
            </div>

            {/* Familia Profile Card */}
            <div
              onClick={() => onSetProfile('familia')}
              className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3.5 ${
                settings.activeProfile === 'familia'
                  ? 'bg-emerald-500/15 border-emerald-400/60 shadow-lg ring-1 ring-emerald-400/30'
                  : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Perfil Família
                    {settings.activeProfile === 'familia' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500 text-slate-950 uppercase">
                        Ativo
                      </span>
                    )}
                  </h4>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Permite canais abertos, esportes e entretenimento para todas as idades. Filtra automaticamente qualquer programação restrita para maiores de 16 ou 18 anos.
                </p>
              </div>
            </div>

            {/* Adult Profile Card */}
            <div
              onClick={() => onSetProfile('adulto')}
              className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3.5 ${
                settings.activeProfile === 'adulto'
                  ? 'bg-indigo-600/20 border-indigo-500/60 shadow-lg ring-1 ring-indigo-500/30'
                  : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                <User className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Perfil Adulto (Acesso Completo)
                    {settings.activeProfile === 'adulto' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-600 text-white uppercase">
                        Ativo
                      </span>
                    )}
                  </h4>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Acesso irrestrito a todos os 160 canais ao vivo, filmes de ação, séries e noticiários. Canais com cadeado individual ainda solicitam o PIN.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Individual Channel Locking */}
        {activeTab === 'locked-channels' && (
          <div className="space-y-2 overflow-y-auto pr-1 my-2 max-h-72">
            <p className="text-xs text-slate-400 px-1 mb-2">
              Clique no cadeado para exigir o PIN de 4 dígitos para assistir ao canal:
            </p>
            {channels.slice(0, 50).map((c) => {
              const isLocked = settings.lockedChannelIds.includes(c.id);
              return (
                <div
                  key={c.id}
                  onClick={() => onToggleChannelLock(c.id)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    isLocked
                      ? 'bg-rose-500/10 border-rose-500/40 text-white'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="font-mono text-xs text-slate-400 font-bold">
                      #{c.channelNumber.toString().padStart(3, '0')}
                    </span>
                    <span className="text-xs font-semibold truncate">{c.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {c.category}
                    </span>
                  </div>

                  <button
                    className={`p-1.5 rounded-lg transition ${
                      isLocked ? 'bg-rose-600 text-white shadow' : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 3: Change PIN */}
        {activeTab === 'change-pin' && (
          <form onSubmit={handleUpdatePin} className="space-y-4 py-2">
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>O PIN padrão de fábrica do aplicativo é: <strong className="text-white font-mono">1234</strong></span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                PIN Atual (4 dígitos):
              </label>
              <input
                type="password"
                maxLength={4}
                required
                value={currentPinInput}
                onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 font-mono text-lg text-center tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Novo PIN (4 dígitos):
              </label>
              <input
                type="password"
                maxLength={4}
                required
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 font-mono text-lg text-center tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Confirme o Novo PIN:
              </label>
              <input
                type="password"
                maxLength={4}
                required
                value={confirmPinInput}
                onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 font-mono text-lg text-center tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {pinMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  pinMessage.isError
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {pinMessage.isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{pinMessage.text}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              Salvar Novo PIN de Segurança
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
