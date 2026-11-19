/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Tv,
  Star,
  Search,
  Filter,
  Sparkles,
  Lock,
  Layers,
  List,
  Cast,
  Mic,
  WifiOff,
  Bell,
  X,
  Volume2,
  Play
} from 'lucide-react';
import { Channel, CategoryId, UserProfileType } from './types/tv';
import { CHANNELS, getChannelById, getCurrentProgram } from './data/channels';
import { Header } from './components/Header';
import { CategoryNav } from './components/CategoryNav';
import { VideoPlayer } from './components/VideoPlayer';
import { ChannelCard } from './components/ChannelCard';
import { SmartTVCastModal } from './components/SmartTVCastModal';
import { VoiceSearchModal } from './components/VoiceSearchModal';
import { EPGGuideModal } from './components/EPGGuideModal';
import { ParentalControlModal } from './components/ParentalControlModal';
import { PinPromptModal } from './components/PinPromptModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { WebTVReceiver } from './components/WebTVReceiver';
import { useFavorites } from './hooks/useFavorites';
import { useSmartTVCast } from './hooks/useSmartTVCast';
import { useVoiceSearch } from './hooks/useVoiceSearch';
import { useParentalControl } from './hooks/useParentalControl';
import { usePushNotifications } from './hooks/usePushNotifications';

export default function App() {
  // Check if running in TV Receiver mode
  const [isTVReceiverMode, setIsTVReceiverMode] = useState<boolean>(() => {
    return new URLSearchParams(window.location.search).get('mode') === 'tv';
  });

  const receiverRoom = useMemo(() => {
    return new URLSearchParams(window.location.search).get('room') || 'TV-8492';
  }, []);

  // Channel Selection
  const [selectedChannelId, setSelectedChannelId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('cinelive_last_channel');
      return saved && getChannelById(saved) ? saved : 'ch-1';
    } catch {
      return 'ch-1';
    }
  });

  // Categories & Search Filter
  const [activeCategory, setActiveCategory] = useState<CategoryId>('todos');
  const [activeSubcategory, setActiveSubcategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Panels State
  const [isCastModalOpen, setIsCastModalOpen] = useState<boolean>(false);
  const [isEPGModalOpen, setIsEPGModalOpen] = useState<boolean>(false);
  const [isParentalModalOpen, setIsParentalModalOpen] = useState<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);

  // Custom Hooks
  const { favoriteIds, toggleFavorite, isFavorite, favoritesCount } = useFavorites();
  const {
    devices,
    activeDevice,
    isCasting,
    pairingCode,
    connectToDevice,
    disconnectCast,
    broadcastChannelChange
  } = useSmartTVCast();

  const {
    settings: parentalSettings,
    verifyPin,
    changePin,
    setProfile,
    toggleChannelLock,
    isChannelAllowed,
    isChannelLocked,
    isPinModalOpen,
    pinPromptReason,
    promptPin,
    resolvePinPrompt,
    closePinModal
  } = useParentalControl();

  const {
    isEnabled: notificationsEnabled,
    toggleNotifications,
    scheduleProgramAlert,
    isProgramScheduled,
    latestToast,
    dismissToast
  } = usePushNotifications();

  // Voice Search Hook
  const handleVoiceMatch = useCallback((transcriptText: string) => {
    const q = transcriptText.toLowerCase().trim();
    // Check if directly matches a channel number
    const numMatch = q.match(/\b\d+\b/);
    if (numMatch) {
      const targetNum = parseInt(numMatch[0], 10);
      const ch = CHANNELS.find((c) => c.channelNumber === targetNum);
      if (ch) {
        setSelectedChannelId(ch.id);
        setIsVoiceModalOpen(false);
        return;
      }
    }
    // Check for exact channel name match
    const exactMatch = CHANNELS.find((c) => c.name.toLowerCase() === q);
    if (exactMatch) {
      setSelectedChannelId(exactMatch.id);
      setIsVoiceModalOpen(false);
      return;
    }
    setSearchQuery(transcriptText);
  }, []);

  const {
    isListening,
    transcript,
    startListening,
    stopListening
  } = useVoiceSearch(handleVoiceMatch);

  // Save last selected channel
  useEffect(() => {
    try {
      localStorage.setItem('cinelive_last_channel', selectedChannelId);
    } catch {
      // ignore storage errors
    }
  }, [selectedChannelId]);

  // Current active channel object
  const currentChannel = useMemo(() => {
    return getChannelById(selectedChannelId) || CHANNELS[0];
  }, [selectedChannelId]);

  // Channel counts per category
  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: CHANNELS.length };
    CHANNELS.forEach((c) => {
      counts[c.category] = (counts[c.category] || 0) + 1;
    });
    return counts;
  }, []);

  // Filtered Channels calculation
  const filteredChannels = useMemo(() => {
    return CHANNELS.filter((ch) => {
      // 1. Parental Control Filter
      if (!isChannelAllowed(ch)) {
        return false;
      }

      // 2. Category Filter
      if (activeCategory === 'favoritos') {
        if (!favoriteIds.includes(ch.id)) return false;
      } else if (activeCategory !== 'todos') {
        if (ch.category !== activeCategory) return false;
      }

      // 3. Subcategory Filter
      if (activeSubcategory !== 'Todos') {
        if (ch.subcategory !== activeSubcategory) return false;
      }

      // 4. Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = ch.name.toLowerCase().includes(query);
        const subMatch = ch.subcategory.toLowerCase().includes(query);
        const catMatch = ch.category.toLowerCase().includes(query);
        const numMatch = String(ch.channelNumber) === query || `#${ch.channelNumber}` === query;
        const progMatch = ch.epgSchedule.some((p) => p.title.toLowerCase().includes(query));
        if (!nameMatch && !subMatch && !catMatch && !numMatch && !progMatch) {
          return false;
        }
      }

      return true;
    });
  }, [activeCategory, activeSubcategory, searchQuery, favoriteIds, isChannelAllowed]);

  // Channel switching with parental verification
  const handleSelectChannel = (channelId: string) => {
    const targetChannel = getChannelById(channelId);
    if (!targetChannel) return;

    if (isChannelLocked(targetChannel)) {
      promptPin(`O canal ${targetChannel.name} está protegido com PIN.`, () => {
        setSelectedChannelId(channelId);
        broadcastChannelChange(targetChannel);
      });
      return;
    }

    setSelectedChannelId(channelId);
    broadcastChannelChange(targetChannel);
  };

  const handleNextChannel = () => {
    const currentIndex = filteredChannels.findIndex((c) => c.id === selectedChannelId);
    if (currentIndex === -1) {
      if (filteredChannels.length > 0) handleSelectChannel(filteredChannels[0].id);
      return;
    }
    const nextIdx = (currentIndex + 1) % filteredChannels.length;
    handleSelectChannel(filteredChannels[nextIdx].id);
  };

  const handlePrevChannel = () => {
    const currentIndex = filteredChannels.findIndex((c) => c.id === selectedChannelId);
    if (currentIndex === -1) {
      if (filteredChannels.length > 0) handleSelectChannel(filteredChannels[0].id);
      return;
    }
    const prevIdx = (currentIndex - 1 + filteredChannels.length) % filteredChannels.length;
    handleSelectChannel(filteredChannels[prevIdx].id);
  };

  // Profile Switching with PIN verification when leaving Kids mode
  const handleProfileSwitch = (newProfile: UserProfileType) => {
    setProfile(newProfile, () => {
      promptPin('Digite o PIN de segurança para desativar o Perfil Kids.', () => {
        setProfile(newProfile);
      });
    });
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextChannel();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevChannel();
      } else if (e.key.toLowerCase() === 'g') {
        setIsEPGModalOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === 'c') {
        setIsCastModalOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredChannels, selectedChannelId]);

  // If in dedicated Smart TV receiver mode
  if (isTVReceiverMode) {
    return (
      <WebTVReceiver
        initialRoom={receiverRoom}
        onExit={() => setIsTVReceiverMode(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white pb-16">
      
      {/* Offline Status Floating Pill */}
      <OfflineIndicator />

      {/* Push Notification In-App Toast Alert */}
      {latestToast && (
        <div className="fixed top-18 right-4 z-50 max-w-sm rounded-2xl bg-indigo-950/95 border border-indigo-500/40 p-4 shadow-2xl backdrop-blur-xl text-slate-100 flex items-start gap-3 animate-in slide-in-from-top duration-300">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-md">
            <Bell className="w-4 h-4 animate-bounce" />
          </div>
          <div className="flex-1">
            <h5 className="text-xs font-bold text-white">{latestToast.title}</h5>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{latestToast.body}</p>
          </div>
          <button
            onClick={dismissToast}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* App Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenVoiceSearch={() => setIsVoiceModalOpen(true)}
        onOpenCastModal={() => setIsCastModalOpen(true)}
        onOpenEPGModal={() => setIsEPGModalOpen(true)}
        onOpenParentalModal={() => setIsParentalModalOpen(true)}
        activeProfile={parentalSettings.activeProfile}
        isCasting={isCasting}
        notificationsEnabled={notificationsEnabled}
        onToggleNotifications={toggleNotifications}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 pt-3 flex-1 flex flex-col gap-4">
        
        {/* Kids Safe Profile Banner */}
        {parentalSettings.activeProfile === 'kids' && (
          <div className="w-full rounded-2xl bg-gradient-to-r from-cyan-600/20 via-blue-600/20 to-indigo-600/20 border border-cyan-500/40 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧸</span>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-cyan-300">
                  Modo Infantil Protegido Ativo
                </h4>
                <p className="text-[11px] text-slate-300">
                  Exibindo apenas canais e animações livres para crianças.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleProfileSwitch('adulto')}
              className="px-3 py-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-xs font-semibold text-cyan-200 transition cursor-pointer active:scale-95"
            >
              Sair do Kids
            </button>
          </div>
        )}

        {/* Video Player Section */}
        <section className="w-full">
          <VideoPlayer
            channel={currentChannel}
            isLocked={isChannelLocked(currentChannel)}
            onUnlockRequest={() => {
              promptPin(`Desbloquear canal ${currentChannel.name}`, () => {});
            }}
            onOpenCastModal={() => setIsCastModalOpen(true)}
            onNextChannel={handleNextChannel}
            onPrevChannel={handlePrevChannel}
            onToggleFavorite={() => toggleFavorite(currentChannel.id)}
            isFavorite={isFavorite(currentChannel.id)}
          />
        </section>

        {/* Categories Navigation Bar */}
        <section className="w-full">
          <CategoryNav
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            activeSubcategory={activeSubcategory}
            onSelectSubcategory={setActiveSubcategory}
            favoritesCount={favoritesCount}
            channelCounts={channelCounts}
          />
        </section>

        {/* Channel Grid Section */}
        <section className="w-full flex-1">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                {activeCategory === 'todos' ? 'Grade Geral de Canais' : activeCategory.replace('-', ' & ')}
              </h2>
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                {filteredChannels.length} canais
              </span>
            </div>

            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer font-medium"
              >
                Limpar busca ("{searchQuery}")
              </button>
            )}
          </div>

          {filteredChannels.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredChannels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  isActive={channel.id === currentChannel.id}
                  isFavorite={isFavorite(channel.id)}
                  isLocked={isChannelLocked(channel)}
                  onSelect={handleSelectChannel}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          ) : (
            <div className="w-full py-16 rounded-3xl bg-slate-900/40 border border-slate-800 flex flex-col items-center justify-center text-center p-6">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-500 mb-3">
                <Search className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">
                Nenhum canal encontrado
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                Não localizamos canais para os filtros ou busca aplicados.
              </p>
              <button
                onClick={() => {
                  setActiveCategory('todos');
                  setActiveSubcategory('Todos');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition cursor-pointer"
              >
                Ver Todos os Canais
              </button>
            </div>
          )}
        </section>
      </main>


      {/* Smart TV Cast Modal */}
      <SmartTVCastModal
        isOpen={isCastModalOpen}
        onClose={() => setIsCastModalOpen(false)}
        channel={currentChannel}
        devices={devices}
        activeDevice={activeDevice}
        pairingCode={pairingCode}
        onConnectDevice={(dev) => connectToDevice(dev, currentChannel)}
        onDisconnectCast={disconnectCast}
      />

      {/* Voice Search Modal */}
      <VoiceSearchModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        isListening={isListening}
        transcript={transcript}
        onStartListening={startListening}
        onStopListening={stopListening}
        onSelectChannel={handleSelectChannel}
        channels={CHANNELS}
      />

      {/* Real-Time EPG Guide Modal */}
      <EPGGuideModal
        isOpen={isEPGModalOpen}
        onClose={() => setIsEPGModalOpen(false)}
        channels={CHANNELS}
        currentChannel={currentChannel}
        onSelectChannel={handleSelectChannel}
        onScheduleAlert={scheduleProgramAlert}
        isAlertScheduled={isProgramScheduled}
      />

      {/* Parental Control Settings Modal */}
      <ParentalControlModal
        isOpen={isParentalModalOpen}
        onClose={() => setIsParentalModalOpen(false)}
        settings={parentalSettings}
        channels={CHANNELS}
        onSetProfile={handleProfileSwitch}
        onToggleChannelLock={toggleChannelLock}
        onChangePin={changePin}
        verifyPin={verifyPin}
      />

      {/* Security PIN Prompt Modal */}
      <PinPromptModal
        isOpen={isPinModalOpen}
        onClose={closePinModal}
        reason={pinPromptReason}
        onVerify={resolvePinPrompt}
      />
    </div>
  );
}
