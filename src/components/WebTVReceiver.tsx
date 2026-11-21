import React, { useEffect, useState, useRef } from 'react';
import Hls from 'hls.js';
import { Tv, Radio, ArrowLeft, Volume2, VolumeX, Cast } from 'lucide-react';
import { Channel } from '../types/tv';
import { CHANNELS, getCurrentProgram } from '../data/channels';

export const WebTVReceiver: React.FC<{ onExit: () => void; initialRoom?: string }> = ({
  onExit,
  initialRoom
}) => {
  const [currentChannel, setCurrentChannel] = useState<Channel>(CHANNELS[0]);
  const [roomCode, setRoomCode] = useState<string>(initialRoom || 'TV-8492');
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [remoteMessage, setRemoteMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // BroadcastChannel & Presentation Receiver listener
  useEffect(() => {
    const handleIncomingMessage = (data: { type?: string; channel?: Channel; command?: string; payload?: unknown }) => {
      if (!data) return;
      if (data.type === 'CHANNEL_CHANGED' && data.channel) {
        setCurrentChannel(data.channel);
        showFeedback(`Canal alterado: ${data.channel.name}`);
      } else if (data.type === 'REMOTE_COMMAND' && data.command) {
        handleRemoteCommand(data.command, data.payload);
      } else if (data.type === 'STOP_CAST') {
        showFeedback('Transmissão pausada');
      }
    };

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('cinelive_smart_tv_sync');
      bc.postMessage({ type: 'RECEIVER_CONNECTED', code: roomCode });

      bc.onmessage = (event) => {
        const data = event.data;
        if (!data) return;
        if (data.type === 'PING_RECEIVER') {
          bc?.postMessage({ type: 'RECEIVER_PONG', code: roomCode });
          return;
        }
        handleIncomingMessage(data);
      };
    }

    const navPres = (navigator as unknown as {
      presentation?: {
        receiver?: {
          connectionList: Promise<{
            connections: Array<{ addEventListener: (ev: string, cb: (e: { data: string }) => void) => void }>;
            addEventListener: (ev: string, cb: (e: { connection: { addEventListener: (ev: string, cb: (e: { data: string }) => void) => void } }) => void) => void;
          }>;
        };
      };
    }).presentation?.receiver;

    if (navPres?.connectionList) {
      navPres.connectionList
        .then((list) => {
          const bindConn = (conn: { addEventListener: (ev: string, cb: (e: { data: string }) => void) => void }) => {
            conn.addEventListener('message', (ev) => {
              try {
                handleIncomingMessage(JSON.parse(ev.data));
              } catch {
                // ignore malformed message
              }
            });
          };
          list.connections.forEach(bindConn);
          list.addEventListener('connectionavailable', (ev) => bindConn(ev.connection));
        })
        .catch(() => {});
    }

    return () => {
      if (bc) {
        bc.postMessage({ type: 'RECEIVER_DISCONNECTED', code: roomCode });
        bc.close();
      }
    };
  }, [roomCode]);

  const showFeedback = (msg: string) => {
    setRemoteMessage(msg);
    setShowOverlay(true);
    setTimeout(() => {
      setRemoteMessage(null);
    }, 3500);
  };

  const handleRemoteCommand = (cmd: string, payload?: unknown) => {
    switch (cmd) {
      case 'CH_UP':
      case 'UP': {
        const nextIdx = (CHANNELS.findIndex((c) => c.id === currentChannel.id) + 1) % CHANNELS.length;
        setCurrentChannel(CHANNELS[nextIdx]);
        showFeedback(`Canal ${CHANNELS[nextIdx].channelNumber} - ${CHANNELS[nextIdx].name}`);
        break;
      }
      case 'CH_DOWN':
      case 'DOWN': {
        const prevIdx = (CHANNELS.findIndex((c) => c.id === currentChannel.id) - 1 + CHANNELS.length) % CHANNELS.length;
        setCurrentChannel(CHANNELS[prevIdx]);
        showFeedback(`Canal ${CHANNELS[prevIdx].channelNumber} - ${CHANNELS[prevIdx].name}`);
        break;
      }
      case 'VOL_UP':
        if (videoRef.current) {
          const newVol = Math.min(1, videoRef.current.volume + 0.1);
          videoRef.current.volume = newVol;
          setVolume(newVol);
          showFeedback(`Volume: ${Math.round(newVol * 100)}%`);
        }
        break;
      case 'VOL_DOWN':
        if (videoRef.current) {
          const newVol = Math.max(0, videoRef.current.volume - 0.1);
          videoRef.current.volume = newVol;
          setVolume(newVol);
          showFeedback(`Volume: ${Math.round(newVol * 100)}%`);
        }
        break;
      case 'MUTE':
        if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted;
          setIsMuted(videoRef.current.muted);
          showFeedback(videoRef.current.muted ? 'Mudo' : 'Som Ativado');
        }
        break;
      case 'POWER':
      case 'OK':
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play();
            showFeedback('Reproduzindo');
          } else {
            videoRef.current.pause();
            showFeedback('Pausado');
          }
        }
        break;
      case 'DIGIT_PRESSED':
        showFeedback(`Sintonizando canal #${payload}...`);
        break;
      default:
        break;
    }
  };

  // Play current stream (HLS and direct MP4/WebM/OGG with video + audio)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const stream = currentChannel.streams[0];
    if (!stream?.url) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const lower = stream.url.toLowerCase();
    const isDirect =
      lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.ogg');

    if (isDirect) {
      video.src = stream.url;
      video.play().catch(() => {});
    } else if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(stream.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = stream.url;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentChannel]);

  const prog = getCurrentProgram(currentChannel);

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Video Fullscreen */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        className="w-full h-full object-contain"
        onClick={() => setShowOverlay(!showOverlay)}
      />

      {/* Top Banner on TV screen */}
      <div
        className={`absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 ${
          showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onExit}
            className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-700 text-white hover:bg-slate-800 transition cursor-pointer flex items-center gap-2 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao App Normal</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xl font-black text-indigo-400 bg-black/60 px-3 py-1 rounded-xl border border-slate-800">
              CH #{currentChannel.channelNumber.toString().padStart(3, '0')}
            </span>
            <div>
              <h1 className="text-2xl font-black text-white drop-shadow-lg">
                {currentChannel.name}
              </h1>
              <p className="text-sm text-slate-300 font-medium">
                {prog.title} ({prog.startTime} - {prog.endTime})
              </p>
            </div>
          </div>
        </div>

        {/* Pairing Code Badge for Big Screen */}
        <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 px-4 py-2 rounded-2xl backdrop-blur-md">
          <Cast className="w-5 h-5 text-emerald-400 animate-pulse" />
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">
              Receptor Pareado
            </span>
            <span className="text-base font-mono font-bold text-emerald-400">
              {roomCode}
            </span>
          </div>
        </div>
      </div>

      {/* Remote Feedback Center HUD (like real Samsung/LG TVs) */}
      {remoteMessage && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-8 py-4 rounded-3xl bg-slate-950/90 border border-indigo-500/50 shadow-2xl backdrop-blur-xl text-center pointer-events-none animate-in zoom-in-95 duration-150">
          <p className="text-xl font-black text-white">{remoteMessage}</p>
        </div>
      )}
    </div>
  );
};
