import { useState, useEffect, useCallback, useRef } from 'react';
import { Channel, SmartTVDevice } from '../types/tv';

const DEFAULT_DEVICES: SmartTVDevice[] = [
  { id: 'dev-1', name: 'Samsung Crystal UHD 65" (Sala)', type: 'samsung-tizen', ip: '192.168.1.104', status: 'available' },
  { id: 'dev-2', name: 'LG OLED evo C3 55" (Quarto)', type: 'lg-webos', ip: '192.168.1.112', status: 'available' },
  { id: 'dev-3', name: 'Chromecast com Google TV 4K', type: 'chromecast', ip: '192.168.1.115', status: 'available' },
  { id: 'dev-4', name: 'Apple TV 4K (Living Room)', type: 'apple-tv', ip: '192.168.1.120', status: 'available' },
  { id: 'dev-5', name: 'TCL Android TV 50"', type: 'android-tv', ip: '192.168.1.130', status: 'available' },
  { id: 'dev-6', name: 'Roku Express 4K', type: 'roku', ip: '192.168.1.140', status: 'available' },
];

export function useSmartTVCast() {
  const [devices, setDevices] = useState<SmartTVDevice[]>(DEFAULT_DEVICES);
  const [activeDevice, setActiveDevice] = useState<SmartTVDevice | null>(null);
  const [isCasting, setIsCasting] = useState<boolean>(false);
  const [pairingCode, setPairingCode] = useState<string>('TV-8492');
  const [castStatusMessage, setCastStatusMessage] = useState<string>('');
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Generate a random pairing code on mount or load existing
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

    // Initialize BroadcastChannel for local cross-tab / Smart TV receiver sync
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('cinelive_smart_tv_sync');
        bc.onmessage = (event) => {
          if (event.data?.type === 'RECEIVER_CONNECTED') {
            setCastStatusMessage(`Smart TV conectada via código ${event.data.code}`);
            setIsCasting(true);
            setActiveDevice({
              id: 'dev-receiver',
              name: 'Smart TV Web Receiver (' + event.data.code + ')',
              type: 'browser-receiver',
              status: 'connected',
              pairingCode: event.data.code
            });
          } else if (event.data?.type === 'RECEIVER_DISCONNECTED') {
            setIsCasting(false);
            setActiveDevice(null);
            setCastStatusMessage('Smart TV desconectada');
          }
        };
        broadcastChannelRef.current = bc;
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }

    return () => {
      broadcastChannelRef.current?.close();
    };
  }, []);

  const connectToDevice = useCallback((device: SmartTVDevice, currentChannel?: Channel) => {
    setActiveDevice({ ...device, status: 'connected' });
    setIsCasting(true);
    setCastStatusMessage(`Transmitindo para ${device.name}`);
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);

    // Broadcast channel switch to receiver
    if (broadcastChannelRef.current && currentChannel) {
      broadcastChannelRef.current.postMessage({
        type: 'CHANNEL_CHANGED',
        channel: currentChannel,
        streamUrl: currentChannel.streams[0]?.url
      });
    }
  }, []);

  const disconnectCast = useCallback(() => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'STOP_CAST' });
    }
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
  }, []);

  const broadcastChannelChange = useCallback((channel: Channel) => {
    if (broadcastChannelRef.current && isCasting) {
      broadcastChannelRef.current.postMessage({
        type: 'CHANNEL_CHANGED',
        channel,
        streamUrl: channel.streams[0]?.url
      });
    }
  }, [isCasting]);

  return {
    devices,
    activeDevice,
    isCasting,
    pairingCode,
    castStatusMessage,
    connectToDevice,
    disconnectCast,
    sendRemoteCommandToTV,
    broadcastChannelChange,
    setPairingCode
  };
}
