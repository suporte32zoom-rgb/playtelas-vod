import { useState, useEffect, useCallback, useRef } from 'react';
import { Channel, SmartTVDevice } from '../types/tv';

// Minimal runtime typings for browser Wi-Fi casting APIs (Google Cast, AirPlay, Remote Playback, Presentation)
interface CastMediaInfo {
  metadata?: unknown;
  streamType?: string;
}

interface CastLoadRequest {
  autoplay?: boolean;
}

interface CastSession {
  getCastDevice?: () => { friendlyName?: string; deviceId?: string };
  getMediaSession?: () => {
    play?: (req: unknown, ok?: () => void, err?: () => void) => void;
    pause?: (req: unknown, ok?: () => void, err?: () => void) => void;
    playerState?: string;
  } | null;
  loadMedia?: (request: unknown) => Promise<unknown>;
  setVolume?: (volume: number) => Promise<void>;
  setMute?: (muted: boolean) => Promise<void>;
  endSession?: (stopCasting: boolean) => void;
}

interface CastContextInstance {
  setOptions?: (opts: Record<string, unknown>) => void;
  getCastState?: () => string;
  getCurrentSession?: () => CastSession | null;
  requestSession?: () => Promise<void>;
  addEventListener?: (type: string, listener: (ev: { castState?: string; sessionState?: string }) => void) => void;
  removeEventListener?: (type: string, listener: (ev: { castState?: string; sessionState?: string }) => void) => void;
}

interface WebKitVideoElement extends HTMLVideoElement {
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
}

interface PresentationRequestLike {
  getAvailability: () => Promise<{ value: boolean; onchange: (() => void) | null }>;
  start: () => Promise<PresentationConnectionLike>;
}

interface PresentationConnectionLike {
  id: string;
  state: string;
  send: (data: string) => void;
  terminate: () => void;
  close: () => void;
  onconnect: (() => void) | null;
  onclose: (() => void) | null;
  onterminate: (() => void) | null;
}

declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    cast?: {
      framework?: {
        CastContext?: { getInstance: () => CastContextInstance };
        CastContextEventType?: {
          CAST_STATE_CHANGED: string;
          SESSION_STATE_CHANGED: string;
        };
        CastState?: {
          NO_DEVICES_AVAILABLE: string;
          NOT_CONNECTED: string;
          CONNECTING: string;
          CONNECTED: string;
        };
        SessionState?: {
          SESSION_STARTED: string;
          SESSION_RESUMED: string;
          SESSION_ENDED: string;
        };
      };
    };
    chrome?: {
      cast?: {
        AutoJoinPolicy?: { ORIGIN_SCOPED: string };
        media?: {
          DEFAULT_MEDIA_RECEIVER_APP_ID?: string;
          MediaInfo: new (contentId: string, contentType: string) => CastMediaInfo;
          LoadRequest: new (mediaInfo: CastMediaInfo) => CastLoadRequest;
          GenericMediaMetadata: new () => { title?: string; subtitle?: string };
          StreamType?: { LIVE: string };
          MetadataType?: { GENERIC: number };
        };
      };
    };
    PresentationRequest?: new (urls: string[]) => PresentationRequestLike;
  }
}

let castSdkPromise: Promise<boolean> | null = null;

function ensureGoogleCastSdk(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.cast?.framework?.CastContext && window.chrome?.cast?.media) {
    return Promise.resolve(true);
  }
  if (castSdkPromise) return castSdkPromise;

  castSdkPromise = new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(false), 5000);
    const prevCallback = window.__onGCastApiAvailable;
    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      clearTimeout(timeout);
      if (prevCallback) prevCallback(isAvailable);
      resolve(Boolean(isAvailable && window.cast?.framework?.CastContext));
    };

    const existing = document.querySelector('script[data-playtelas-cast="true"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.async = true;
      script.dataset.playtelasCast = 'true';
      script.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      document.head.appendChild(script);
    }
  });

  return castSdkPromise;
}

function getActiveVideoElement(): WebKitVideoElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector('video') as WebKitVideoElement | null;
}

function guessContentType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('.mp4')) return 'video/mp4';
  if (lower.includes('.webm')) return 'video/webm';
  if (lower.includes('.ogg')) return 'audio/ogg';
  return 'application/x-mpegurl';
}

export function useSmartTVCast() {
  // Production mode: NO pre-added / hardcoded TVs. Starts completely empty and populates ONLY real captured Wi-Fi signals.
  const [devices, setDevices] = useState<SmartTVDevice[]>([]);
  const [activeDevice, setActiveDevice] = useState<SmartTVDevice | null>(null);
  const [isCasting, setIsCasting] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [pairingCode, setPairingCode] = useState<string>('TV-8492');
  const [castStatusMessage, setCastStatusMessage] = useState<string>(
    'Aguardando detecção de Smart TV na rede Wi-Fi...'
  );

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const presentationConnectionRef = useRef<PresentationConnectionLike | null>(null);
  const presentationRequestRef = useRef<PresentationRequestLike | null>(null);
  const castSessionRef = useRef<CastSession | null>(null);
  const remoteWatchIdRef = useRef<number | null>(null);
  const activeChannelRef = useRef<Channel | undefined>(undefined);

  const upsertDevice = useCallback((incoming: SmartTVDevice) => {
    setDevices((prev) => {
      const idx = prev.findIndex((d) => d.id === incoming.id);
      if (idx === -1) return [...prev, incoming];
      const next = [...prev];
      next[idx] = { ...prev[idx], ...incoming };
      return next;
    });
  }, []);

  const removeDeviceById = useCallback((id: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const loadChannelIntoGoogleCast = useCallback(async (session: CastSession, channel?: Channel) => {
    if (!channel || !window.chrome?.cast?.media || !session.loadMedia) return;
    const stream = channel.streams.find((s) => s.url.startsWith('https://')) || channel.streams[0];
    if (!stream?.url) return;

    try {
      const mediaInfo = new window.chrome.cast.media.MediaInfo(stream.url, guessContentType(stream.url));
      const metadata = new window.chrome.cast.media.GenericMediaMetadata();
      metadata.title = `#${channel.channelNumber} ${channel.name}`;
      metadata.subtitle = channel.description;
      mediaInfo.metadata = metadata;
      if (window.chrome.cast.media.StreamType?.LIVE) {
        mediaInfo.streamType = window.chrome.cast.media.StreamType.LIVE;
      }

      const loadReq = new window.chrome.cast.media.LoadRequest(mediaInfo);
      loadReq.autoplay = true;
      await session.loadMedia(loadReq);
      setCastStatusMessage(`Transmitindo imagem e áudio de ${channel.name} na Smart TV`);
    } catch (err) {
      console.warn('[PlayTelas Wi-Fi Cast] Erro ao enviar fluxo para Google Cast:', err);
      setCastStatusMessage(
        `Conectado à TV, mas o servidor do canal recusou reprodução direta no Cast (${channel.name}).`
      );
    }
  }, []);

  // Initialize Pairing Code, BroadcastChannel (real receiver handshake), and passive Wi-Fi listeners
  useEffect(() => {
    let savedCode: string | null = null;
    try {
      savedCode = localStorage.getItem('cinelive_tv_pairing_code');
      if (!savedCode) {
        const code = 'TV-' + Math.floor(1000 + Math.random() * 9000);
        localStorage.setItem('cinelive_tv_pairing_code', code);
        savedCode = code;
      }
    } catch {
      savedCode = 'TV-8492';
    }
    setPairingCode(savedCode || 'TV-8492');

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('cinelive_smart_tv_sync');
        bc.onmessage = (event) => {
          const data = event.data;
          if (!data) return;

          if (data.type === 'RECEIVER_CONNECTED' || data.type === 'RECEIVER_PONG') {
            const dev: SmartTVDevice = {
              id: `receiver-${data.code || 'local'}`,
              name: `Tela Smart TV Web (${data.code || 'Receptor'})`,
              type: 'browser-receiver',
              transport: 'browser-receiver',
              signalSource: 'Sinal Receptor Web Ativo',
              status: data.type === 'RECEIVER_CONNECTED' ? 'connected' : 'available',
              pairingCode: data.code
            };
            upsertDevice(dev);
            if (data.type === 'RECEIVER_CONNECTED') {
              setActiveDevice(dev);
              setIsCasting(true);
              setCastStatusMessage(`Smart TV conectada via código ${data.code}`);
            }
          } else if (data.type === 'RECEIVER_DISCONNECTED') {
            removeDeviceById(`receiver-${data.code || 'local'}`);
            setIsCasting(false);
            setActiveDevice(null);
            setCastStatusMessage('Smart TV desconectada');
          }
        };
        broadcastChannelRef.current = bc;
      } catch (e) {
        console.warn('[PlayTelas Wi-Fi Cast] BroadcastChannel indisponível:', e);
      }
    }

    return () => {
      broadcastChannelRef.current?.close();
    };
  }, [removeDeviceById, upsertDevice]);

  // Real Wi-Fi signal capture scan across native browser protocols (NO fake/hardcoded TVs)
  const scanWifiDevices = useCallback(
    async (currentChannel?: Channel) => {
      activeChannelRef.current = currentChannel;
      setIsScanning(true);
      setCastStatusMessage('Escaneando sinais reais de Smart TV na rede Wi-Fi...');

      // Preserve currently connected device during rescan, clear stale unverified entries
      setDevices((prev) => prev.filter((d) => d.status === 'connected'));

      let foundAny = false;

      // 1. Ping active Web TV Receivers (only real open receivers reply)
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ type: 'PING_RECEIVER' });
      }

      // 2. Active <video> Remote Playback API (mDNS/Wi-Fi Cast/Miracast/AirPlay detection in Chrome, Edge, Safari)
      const videoEl = getActiveVideoElement();
      if (videoEl?.remote?.watchAvailability) {
        try {
          if (remoteWatchIdRef.current !== null && videoEl.remote.cancelWatchAvailability) {
            await videoEl.remote.cancelWatchAvailability(remoteWatchIdRef.current).catch(() => {});
            remoteWatchIdRef.current = null;
          }
          const id = await videoEl.remote.watchAvailability((available) => {
            if (available) {
              foundAny = true;
              const connected = videoEl.remote?.state === 'connected';
              upsertDevice({
                id: 'wifi-remote-playback',
                name: 'Smart TV detectada na Rede Wi-Fi',
                type: 'android-tv',
                transport: 'remote-playback',
                signalSource: 'Sinal Wi-Fi Direto (Imagem & Áudio)',
                status: connected ? 'connected' : 'available'
              });
            } else {
              removeDeviceById('wifi-remote-playback');
            }
          });
          remoteWatchIdRef.current = id;
        } catch {
          // Some browsers disable watchAvailability in background and only allow video.remote.prompt() on click
        }
      }

      // 3. Apple AirPlay Wi-Fi Discovery (iPhone, iPad, Mac Safari -> Apple TV / Samsung / LG / TCL / Roku AirPlay 2)
      if (videoEl && typeof videoEl.webkitShowPlaybackTargetPicker === 'function') {
        const handleAirPlayAvailability = (ev: Event & { availability?: string }) => {
          if (ev.availability === 'available') {
            foundAny = true;
            upsertDevice({
              id: 'wifi-airplay',
              name: 'Smart TV AirPlay detectada no Wi-Fi',
              type: 'apple-tv',
              transport: 'airplay',
              signalSource: 'Sinal Apple AirPlay Wi-Fi (Imagem & Áudio)',
              status: videoEl.webkitCurrentPlaybackTargetIsWireless ? 'connected' : 'available'
            });
          } else {
            removeDeviceById('wifi-airplay');
          }
        };
        videoEl.addEventListener('webkitplaybacktargetavailabilitychanged', handleAirPlayAvailability, { once: true });
      }

      // 4. Google Cast Sender Framework (real mDNS Wi-Fi discovery for Chromecast, Google TV, Android TV)
      const castReady = await ensureGoogleCastSdk();
      if (castReady && window.cast?.framework?.CastContext && window.chrome?.cast) {
        try {
          const ctx = window.cast.framework.CastContext.getInstance();
          ctx.setOptions?.({
            receiverApplicationId: window.chrome.cast.media?.DEFAULT_MEDIA_RECEIVER_APP_ID || 'CC1AD845',
            autoJoinPolicy: window.chrome.cast.AutoJoinPolicy?.ORIGIN_SCOPED || 'origin_scoped'
          });

          const castState = ctx.getCastState?.();
          const CastStates = window.cast.framework.CastState;
          if (castState && CastStates && castState !== CastStates.NO_DEVICES_AVAILABLE) {
            foundAny = true;
            const currentSession = ctx.getCurrentSession?.();
            const friendlyName =
              currentSession?.getCastDevice?.()?.friendlyName || 'Smart TV / Chromecast detectada no Wi-Fi';
            if (currentSession) {
              castSessionRef.current = currentSession;
            }
            upsertDevice({
              id: 'wifi-google-cast',
              name: friendlyName,
              type: 'chromecast',
              transport: 'google-cast',
              signalSource: 'Sinal mDNS Wi-Fi (Google Cast)',
              status: castState === CastStates.CONNECTED ? 'connected' : 'available'
            });
          }

          const EventType = window.cast.framework.CastContextEventType;
          if (EventType && ctx.addEventListener) {
            ctx.addEventListener(EventType.CAST_STATE_CHANGED, (ev) => {
              if (!CastStates) return;
              if (ev.castState === CastStates.NO_DEVICES_AVAILABLE) {
                removeDeviceById('wifi-google-cast');
              } else {
                const session = ctx.getCurrentSession?.();
                const name = session?.getCastDevice?.()?.friendlyName || 'Smart TV / Chromecast detectada no Wi-Fi';
                upsertDevice({
                  id: 'wifi-google-cast',
                  name,
                  type: 'chromecast',
                  transport: 'google-cast',
                  signalSource: 'Sinal mDNS Wi-Fi (Google Cast)',
                  status: ev.castState === CastStates.CONNECTED ? 'connected' : 'available'
                });
              }
            });
          }
        } catch (err) {
          console.warn('[PlayTelas Wi-Fi Cast] Aviso na inicialização do Google Cast:', err);
        }
      }

      // 5. W3C Presentation API Wi-Fi Display Discovery
      if (typeof window !== 'undefined' && window.PresentationRequest) {
        try {
          const receiverUrl = `${window.location.origin}${window.location.pathname}?mode=tv&room=${pairingCode}`;
          const req = new window.PresentationRequest([receiverUrl]);
          presentationRequestRef.current = req;
          const availability = await req.getAvailability();
          if (availability.value) {
            foundAny = true;
            upsertDevice({
              id: 'wifi-presentation',
              name: 'Smart TV / Display Sem Fio na Rede',
              type: 'chromecast',
              transport: 'presentation',
              signalSource: 'Sinal Wireless Display (Presentation API)',
              status: 'available'
            });
          }
          availability.onchange = () => {
            if (availability.value) {
              upsertDevice({
                id: 'wifi-presentation',
                name: 'Smart TV / Display Sem Fio na Rede',
                type: 'chromecast',
                transport: 'presentation',
                signalSource: 'Sinal Wireless Display (Presentation API)',
                status: 'available'
              });
            } else {
              removeDeviceById('wifi-presentation');
            }
          };
        } catch {
          // Presentation availability may be blocked until user gesture
        }
      }

      // 6. Real LAN HTTP/DIAL probe ONLY on local HTTP origins (avoids HTTPS Mixed Content errors)
      if (typeof window !== 'undefined' && window.location.protocol === 'http:') {
        const probeTargets = [
          { ip: window.location.hostname, port: 8008, path: '/setup/eureka_info', type: 'chromecast' as const, label: 'Google Cast / Android TV' },
          { ip: window.location.hostname, port: 8060, path: '/query/device-info', type: 'roku' as const, label: 'Roku TV' }
        ].filter((t) => t.ip && t.ip !== 'localhost' && t.ip !== '127.0.0.1');

        await Promise.allSettled(
          probeTargets.map(async (target) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 1200);
            try {
              const res = await fetch(`http://${target.ip}:${target.port}${target.path}`, {
                signal: controller.signal
              });
              if (res.ok) {
                foundAny = true;
                upsertDevice({
                  id: `lan-${target.ip}-${target.port}`,
                  name: `${target.label} (${target.ip})`,
                  type: target.type,
                  ip: target.ip,
                  transport: 'lan-dial',
                  signalSource: 'Sinal DIAL/HTTP na Rede Local',
                  status: 'available'
                });
              }
            } catch {
              // unreachable or blocked
            } finally {
              clearTimeout(timer);
            }
          })
        );
      }

      setTimeout(() => {
        setIsScanning(false);
        setDevices((current) => {
          if (current.length > 0 || foundAny) {
            setCastStatusMessage(
              `${current.length || 1} sinal(is) real(is) de Smart TV encontrado(s) no Wi-Fi.`
            );
          } else {
            setCastStatusMessage(
              'Nenhuma Smart TV anunciou sinal passivo automático. Use o botão abaixo para abrir o seletor Wi-Fi do dispositivo.'
            );
          }
          return current;
        });
      }, 900);
    },
    [pairingCode, removeDeviceById, upsertDevice]
  );

  // Connect to a real captured Smart TV device and transmit video + audio
  const connectToDevice = useCallback(
    async (device: SmartTVDevice, currentChannel?: Channel) => {
      activeChannelRef.current = currentChannel;
      const videoEl = getActiveVideoElement();

      try {
        if (device.transport === 'google-cast' && window.cast?.framework?.CastContext) {
          const ctx = window.cast.framework.CastContext.getInstance();
          setCastStatusMessage(`Conectando à Smart TV "${device.name}" via Wi-Fi...`);
          await ctx.requestSession?.();
          const session = ctx.getCurrentSession?.();
          if (session) {
            castSessionRef.current = session;
            const realName = session.getCastDevice?.()?.friendlyName || device.name;
            const connectedDev: SmartTVDevice = {
              ...device,
              name: realName,
              status: 'connected'
            };
            upsertDevice(connectedDev);
            setActiveDevice(connectedDev);
            setIsCasting(true);
            await loadChannelIntoGoogleCast(session, currentChannel);
            if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
            return;
          }
        }

        if (device.transport === 'remote-playback' && videoEl?.remote?.prompt) {
          setCastStatusMessage('Abrindo seleção da Smart TV no Wi-Fi...');
          await videoEl.remote.prompt();
          const connectedDev: SmartTVDevice = { ...device, status: 'connected' };
          upsertDevice(connectedDev);
          setActiveDevice(connectedDev);
          setIsCasting(true);
          setCastStatusMessage(`Transmitindo imagem e áudio para ${device.name}`);
          if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
          return;
        }

        if (device.transport === 'airplay' && videoEl?.webkitShowPlaybackTargetPicker) {
          setCastStatusMessage('Abrindo seletor AirPlay para escolher a Smart TV...');
          videoEl.webkitShowPlaybackTargetPicker();
          const connectedDev: SmartTVDevice = { ...device, status: 'connected' };
          upsertDevice(connectedDev);
          setActiveDevice(connectedDev);
          setIsCasting(true);
          setCastStatusMessage(`Transmitindo imagem e áudio via AirPlay`);
          return;
        }

        if (device.transport === 'presentation' && presentationRequestRef.current) {
          setCastStatusMessage('Conectando à Smart TV sem fio...');
          const conn = await presentationRequestRef.current.start();
          presentationConnectionRef.current = conn;
          const sendNow = () => {
            if (currentChannel) {
              conn.send(
                JSON.stringify({
                  type: 'CHANNEL_CHANGED',
                  channel: currentChannel,
                  streamUrl: currentChannel.streams[0]?.url
                })
              );
            }
          };
          if (conn.state === 'connected') sendNow();
          conn.onconnect = sendNow;
          conn.onclose = () => {
            setIsCasting(false);
            setActiveDevice(null);
            setCastStatusMessage('Smart TV desconectada');
          };
          const connectedDev: SmartTVDevice = { ...device, status: 'connected' };
          upsertDevice(connectedDev);
          setActiveDevice(connectedDev);
          setIsCasting(true);
          setCastStatusMessage(`Transmitindo para ${device.name}`);
          return;
        }

        if (device.transport === 'browser-receiver' && broadcastChannelRef.current) {
          const connectedDev: SmartTVDevice = { ...device, status: 'connected' };
          upsertDevice(connectedDev);
          setActiveDevice(connectedDev);
          setIsCasting(true);
          setCastStatusMessage(`Transmitindo para ${device.name}`);
          if (currentChannel) {
            broadcastChannelRef.current.postMessage({
              type: 'CHANNEL_CHANGED',
              channel: currentChannel,
              streamUrl: currentChannel.streams[0]?.url
            });
          }
          if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
          return;
        }

        setCastStatusMessage('Protocolo da TV indisponível neste navegador.');
      } catch (err) {
        console.warn('[PlayTelas Wi-Fi Cast] Conexão cancelada ou falhou:', err);
        setCastStatusMessage('Seleção de Smart TV cancelada ou nenhuma TV aceitou a conexão.');
      }
    },
    [loadChannelIntoGoogleCast, upsertDevice]
  );

  // Trigger the smartphone/browser's native OS Wi-Fi Smart TV picker directly (bypasses passive mDNS restrictions)
  const openNativeWifiPicker = useCallback(
    async (currentChannel?: Channel) => {
      activeChannelRef.current = currentChannel;
      const videoEl = getActiveVideoElement();

      // 1. Try Safari AirPlay picker (iPhone/iPad/macOS)
      if (videoEl && typeof videoEl.webkitShowPlaybackTargetPicker === 'function') {
        try {
          videoEl.webkitShowPlaybackTargetPicker();
          setCastStatusMessage('Selecione sua Smart TV AirPlay na lista do sistema.');
          return;
        } catch {
          // continue
        }
      }

      // 2. Try Google Cast SDK session picker (Android Chrome / Desktop Chrome / Edge)
      const castReady = await ensureGoogleCastSdk();
      if (castReady && window.cast?.framework?.CastContext && window.chrome?.cast) {
        try {
          const ctx = window.cast.framework.CastContext.getInstance();
          ctx.setOptions?.({
            receiverApplicationId: window.chrome.cast.media?.DEFAULT_MEDIA_RECEIVER_APP_ID || 'CC1AD845',
            autoJoinPolicy: window.chrome.cast.AutoJoinPolicy?.ORIGIN_SCOPED || 'origin_scoped'
          });
          await ctx.requestSession?.();
          const session = ctx.getCurrentSession?.();
          if (session) {
            castSessionRef.current = session;
            const realName = session.getCastDevice?.()?.friendlyName || 'Smart TV Wi-Fi (Cast)';
            const connectedDev: SmartTVDevice = {
              id: 'wifi-google-cast',
              name: realName,
              type: 'chromecast',
              transport: 'google-cast',
              signalSource: 'Sinal mDNS Wi-Fi (Google Cast)',
              status: 'connected'
            };
            upsertDevice(connectedDev);
            setActiveDevice(connectedDev);
            setIsCasting(true);
            await loadChannelIntoGoogleCast(session, currentChannel);
            return;
          }
        } catch {
          // User cancelled or Cast not available; fallback to Remote Playback / Presentation
        }
      }

      // 3. Try W3C Remote Playback API picker (passes active <video> image + audio over Wi-Fi)
      if (videoEl?.remote?.prompt) {
        try {
          await videoEl.remote.prompt();
          const connectedDev: SmartTVDevice = {
            id: 'wifi-remote-playback',
            name: 'Smart TV Conectada (Wi-Fi)',
            type: 'android-tv',
            transport: 'remote-playback',
            signalSource: 'Sinal Wi-Fi Direto (Imagem & Áudio)',
            status: 'connected'
          };
          upsertDevice(connectedDev);
          setActiveDevice(connectedDev);
          setIsCasting(true);
          setCastStatusMessage('Imagem e áudio sendo transmitidos para a Smart TV escolhida.');
          return;
        } catch {
          // continue
        }
      }

      // 4. Try W3C Presentation API
      if (typeof window !== 'undefined' && window.PresentationRequest) {
        try {
          const receiverUrl = `${window.location.origin}${window.location.pathname}?mode=tv&room=${pairingCode}`;
          const req = new window.PresentationRequest([receiverUrl]);
          presentationRequestRef.current = req;
          const conn = await req.start();
          presentationConnectionRef.current = conn;
          if (currentChannel) {
            conn.send(
              JSON.stringify({
                type: 'CHANNEL_CHANGED',
                channel: currentChannel,
                streamUrl: currentChannel.streams[0]?.url
              })
            );
          }
          const connectedDev: SmartTVDevice = {
            id: 'wifi-presentation',
            name: 'Smart TV Sem Fio Conectada',
            type: 'chromecast',
            transport: 'presentation',
            signalSource: 'Sinal Wireless Display (Presentation API)',
            status: 'connected'
          };
          upsertDevice(connectedDev);
          setActiveDevice(connectedDev);
          setIsCasting(true);
          setCastStatusMessage('Transmissão sem fio ativa na Smart TV escolhida.');
          return;
        } catch {
          // cancelled
        }
      }

      setCastStatusMessage(
        'Seu navegador atual não disponibilizou seletor nativo de Smart TV Wi-Fi. Verifique se o celular e a TV estão no mesmo Wi-Fi ou use o Modo Receptor da TV.'
      );
    },
    [loadChannelIntoGoogleCast, pairingCode, upsertDevice]
  );

  const disconnectCast = useCallback(() => {
    if (castSessionRef.current?.endSession) {
      try {
        castSessionRef.current.endSession(true);
      } catch {
        // ignore
      }
      castSessionRef.current = null;
    }
    if (presentationConnectionRef.current) {
      try {
        presentationConnectionRef.current.terminate();
      } catch {
        // ignore
      }
      presentationConnectionRef.current = null;
    }
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'STOP_CAST' });
    }
    setDevices((prev) => prev.map((d) => ({ ...d, status: 'available' })));
    setIsCasting(false);
    setActiveDevice(null);
    setCastStatusMessage('Transmissão encerrada');
  }, []);

  const sendRemoteCommandToTV = useCallback((command: string, payload?: unknown) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'REMOTE_COMMAND',
        command,
        payload
      });
    }
    if (presentationConnectionRef.current?.state === 'connected') {
      try {
        presentationConnectionRef.current.send(
          JSON.stringify({ type: 'REMOTE_COMMAND', command, payload })
        );
      } catch {
        // ignore
      }
    }
    const mediaSession = castSessionRef.current?.getMediaSession?.();
    if (mediaSession) {
      if ((command === 'OK' || command === 'POWER') && mediaSession.playerState === 'PLAYING') {
        mediaSession.pause?.({});
      } else if (command === 'OK' || command === 'POWER') {
        mediaSession.play?.({});
      }
    }
  }, []);

  const broadcastChannelChange = useCallback(
    (channel: Channel) => {
      activeChannelRef.current = channel;
      if (!isCasting) return;

      if (castSessionRef.current) {
        loadChannelIntoGoogleCast(castSessionRef.current, channel);
      }
      if (presentationConnectionRef.current?.state === 'connected') {
        try {
          presentationConnectionRef.current.send(
            JSON.stringify({
              type: 'CHANNEL_CHANGED',
              channel,
              streamUrl: channel.streams[0]?.url
            })
          );
        } catch {
          // ignore
        }
      }
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({
          type: 'CHANNEL_CHANGED',
          channel,
          streamUrl: channel.streams[0]?.url
        });
      }
    },
    [isCasting, loadChannelIntoGoogleCast]
  );

  return {
    devices,
    activeDevice,
    isCasting,
    isScanning,
    pairingCode,
    castStatusMessage,
    scanWifiDevices,
    openNativeWifiPicker,
    connectToDevice,
    disconnectCast,
    sendRemoteCommandToTV,
    broadcastChannelChange,
    setPairingCode
  };
}
