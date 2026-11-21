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
  RotateCcw,
  Sliders,
  Clock,
  Layers,
  Ratio,
  Maximize2,
  X,
  ArrowUpRight,
  Copy,
  Check,
  ShieldAlert
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
  const [streamStatus, setStreamStatus] = useState<
    'loading' | 'playing' | 'paused' | 'blocked_mixed_content' | 'blocked_cors' | 'unavailable'
  >('loading');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCorsError, setIsCorsError] = useState<boolean>(false);
  const [proxyInput, setProxyInput] = useState<string>(() => {
    try {
      return localStorage.getItem('playtelas_hls_proxy') || import.meta.env.VITE_HLS_PROXY_URL || '';
    } catch {
      return import.meta.env.VITE_HLS_PROXY_URL || '';
    }
  });
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [qualityLevels, setQualityLevels] = useState<{ id: number; name: string }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentProgram = getCurrentProgram(channel);
  const progressPercent = getProgramProgress(currentProgram);

  // Sync optional ?proxy= query param to localStorage
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const paramProxy = params.get('proxy');
      if (paramProxy !== null) {
        const cleaned = paramProxy.trim().replace(/[/?]+$/, '');
        if (cleaned) {
          localStorage.setItem('playtelas_hls_proxy', cleaned);
          setProxyInput(cleaned);
        } else {
          localStorage.removeItem('playtelas_hls_proxy');
          setProxyInput('');
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const getActiveProxyUrl = useCallback((): string => {
    try {
      const saved = localStorage.getItem('playtelas_hls_proxy');
      if (saved && saved.trim()) return saved.trim().replace(/[/?]+$/, '');
    } catch {
      // ignore
    }
    const envProxy = import.meta.env.VITE_HLS_PROXY_URL;
    return envProxy ? String(envProxy).trim().replace(/[/?]+$/, '') : '';
  }, []);

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

  const attemptedIndicesRef = useRef<Set<number>>(new Set());
  const playbackAbortRef = useRef<AbortController | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFailureRef = useRef<{ isMixedContent: boolean; isCors: boolean; detail?: string }>({
    isMixedContent: false,
    isCors: false
  });

  const clearLoadTimeout = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }, []);

  // Failover helper: automatically cycles through all available mirrors when one fails
  const failoverToNextStream = useCallback(
    (failureInfo?: { isMixedContent?: boolean; isCors?: boolean; detail?: string }) => {
      clearLoadTimeout();
      if (failureInfo) {
        lastFailureRef.current = {
          isMixedContent: Boolean(failureInfo.isMixedContent || lastFailureRef.current.isMixedContent),
          isCors: Boolean(failureInfo.isCors || lastFailureRef.current.isCors),
          detail: failureInfo.detail || lastFailureRef.current.detail
        };
      }

      const totalStreams = channel.streams.length;
      let nextIndex = -1;

      // If current failure was HTTP Mixed Content on an HTTPS page, prefer an untried HTTPS backup first
      if (failureInfo?.isMixedContent) {
        for (let i = 0; i < totalStreams; i++) {
          const idx = (currentStreamIndex + 1 + i) % totalStreams;
          if (!attemptedIndicesRef.current.has(idx) && channel.streams[idx]?.url.startsWith('https://')) {
            nextIndex = idx;
            break;
          }
        }
      }

      if (nextIndex === -1) {
        for (let i = 0; i < totalStreams; i++) {
          const idx = (currentStreamIndex + 1 + i) % totalStreams;
          if (!attemptedIndicesRef.current.has(idx)) {
            nextIndex = idx;
            break;
          }
        }
      }

      if (nextIndex !== -1) {
        console.info(
          `[PlayTelas Player] Alternando para servidor alternativo ${nextIndex + 1}/${totalStreams} do canal "${channel.name}"...`
        );
        attemptedIndicesRef.current.add(nextIndex);
        setCurrentStreamIndex(nextIndex);
        return;
      }

      const isMixedContentFinal =
        Boolean(failureInfo?.isMixedContent) || lastFailureRef.current.isMixedContent;
      const isCorsFinal = Boolean(failureInfo?.isCors) || lastFailureRef.current.isCors;

      console.warn(
        `[PlayTelas Player] Nenhum servidor reproduzível para "${channel.name}" (${totalStreams} testados). Motivo:`,
        { isMixedContentFinal, isCorsFinal, detail: failureInfo?.detail }
      );

      if (isMixedContentFinal) {
        setStreamStatus('blocked_mixed_content');
        setIsCorsError(true);
        setErrorMsg(
          'Este canal usa link HTTP em uma página HTTPS e o navegador bloqueou por Mixed Content. Para reproduzir direto no Chrome como uma aba normal, permita "Conteúdo não seguro" nas configurações deste site (ícone ao lado do endereço), conecte via Proxy HTTPS abaixo ou abra o stream em nova aba / player externo.'
        );
      } else if (isCorsFinal) {
        setStreamStatus('blocked_cors');
        setIsCorsError(true);
        setErrorMsg(
          'O servidor deste canal bloqueou a leitura direta por CORS neste navegador. Tente outro servidor alternativo, abra o stream em nova aba, copie o link para player externo ou use o Proxy Cloudflare Worker abaixo.'
        );
      } else {
        setStreamStatus('unavailable');
        setIsCorsError(false);
        setErrorMsg(
          failureInfo?.detail ||
            (totalStreams > 1
              ? `Stream indisponível no momento. Todos os ${totalStreams} servidores configurados foram testados.`
              : 'Stream indisponível no momento. Tente novamente ou abra o link em nova aba / player externo.')
        );
      }
      setIsLoading(false);
    },
    [channel.name, channel.streams, clearLoadTimeout, currentStreamIndex]
  );

  // Load HLS / Media Stream (attempts both HTTPS and HTTP URLs cleanly)
  const loadStream = useCallback(
    (streamUrl: string, streamIdx: number) => {
      if (!videoRef.current) return;
      const video = videoRef.current;

      clearLoadTimeout();
      if (playbackAbortRef.current) {
        playbackAbortRef.current.abort();
      }
      const abortController = new AbortController();
      playbackAbortRef.current = abortController;

      try {
        video.setAttribute('referrerpolicy', 'no-referrer');
      } catch {
        // browser compatibility
      }

      const isHttpStream = streamUrl.startsWith('http://');
      const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const activeProxy = getActiveProxyUrl();
      const isHttpOnHttps = isHttpsPage && isHttpStream && !activeProxy;
      const protocolLabel = isHttpStream ? 'HTTP' : 'HTTPS';

      console.info(
        `[PlayTelas Player] Tentando reproduzir #${channel.channelNumber} "${channel.name}" • Servidor ${streamIdx + 1}/${channel.streams.length} (${protocolLabel})`
      );

      setIsLoading(true);
      setStreamStatus('loading');
      setErrorMsg(null);
      setIsCorsError(false);
      setCopiedUrl(false);
      attemptedIndicesRef.current.add(streamIdx);

      // Destroy existing Hls instance and cleanly reset <video> element to prevent frozen frames
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {
        // ignore reset errors
      }

      const currentStreamMeta = channel.streams[streamIdx];
      const refParam =
        activeProxy && currentStreamMeta?.referrer
          ? `&ref=${encodeURIComponent(currentStreamMeta.referrer)}`
          : '';
      const resolvedStreamUrl = activeProxy
        ? `${activeProxy}${activeProxy.includes('?') ? '&' : '?'}url=${encodeURIComponent(streamUrl)}${refParam}`
        : streamUrl;

      // Guard timeout so Mixed Content / stalled sockets never spin forever
      loadTimeoutRef.current = setTimeout(() => {
        if (abortController.signal.aborted) return;
        console.warn(
          `[PlayTelas Player] Tempo limite ao carregar servidor ${streamIdx + 1} (${protocolLabel}) de "${channel.name}".`
        );
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        failoverToNextStream({
          isMixedContent: isHttpOnHttps,
          isCors: !isHttpOnHttps && !activeProxy,
          detail: isHttpOnHttps
            ? undefined
            : 'O servidor demorou para responder ao carregar o manifesto do canal.'
        });
      }, 12000);

      let triedNativeFallback = false;

      const playVideoSafely = () => {
        if (abortController.signal.aborted) return;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (abortController.signal.aborted) return;
              setIsLoading(false);
              setIsPlaying(true);
              setStreamStatus('playing');
            })
            .catch((err) => {
              if (abortController.signal.aborted) return;
              if (err?.name === 'NotAllowedError' && !video.muted) {
                // Retry muted if browser blocked unmuted autoplay on page load
                video.muted = true;
                setIsMuted(true);
                video
                  .play()
                  .then(() => {
                    if (abortController.signal.aborted) return;
                    setIsLoading(false);
                    setIsPlaying(true);
                    setStreamStatus('playing');
                  })
                  .catch(() => {
                    setIsLoading(false);
                    setIsPlaying(false);
                    setStreamStatus('paused');
                  });
                return;
              }
              if (err?.name !== 'AbortError') {
                console.debug('[PlayTelas Player] Autoplay aguardando interação:', err);
              }
              setIsLoading(false);
              setIsPlaying(false);
              setStreamStatus('paused');
            });
        } else {
          setIsLoading(false);
          setStreamStatus('playing');
        }
      };

      const tryNativePlayback = (nativeUrl: string = resolvedStreamUrl) => {
        if (abortController.signal.aborted) return;
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        video.src = nativeUrl;
        const onLoaded = () => {
          if (abortController.signal.aborted) return;
          clearLoadTimeout();
          setIsLoading(false);
          setErrorMsg(null);
          setIsCorsError(false);
          playVideoSafely();
        };
        const onError = () => {
          if (abortController.signal.aborted) return;
          console.warn(
            `[PlayTelas Player] Erro na reprodução nativa (${protocolLabel}) para "${channel.name}".`
          );
          failoverToNextStream({
            isMixedContent: isHttpOnHttps,
            isCors: false
          });
        };
        video.addEventListener('loadedmetadata', onLoaded, { once: true, signal: abortController.signal });
        video.addEventListener('error', onError, { once: true, signal: abortController.signal });
      };

      const lowerUrl = streamUrl.toLowerCase();
      const isDirectMedia =
        lowerUrl.endsWith('.ogg') ||
        lowerUrl.includes('.ogg?') ||
        lowerUrl.endsWith('.mp4') ||
        lowerUrl.includes('.mp4?') ||
        lowerUrl.endsWith('.webm') ||
        lowerUrl.includes('.webm?');

      if (isDirectMedia) {
        setQualityLevels([]);
        tryNativePlayback(streamUrl.startsWith('https://') ? streamUrl : resolvedStreamUrl);
        return;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 10,
          backBufferLength: 60,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          maxBufferHole: 0.5,
          nudgeOffset: 0.1,
          nudgeMaxRetry: 5,
          startFragPrefetch: true,
          manifestLoadingTimeOut: 10000,
          levelLoadingTimeOut: 10000,
          fragLoadingTimeOut: 14000,
          fragLoadingMaxRetry: 4,
          levelLoadingMaxRetry: 4,
          manifestLoadPolicy: {
            default: {
              maxTimeToFirstByteMs: 10000,
              maxLoadTimeMs: 12000,
              timeoutRetry: {
                maxNumRetry: 1,
                retryDelayMs: 800,
                maxRetryDelayMs: 1500
              },
              errorRetry: {
                maxNumRetry: 0,
                retryDelayMs: 800,
                maxRetryDelayMs: 1500
              }
            }
          },
          xhrSetup: (xhr) => {
            xhr.withCredentials = false;
          }
        });

        let mediaRecoveryAttempts = 0;
        let lastStallRecoveryAt = 0;

        hlsRef.current = hls;
        hls.loadSource(resolvedStreamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          if (abortController.signal.aborted) return;
          clearLoadTimeout();
          setIsLoading(false);
          setErrorMsg(null);
          setIsCorsError(false);
          const levels = data.levels.map((lvl, index) => ({
            id: index,
            name: lvl.height ? `${lvl.height}p` : `Qualidade ${index + 1}`
          }));
          setQualityLevels(levels);
          playVideoSafely();
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
          setCurrentQuality(data.level);
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (abortController.signal.aborted) return;
          console.warn(`[PlayTelas Player] HLS Error (${protocolLabel}):`, data.type, data.details, data.response?.code);

          // Non-fatal stall / buffer gap recovery so live video never stays frozen
          if (!data.fatal) {
            if (
              data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
              data.details === Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL ||
              data.details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE
            ) {
              const now = Date.now();
              if (now - lastStallRecoveryAt > 2500) {
                lastStallRecoveryAt = now;
                try {
                  if (video.buffered.length > 0) {
                    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                    if (bufferedEnd - video.currentTime > 1.5) {
                      video.currentTime = Math.max(video.currentTime + 0.25, bufferedEnd - 1);
                    }
                  }
                  if (video.paused && !errorMsg) {
                    video.play().catch(() => {});
                  }
                } catch {
                  // ignore seek nudge errors
                }
              }
            }
            return;
          }

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR: {
              const isZeroResponse = data.response?.code === 0 || !data.response?.code;
              const isManifestCorsBlock =
                data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR &&
                isZeroResponse &&
                !isHttpOnHttps &&
                !activeProxy;
              const isMixedContentFailure = isHttpOnHttps && isZeroResponse;

              if (
                !triedNativeFallback &&
                video.canPlayType('application/vnd.apple.mpegurl')
              ) {
                triedNativeFallback = true;
                tryNativePlayback(resolvedStreamUrl);
              } else {
                failoverToNextStream({
                  isMixedContent: isMixedContentFailure,
                  isCors: isManifestCorsBlock
                });
              }
              break;
            }
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                failoverToNextStream({
                  isMixedContent: isHttpOnHttps,
                  detail:
                    'Este sinal utiliza fluxo direto (MPEG-TS) ou formato não-HLS incompatível com o player web. Abra em nova aba ou copie o link para player externo (VLC).'
                });
              } else if (mediaRecoveryAttempts < 2) {
                mediaRecoveryAttempts += 1;
                hls.recoverMediaError();
              } else {
                failoverToNextStream({
                  isMixedContent: isHttpOnHttps
                });
              }
              break;
            default:
              failoverToNextStream({
                isMixedContent: isHttpOnHttps
              });
              break;
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native Safari / mobile HLS support (attempts both HTTPS and HTTP URLs)
        tryNativePlayback(resolvedStreamUrl);
      } else {
        clearLoadTimeout();
        setStreamStatus('unavailable');
        setErrorMsg('Seu navegador não possui suporte a streaming HLS.');
        setIsLoading(false);
      }
    },
    [channel.channelNumber, channel.name, channel.streams, clearLoadTimeout, failoverToNextStream, getActiveProxyUrl]
  );

  // Load when channel or stream index changes
  useEffect(() => {
    attemptedIndicesRef.current = new Set([0]);
    lastFailureRef.current = { isMixedContent: false, isCors: false };
    setCurrentStreamIndex(0);
    setErrorMsg(null);
    setStreamStatus('loading');
  }, [channel.id]);

  useEffect(() => {
    const targetStream = channel.streams[currentStreamIndex] || channel.streams[0];
    if (targetStream?.url) {
      loadStream(targetStream.url, currentStreamIndex);
    }

    return () => {
      clearLoadTimeout();
      if (playbackAbortRef.current) {
        playbackAbortRef.current.abort();
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel, clearLoadTimeout, currentStreamIndex, loadStream]);

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
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
    triggerUserActivity();
  };

  const handleVolumeChange = (newVol: number) => {
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
        {/* Video Element (no display lock) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full ${getAspectRatioClass()} transition-all duration-200 cursor-pointer`}
          onClick={isMiniPlayer ? scrollToMainPlayer : togglePlay}
          onWaiting={() => {
            if (videoRef.current && videoRef.current.readyState < 3) {
              setIsLoading(true);
              if (!errorMsg) setStreamStatus('loading');
            }
          }}
          onLoadedData={() => {
            setIsLoading(false);
            setErrorMsg(null);
          }}
          onCanPlay={() => {
            setIsLoading(false);
            setErrorMsg(null);
            if (videoRef.current && !videoRef.current.paused) {
              setIsPlaying(true);
              setStreamStatus('playing');
            }
          }}
          onCanPlayThrough={() => {
            setIsLoading(false);
          }}
          onTimeUpdate={() => {
            if (isLoading && videoRef.current && videoRef.current.readyState >= 3) {
              setIsLoading(false);
              if (!videoRef.current.paused) {
                setIsPlaying(true);
                setStreamStatus('playing');
              }
            }
          }}
          onPlaying={() => {
            setIsLoading(false);
            setIsPlaying(true);
            setErrorMsg(null);
            setStreamStatus('playing');
          }}
          onPause={() => {
            setIsPlaying(false);
            if (!isLoading && !errorMsg) setStreamStatus('paused');
          }}
        />

      {/* Buffering Indicator */}
      {isLoading && !errorMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] z-10 pointer-events-none">
          <div className="relative w-14 h-14">
            <div className="w-14 h-14 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-indigo-400">
              <Tv className="w-6 h-6 animate-pulse" />
            </div>
          </div>
          <span className="mt-3 text-xs font-semibold text-slate-300 tracking-wider uppercase">
            Conectando ao vivo ({currentStream?.quality || 'HD'} • Servidor {currentStreamIndex + 1}/{channel.streams.length})...
          </span>
        </div>
      )}

      {/* Stream Error Overlay with Mirror Switcher */}
      {errorMsg && (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-4 sm:p-6 text-center z-20 overflow-y-auto">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 ${
              streamStatus === 'blocked_mixed_content' || streamStatus === 'blocked_cors'
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
            }`}
          >
            {streamStatus === 'blocked_mixed_content' || streamStatus === 'blocked_cors' ? (
              <ShieldAlert className="w-6 h-6" />
            ) : (
              <RotateCcw className="w-6 h-6" />
            )}
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1.5 border ${
              streamStatus === 'blocked_mixed_content' || streamStatus === 'blocked_cors'
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {streamStatus === 'blocked_mixed_content' || streamStatus === 'blocked_cors'
              ? 'Link HTTP/CORS bloqueado'
              : 'Stream indisponível'}
          </span>
          <h4 className="text-base sm:text-lg font-bold text-white mb-1">
            {streamStatus === 'blocked_mixed_content'
              ? 'Link HTTP bloqueado em página HTTPS'
              : streamStatus === 'blocked_cors'
                ? 'Bloqueio de CORS no Servidor'
                : 'Falha na Conexão do Sinal'}
          </h4>
          <p className="text-xs text-slate-400 max-w-md mb-3">{errorMsg}</p>

          {isCorsError && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const cleaned = proxyInput.trim().replace(/[/?]+$/, '');
                try {
                  if (cleaned) {
                    localStorage.setItem('playtelas_hls_proxy', cleaned);
                  } else {
                    localStorage.removeItem('playtelas_hls_proxy');
                  }
                } catch {
                  // ignore
                }
                attemptedIndicesRef.current.clear();
                lastFailureRef.current = { isMixedContent: false, isCors: false };
                const target = channel.streams[currentStreamIndex] || channel.streams[0];
                if (target) loadStream(target.url, currentStreamIndex);
              }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full max-w-md mb-3"
            >
              <input
                type="url"
                value={proxyInput}
                onChange={(e) => setProxyInput(e.target.value)}
                placeholder="https://seu-worker.workers.dev"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer shrink-0"
              >
                Conectar via Proxy
              </button>
            </form>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg">
            {channel.streams.length > 1 && (
              <button
                onClick={() => {
                  const nextIdx = (currentStreamIndex + 1) % channel.streams.length;
                  attemptedIndicesRef.current = new Set([nextIdx]);
                  lastFailureRef.current = { isMixedContent: false, isCors: false };
                  setCurrentStreamIndex(nextIdx);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
              >
                Trocar para Link Alternativo ({((currentStreamIndex + 1) % channel.streams.length) + 1}/{channel.streams.length})
              </button>
            )}
            {channel.streams.map((str, idx) => {
              const proto = str.url.startsWith('http://') ? 'HTTP' : 'HTTPS';
              return (
                <button
                  key={idx}
                  onClick={() => {
                    attemptedIndicesRef.current = new Set([idx]);
                    lastFailureRef.current = { isMixedContent: false, isCors: false };
                    setCurrentStreamIndex(idx);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    currentStreamIndex === idx
                      ? 'bg-indigo-600/80 border-indigo-400 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Servidor {idx + 1} ({proto} • {str.quality})
                </button>
              );
            })}
            <button
              onClick={() => {
                attemptedIndicesRef.current = new Set([currentStreamIndex]);
                lastFailureRef.current = { isMixedContent: false, isCors: false };
                const target = channel.streams[currentStreamIndex] || channel.streams[0];
                if (target) loadStream(target.url, currentStreamIndex);
              }}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Tentar Novamente
            </button>
            {currentStream?.url && (
              <>
                <a
                  href={currentStream.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5 transition"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
                  Abrir Stream em Nova Aba
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(currentStream.url).then(() => {
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2500);
                      }).catch(() => {});
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Link Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Copiar Link (Player Externo)</span>
                    </>
                  )}
                </button>
              </>
            )}
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
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border hidden sm:inline-flex items-center ${
                  streamStatus === 'playing'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : streamStatus === 'loading'
                      ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                      : streamStatus === 'blocked_mixed_content' || streamStatus === 'blocked_cors'
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                        : streamStatus === 'unavailable'
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300'
                }`}
              >
                {streamStatus === 'playing'
                  ? 'Reproduzindo'
                  : streamStatus === 'loading'
                    ? 'Carregando'
                    : streamStatus === 'blocked_mixed_content' || streamStatus === 'blocked_cors'
                      ? 'Link HTTP/CORS bloqueado'
                      : streamStatus === 'unavailable'
                        ? 'Stream indisponível'
                        : 'Pausado'}
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
                onChange={(e) => {
                  const idx = parseInt(e.target.value, 10);
                  attemptedIndicesRef.current = new Set([idx]);
                  lastFailureRef.current = { isMixedContent: false, isCors: false };
                  setCurrentStreamIndex(idx);
                }}
                className="bg-slate-900/90 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer hidden sm:block"
              >
                {channel.streams.map((str, idx) => (
                  <option key={idx} value={idx}>
                    Servidor {idx + 1} ({str.url.startsWith('http://') ? 'HTTP' : 'HTTPS'} • {str.quality})
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
                    if (b > 1 && hlsRef.current) {
                      setupAudioContext();
                    }
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
