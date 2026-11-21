import React, { useEffect, useRef, useState } from 'react';
import {
  Cast,
  Tv,
  CheckCircle2,
  Copy,
  ExternalLink,
  X,
  QrCode,
  Wifi,
  Share2,
  RefreshCw,
  Radio
} from 'lucide-react';
import { Channel, SmartTVDevice } from '../types/tv';

interface SmartTVCastModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
  devices: SmartTVDevice[];
  activeDevice: SmartTVDevice | null;
  isScanning: boolean;
  castStatusMessage: string;
  pairingCode: string;
  onScanWifi: () => void;
  onOpenNativePicker: () => void;
  onConnectDevice: (device: SmartTVDevice) => void;
  onDisconnectCast: () => void;
}

export const SmartTVCastModal: React.FC<SmartTVCastModalProps> = ({
  isOpen,
  onClose,
  channel,
  devices,
  activeDevice,
  isScanning,
  castStatusMessage,
  pairingCode,
  onScanWifi,
  onOpenNativePicker,
  onConnectDevice,
  onDisconnectCast
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'devices' | 'pairing' | 'm3u8'>('devices');
  const onScanWifiRef = useRef(onScanWifi);
  onScanWifiRef.current = onScanWifi;

  useEffect(() => {
    if (isOpen && activeTab === 'devices') {
      onScanWifiRef.current();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const currentStream = channel.streams[0];
  const receiverUrl = `${window.location.origin}${window.location.pathname}?mode=tv&room=${pairingCode}`;

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }).catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700/80 p-6 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Cast className={`w-5 h-5 ${isScanning ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Espelhar para Smart TV (Wi-Fi)
              </h3>
              <p className="text-xs text-slate-400">
                Canal atual: <span className="text-indigo-300 font-semibold">{channel.name}</span>
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-4 mb-3 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('devices')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'devices' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Smart TVs Wi-Fi ({devices.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('pairing')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'pairing' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Navegador da TV</span>
          </button>
          <button
            onClick={() => setActiveTab('m3u8')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'm3u8' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Link Direto</span>
          </button>
        </div>

        {/* Tab 1: Real Wi-Fi Smart TV Signal Capture */}
        {activeTab === 'devices' && (
          <div className="space-y-3 overflow-y-auto pr-1 my-2">
            {activeDevice && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{activeDevice.name}</h4>
                    <span className="text-xs text-emerald-400 font-medium block truncate">
                      Transmitindo imagem e áudio em tempo real
                    </span>
                  </div>
                </div>
                <button
                  onClick={onDisconnectCast}
                  className="px-3 py-1.5 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-300 text-xs font-semibold hover:bg-rose-600/30 transition cursor-pointer shrink-0 ml-2"
                >
                  Desconectar
                </button>
              </div>
            )}

            {/* Scan Toolbar & Status */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Radio className={`w-4 h-4 shrink-0 ${isScanning ? 'text-indigo-400 animate-pulse' : 'text-slate-400'}`} />
                <span className="text-xs text-slate-300 leading-snug">{castStatusMessage}</span>
              </div>
              <button
                onClick={onScanWifi}
                disabled={isScanning}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 shrink-0 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-indigo-400' : ''}`} />
                <span>{isScanning ? 'Buscando...' : 'Atualizar'}</span>
              </button>
            </div>

            {/* Real Detected TVs Only (Zero pre-added models) */}
            {devices.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-400 px-1">
                  Smart TV(s) capturada(s) pelo sinal real na rede Wi-Fi:
                </p>
                {devices.map((device) => {
                  const isSelected = activeDevice?.id === device.id;
                  return (
                    <div
                      key={device.id}
                      onClick={() => onConnectDevice(device)}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between group active:scale-[0.98] ${
                        isSelected
                          ? 'bg-indigo-600/20 border-indigo-500/60 shadow-lg'
                          : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400 shrink-0">
                          <Tv className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition truncate">
                            {device.name}
                          </h4>
                          <p className="text-xs text-slate-400 truncate">
                            {device.signalSource || device.type}
                            {device.ip ? ` • ${device.ip}` : ''}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition shrink-0 ml-2 ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-indigo-600/80 text-white group-hover:bg-indigo-500'
                        }`}
                      >
                        {isSelected ? 'Conectado' : 'Conectar TV'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                  <Wifi className={`w-6 h-6 ${isScanning ? 'animate-pulse text-indigo-400' : ''}`} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">
                    {isScanning ? 'Capturando sinais na rede Wi-Fi...' : 'Nenhuma Smart TV detectada automaticamente'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Para proteger a privacidade da rede local, o navegador só exibe as Smart TVs da sua rede Wi-Fi quando você abre o seletor nativo do celular abaixo.
                  </p>
                </div>
              </div>
            )}

            {/* Direct Native OS / Browser Wi-Fi Smart TV Picker Button */}
            <button
              type="button"
              onClick={onOpenNativePicker}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:brightness-110 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.99]"
            >
              <Cast className="w-4 h-4" />
              <span>Buscar e Escolher Smart TV Real no Wi-Fi</span>
            </button>

            <p className="text-[11px] text-slate-500 text-center px-2 leading-relaxed">
              Certifique-se de que o smartphone e a Smart TV estão na mesma rede Wi-Fi (Android/Chrome usa Google Cast/Remote Playback; iPhone/iPad Safari usa AirPlay).
            </p>
          </div>
        )}

        {/* Tab 2: Pairing Code & Web Receiver */}
        {activeTab === 'pairing' && (
          <div className="flex flex-col items-center justify-center py-4 space-y-4 text-center overflow-y-auto">
            <div className="p-4 rounded-3xl bg-slate-950 border border-slate-800 flex flex-col items-center">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
                Código do Modo Receptor na TV
              </span>
              <div className="text-4xl font-mono font-extrabold tracking-widest text-indigo-400 bg-indigo-500/10 px-6 py-2.5 rounded-2xl border border-indigo-500/20">
                {pairingCode}
              </div>
            </div>

            <div className="max-w-sm space-y-2 text-xs text-slate-300">
              <p>
                1. No navegador da sua Smart TV (Samsung Tizen, LG webOS, Android TV ou Roku), acesse o endereço abaixo.
              </p>
              <p>
                2. O receptor receberá automaticamente imagem e áudio do canal sintonizado nesta sessão.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => copyToClipboard(receiverUrl)}
                className="flex items-center gap-2 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 text-xs font-semibold text-white transition cursor-pointer"
              >
                {copiedLink ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link da TV'}</span>
              </button>
              <a
                href={receiverUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Abrir Modo Receptor</span>
              </a>
            </div>
          </div>
        )}

        {/* Tab 3: Direct M3U8 Stream Link */}
        {activeTab === 'm3u8' && (
          <div className="space-y-4 py-2 overflow-y-auto">
            <p className="text-xs text-slate-400">
              Você pode copiar a URL direta do fluxo para abrir em players nativos da Smart TV (VLC, IPTV Smarters, SS IPTV ou Kodi):
            </p>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
              <input
                type="text"
                readOnly
                value={currentStream?.url || ''}
                className="w-full bg-transparent text-xs font-mono text-slate-300 outline-none truncate"
              />
              <button
                onClick={() => copyToClipboard(currentStream?.url || '')}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition cursor-pointer"
              >
                {copiedLink ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 text-xs text-slate-300 space-y-1.5">
              <div className="font-semibold text-white">Especificações do Sinal:</div>
              <p>• Resolução: {currentStream?.quality || 'HD'}</p>
              <p>• Áudio e Vídeo: Stream original sincronizado</p>
              <p>• Protocolo: {currentStream?.url?.startsWith('http://') ? 'HTTP' : 'HTTPS'}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
