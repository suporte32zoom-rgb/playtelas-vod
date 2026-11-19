import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Tv,
  Settings,
  ChevronLeft,
  ChevronRight,
  Cast,
  Lock,
  RotateCcw,
  Sliders,
  Clock,
  Sparkles,
  Layers,
  Ratio,
  Maximize2,
  X,
  ArrowUpRight
} from 'lucide-react';
import { Channel, AspectRatioMode, EqualizerMode } from '../types/tv';
import { getCurrentProgram, getProgramProgress } from '../data/channels';

interface VideoPlayerProps {
  channel: Channel;
  isLocked?: boolean;
  onUnlockRequest?: () => void;
  onOpenCastModal?: () => void;
  onNextChannel?: () => void;
  onPrevChannel?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  isLocked = false,
  onUnlockRequest,
  onOpenCastModal,
  onNextChannel,
  onPrevChannel,
  onToggleFavorite,
  isFavorite = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Player UI states
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [volumeBoost, setVolumeBoost] = useState<number>(1); // 1 = 100%, 1.5 = 150%, 2 = 200%
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isScrolledPast, setIsScrolledPast] = useState<boolean>(false);
  const [isMiniDismissed, setIsMiniDismissed] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>('16:9');
  const [equalizer, setEqualizer] = useState<EqualizerMode>('padrao');
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [currentStreamIndex, setCurrentStreamIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [qualityLevels, setQualityLevels] = useState<{ id: number; name: string }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentProgram = getCurrentProgram(channel);
  const progressPercent = getProgramProgress(currentProgram);

  // Initialize Web Audio Gain Node for Volume Boost (+200%)
  const setupAudioContext = useCallback(() => {
    if (!videoRef.current || audioCtxRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaElementSource(videoRef.current);
      const gain = ctx.createGain();
      gain.gain.value = volumeBoost;
      source.connect(gain);
      gain.connect(ctx.destination);
      audioCtxRef.current = ctx;
      gainNodeRef.current = gain;
    } catch {
      // Browser might restrict or already connected
    }
  }, [volumeBoost]);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volumeBoost;
    }
  }, [volumeBoost]);

  // Load HLS Stream
  const loadStream = useCallback((streamUrl: string) => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    setIsLoading(true);
    setErrorMsg(null);

    // Destroy existing Hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        manifestLoadingTimeOut: 15000,
        levelLoadingTimeOut: 15000,
        fragLoadingTimeOut: 20000,
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsLoading(false);
        const levels = data.levels.map((lvl, index) => ({
          id: index,
          name: lvl.height ? `${lvl.height}p` : `Qualidade ${index + 1}`
        }));
        setQualityLevels(levels);

        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch((err) => {
              // AbortError is normal when a new stream is loaded before the previous play() resolved
              if (err?.name !== 'AbortError') {
                console.debug('Autoplay prevented or interrupted:', err);
              }
              setIsPlaying(false);
            });
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentQuality(data.level);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.warn('HLS Error event:', data.type, data.details);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try next mirror stream if available
              if (channel.streams.length > 1 && currentStreamIndex < channel.streams.length - 1) {
                console.log('Failing over to mirror server...');
                setCurrentStreamIndex((prev) => prev + 1);
              } else {
                hls.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              setErrorMsg('Falha ao conectar no fluxo deste canal. Tente um servidor alternativo.');
              setIsLoading(false);
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari support
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        video.play().catch(() => setIsPlaying(false));
      });
      video.addEventListener('error', () => {
        if (channel.streams.length > 1 && currentStreamIndex < channel.streams.length - 1) {
          setCurrentStreamIndex((prev) => prev + 1);
        } else {
          setErrorMsg('Sinal temporariamente indisponível.');
          setIsLoading(false);
        }
      });
    } else {
      setErrorMsg('Seu navegador não possui suporte a streaming HLS.');
      setIsLoading(false);
    }
  }, [channel.streams, currentStreamIndex]);

  // Load when channel or stream index changes
  useEffect(() => {
    setCurrentStreamIndex(0);
    setErrorMsg(null);
  }, [channel.id]);

  useEffect(() => {
    if (isLocked) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const targetStream = channel.streams[currentStreamIndex] || channel.streams[0];
    if (targetStream?.url) {
      loadStream(targetStream.url);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel, currentStreamIndex, isLocked, loadStream]);

  // Handle Controls Auto-hide
  const triggerUserActivity = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettingsMenu) {
        setShowControls(false);
      }
    }, 4000);
  }, [isPlaying, showSettingsMenu]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Detect when user scrolls past main player
  useEffect(() => {
    const handleScroll = () => {
      if (!sentinelRef.current) return;
      const rect = sentinelRef.current.getBoundingClientRect();
      const scrolledPast = rect.bottom < 80;
      setIsScrolledPast(scrolledPast);
      if (!scrolledPast) {
        setIsMiniDismissed(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Reset mini dismissed state on channel change
  useEffect(() => {
    setIsMiniDismissed(false);
  }, [channel.id]);

  const scrollToMainPlayer = useCallback(() => {
    if (sentinelRef.current) {
      sentinelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Sleep Timer countdown
  useEffect(() => {
    if (!sleepTimerMinutes) return;
    const interval = setInterval(() => {
      setSleepTimerMinutes((prev) => {
        if (!prev || prev <= 1) {
          if (videoRef.current) videoRef.current.pause();
          setIsPlaying(false);
          return null;
        }
        return prev - 1;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [sleepTimerMinutes]);

  // Actions
  const togglePlay = () => {
    setupAudioContext();
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            if (err?.name !== 'AbortError') {
              console.debug('Play request interrupted or prevented:', err);
            }
            setIsPlaying(false);
          });
      }
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    triggerUserActivity();
  };

  const toggleMute = () => {
    setupAudioContext();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
    triggerUserActivity();
  };

  const handleVolumeChange = (newVol: number) => {
    setupAudioContext();
    if (!videoRef.current) return;
    videoRef.current.volume = newVol;
    setVolume(newVol);
    setIsMuted(newVol === 0);
    triggerUserActivity();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    triggerUserActivity();
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('PiP error:', e);
    }
  };

  const changeQuality = (levelIndex: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelIndex;
    setCurrentQuality(levelIndex);
  };

  // Aspect ratio classes
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case '4:3':
        return 'aspect-4/3 max-h-[85vh] mx-auto object-contain';
      case 'fill':
        return 'w-full h-full object-cover';
      case 'cinema':
        return 'aspect-21/9 max-h-[85vh] mx-auto object-cover';
      case '16:9':
      default:
        return 'w-full h-full object-contain';
    }
  };

  const currentStream = channel.streams[currentStreamIndex] || channel.streams[0];
  const isMiniPlayer = isScrolledPast && !isMiniDismissed && !isFullscreen;

  return (
    <div ref={sentinelRef} className="w-full relative">
      {/* Placeholder in normal flow when player is detached into floating mini mode */}
      {isMiniPlayer && (
        <div
          onClick={scrollToMainPlayer}
          className="w-full aspect-video max-h-[68vh] rounded-2xl border-2 border-dashed border-indigo-500/40 bg-gradient-to-br from-indigo-950/20 via-slate-900/40 to-slate-950/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center cursor-pointer group hover:border-indigo-400/80 transition duration-300"
        >
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-2 group-hover:scale-110 transition shadow-lg shadow-indigo-500/10">
            <Tv className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-white group-hover:text-indigo-300 transition">
            <span>Reproduzindo no Mini Player</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {channel.name} • Clique aqui ou role a página para cima para restaurar
          </p>
        </div>
      )}

      {/* Main / Floating Video Player */}
      <div
        ref={containerRef}
        onMouseMove={triggerUserActivity}
        onTouchStart={triggerUserActivity}
        className={`bg-black overflow-hidden group select-none transition-all duration-300 ${
          isFullscreen
            ? 'fixed inset-0 z-50 h-screen w-screen'
            : isMiniPlayer
              ? 'fixed bottom-5 right-5 z-40 w-72 sm:w-80 md:w-96 aspect-video rounded-2xl shadow-2xl shadow-black/90 border-2 border-indigo-500/70 bg-slate-950 ring-4 ring-indigo-500/20 animate-in fade-in slide-in-from-bottom duration-300'
              : 'relative w-full rounded-2xl shadow-2xl border border-slate-800/80 aspect-video max-h-[68vh]'
        }`}
      >
        {/* Video Element */}
        {!isLocked ? (
          <video
            ref={videoRef}
            playsInline
            className={`w-full h-full ${getAspectRatioClass()} transition-all duration-200 cursor-pointer`}
            onClick={isMiniPlayer ? scrollToMainPlayer : togglePlay}
            onWaiting={() => setIsLoading(true)}
            onPlaying={() => {
              setIsLoading(false);
              setIsPlaying(true);
            }}
          />
      ) : (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center z-20">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 animate-bounce">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Canal Bloqueado por Controle Parental</h3>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            Este canal requer o PIN de segurança de 4 dígitos para liberação de exibição.
          </p>
          <button
            onClick={onUnlockRequest}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 px-6 py-3 font-semibold text-white shadow-lg shadow-rose-600/30 hover:brightness-110 active:scale-95 transition cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>Desbloquear com PIN</span>
          </button>
        </div>
      )}

      {/* Buffering Indicator */}
      {isLoading && !isLocked && !errorMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] z-10 pointer-events-none">
          <div className="relative w-14 h-14">
            <div className="w-14 h-14 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-indigo-400">
              <Tv className="w-6 h-6 animate-pulse" />
            </div>
          </div>
          <span className="mt-3 text-xs font-semibold text-slate-300 tracking-wider uppercase">
            Conectando ao vivo ({currentStream?.quality || 'HD'})...
          </span>
        </div>
      )}

      {/* Stream Error Overlay with Mirror Switcher */}
      {errorMsg && !isLocked && (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-20">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
            <RotateCcw className="w-7 h-7" />
          </div>
          <h4 className="text-lg font-bold text-white mb-1">Falha na Conexão do Sinal</h4>
          <p className="text-xs text-slate-400 max-w-sm mb-4">{errorMsg}</p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {channel.streams.map((str, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStreamIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  currentStreamIndex === idx
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Servidor {idx + 1} ({str.quality})
              </button>
            ))}
            <button
              onClick={() => {
                const target = channel.streams[currentStreamIndex] || channel.streams[0];
                if (target) loadStream(target.url);
              }}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Tentar Novamente
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MINI PLAYER OVERLAYS (Shown when floating in mini mode)      */}
      {/* ============================================================ */}
      {isMiniPlayer && (
        <>
          {/* Mini Top Bar */}
          <div className="absolute top-0 left-0 right-0 p-2.5 bg-gradient-to-b from-black/95 via-black/60 to-transparent z-20 flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0 pr-2">
              <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-mono font-bold text-[10px]">
                #{channel.channelNumber.toString().padStart(3, '0')}
              </span>
              <span className="text-xs font-bold text-white truncate max-w-[110px] sm:max-w-[150px]">
                {channel.name}
              </span>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" title="Ao Vivo" />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={scrollToMainPlayer}
                title="Restaurar Player Principal"
                className="p-1.5 rounded-lg bg-black/60 hover:bg-indigo-600 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMiniDismissed(true)}
                title="Fechar Mini Player"
                className="p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Mini Bottom Controls Bar (Visible on hover) */}
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-20 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="flex items-center gap-1">
              {onPrevChannel && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPrevChannel();
                  }}
                  title="Canal Anterior"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                title={isPlaying ? 'Pausar' : 'Reproduzir'}
                className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
              </button>
              {onNextChannel && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNextChannel();
                  }}
                  title="Próximo Canal"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                title={isMuted ? 'Ativar Som' : 'Silenciar'}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                scrollToMainPlayer();
              }}
              className="px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-indigo-600 text-[10px] font-bold text-slate-200 hover:text-white flex items-center gap-1 transition cursor-pointer"
            >
              <span>Voltar</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* STANDARD PLAYER OVERLAYS (Shown when NOT in mini player mode) */}
      {/* ============================================================ */}
      {!isMiniPlayer && (
        <>
          {/* Top Header Bar Overlay (Fade on inactivity) */}
          <div
            className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent z-20 flex items-center justify-between transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
        <div className="flex items-center gap-3">
          {/* Channel Number Pill */}
          <div className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-mono font-bold text-xs tracking-wide shadow-md">
            #{channel.channelNumber.toString().padStart(3, '0')}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight drop-shadow-md">
                {channel.name}
              </h2>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-red-600 text-white tracking-widest animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                AO VIVO
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800/80 text-indigo-300 border border-slate-700">
                {currentStream?.quality || 'HD'}
              </span>
            </div>
            <p className="text-xs text-slate-300 line-clamp-1 mt-0.5 font-medium drop-shadow">
              {currentProgram.title}
            </p>
          </div>
        </div>

        {/* Top Right Quick Controls */}
        <div className="flex items-center gap-2">
          {/* Smart TV Cast Button */}
          <button
            onClick={onOpenCastModal}
            title="Enviar para Smart TV"
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/80 text-slate-200 hover:text-indigo-400 hover:bg-slate-800 transition cursor-pointer active:scale-95"
          >
            <Cast className="w-4 h-4" />
          </button>

          {/* Sleep Timer Indicator */}
          {sleepTimerMinutes && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>{sleepTimerMinutes}m</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls Bar Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent z-20 flex flex-col gap-2 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* EPG Live Program Progress Bar */}
        <div className="w-full flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>{currentProgram.startTime}</span>
            <span className="text-slate-300 font-sans font-medium line-clamp-1 max-w-[70%] text-center">
              {currentProgram.title} ({currentProgram.rating})
            </span>
            <span>{currentProgram.endTime}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800/90 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between mt-1">
          {/* Left Controls: Prev, Play/Pause, Next, Volume */}
          <div className="flex items-center gap-2">
            {/* Prev Channel */}
            <button
              onClick={onPrevChannel}
              title="Canal Anterior"
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition cursor-pointer active:scale-95"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            {/* Next Channel */}
            <button
              onClick={onNextChannel}
              title="Próximo Canal"
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Volume & Boost */}
            <div className="flex items-center gap-1.5 ml-2">
              <button
                onClick={toggleMute}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 sm:w-20 accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer hidden xs:block"
              />
              {volumeBoost > 1 && (
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                  +{Math.round((volumeBoost - 1) * 100)}%
                </span>
              )}
            </div>
          </div>

          {/* Right Controls: Settings, Mirror selector, Aspect Ratio, PiP, Fullscreen */}
          <div className="flex items-center gap-1.5">
            {/* Mirror Stream Server Selector */}
            {channel.streams.length > 1 && (
              <select
                value={currentStreamIndex}
                onChange={(e) => setCurrentStreamIndex(parseInt(e.target.value))}
                className="bg-slate-900/90 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer hidden sm:block"
              >
                {channel.streams.map((str, idx) => (
                  <option key={idx} value={idx}>
                    Servidor {idx + 1} ({str.quality})
                  </option>
                ))}
              </select>
            )}

            {/* Aspect Ratio Toggle Button */}
            <button
              onClick={() => {
                const modes: AspectRatioMode[] = ['16:9', '4:3', 'fill', 'cinema'];
                const nextIdx = (modes.indexOf(aspectRatio) + 1) % modes.length;
                setAspectRatio(modes[nextIdx]);
              }}
              title={`Proporção da Tela: ${aspectRatio}`}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer flex items-center gap-1 text-xs font-mono"
            >
              <Ratio className="w-4 h-4" />
              <span className="text-[10px] uppercase font-bold hidden md:inline">{aspectRatio}</span>
            </button>

            {/* Picture in Picture */}
            <button
              onClick={togglePiP}
              title="Picture-in-Picture (Janela Flutuante)"
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer hidden xs:block"
            >
              <Layers className="w-4 h-4" />
            </button>

            {/* Settings Menu Toggle */}
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              title="Ajustes de Áudio e Vídeo"
              className={`p-2 rounded-xl transition cursor-pointer ${
                showSettingsMenu ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer active:scale-95"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Settings Flyout Drawer */}
      {showSettingsMenu && (
        <div className="absolute right-4 bottom-18 w-72 rounded-2xl bg-slate-900/95 border border-slate-700/80 p-4 shadow-2xl backdrop-blur-xl z-30 text-slate-200 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              Ajustes do Player
            </span>
            <button
              onClick={() => setShowSettingsMenu(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Quality Selector */}
          <div>
            <label className="text-slate-400 font-medium block mb-1">Qualidade de Streaming</label>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => changeQuality(-1)}
                className={`py-1 rounded-lg border font-semibold transition cursor-pointer ${
                  currentQuality === -1 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                Automática
              </button>
              {qualityLevels.map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => changeQuality(lvl.id)}
                  className={`py-1 rounded-lg border font-semibold transition cursor-pointer ${
                    currentQuality === lvl.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {lvl.name}
                </button>
              ))}
            </div>
          </div>

          {/* Audio Boost (Amplificador de Som) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400 font-medium">Amplificador de Volume (Audio Boost)</label>
              <span className="text-indigo-400 font-bold font-mono">
                {Math.round(volumeBoost * 100)}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[1.0, 1.5, 2.0].map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    setupAudioContext();
                    setVolumeBoost(b);
                  }}
                  className={`py-1 rounded-lg border font-semibold transition cursor-pointer ${
                    volumeBoost === b ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {b === 1 ? 'Normal 100%' : `+${Math.round((b - 1) * 100)}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Equalizer Mode */}
          <div>
            <label className="text-slate-400 font-medium block mb-1">Perfil de Equalização</label>
            <div className="grid grid-cols-3 gap-1">
              {(['padrao', 'dialogo', 'cinema'] as EqualizerMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setEqualizer(mode)}
                  className={`py-1 rounded-lg border capitalize font-semibold transition cursor-pointer ${
                    equalizer === mode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {mode === 'padrao' ? 'Padrão' : mode === 'dialogo' ? 'Diálogo' : 'Cinema'}
                </button>
              ))}
            </div>
          </div>

          {/* Sleep Timer (Timer para desligar) */}
          <div>
            <label className="text-slate-400 font-medium block mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Temporizador de Desligamento (Sleep)
            </label>
            <div className="grid grid-cols-4 gap-1">
              {[null, 15, 30, 60].map((t) => (
                <button
                  key={String(t)}
                  onClick={() => setSleepTimerMinutes(t)}
                  className={`py-1 rounded-lg border font-semibold transition cursor-pointer ${
                    sleepTimerMinutes === t ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {t === null ? 'Desligado' : `${t} min`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  </div>
);
};
