import React, { useState } from 'react';
import {
  Cast,
  Tv,
  CheckCircle2,
  Copy,
  ExternalLink,
  X,
  QrCode,
  Smartphone,
  Wifi,
  Share2
} from 'lucide-react';
import { Channel, SmartTVDevice } from '../types/tv';

interface SmartTVCastModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
  devices: SmartTVDevice[];
  activeDevice: SmartTVDevice | null;
  pairingCode: string;
  onConnectDevice: (device: SmartTVDevice) => void;
  onDisconnectCast: () => void;
}

export const SmartTVCastModal: React.FC<SmartTVCastModalProps> = ({
  isOpen,
  onClose,
  channel,
  devices,
  activeDevice,
  pairingCode,
  onConnectDevice,
  onDisconnectCast
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'devices' | 'pairing' | 'm3u8'>('devices');

  if (!isOpen) return null;

  const currentStream = channel.streams[0];
  const receiverUrl = `${window.location.origin}${window.location.pathname}?mode=tv&room=${pairingCode}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700/80 p-6 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Cast className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Enviar para Smart TV
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
            <span>Dispositivos ({devices.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('pairing')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'pairing' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Código de Pareamento</span>
          </button>
          <button
            onClick={() => setActiveTab('m3u8')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'm3u8' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Link M3U8 / DLNA</span>
          </button>
        </div>

        {/* Tab 1: Discovered Smart TVs */}
        {activeTab === 'devices' && (
          <div className="space-y-2 overflow-y-auto pr-1 my-2">
            {activeDevice && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                  <div>
                    <h4 className="text-sm font-bold text-white">{activeDevice.name}</h4>
                    <span className="text-xs text-emerald-400 font-medium">Transmitindo em tempo real</span>
                  </div>
                </div>
                <button
                  onClick={onDisconnectCast}
                  className="px-3 py-1.5 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-300 text-xs font-semibold hover:bg-rose-600/30 transition cursor-pointer"
                >
                  Desconectar
                </button>
              </div>
            )}

            <p className="text-xs text-slate-400 px-1 mb-2">
              Selecione uma Smart TV detectada na mesma rede Wi-Fi:
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
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-indigo-400 transition">
                      <Tv className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition">
                        {device.name}
                      </h4>
                      <p className="text-xs text-slate-400 capitalize">
                        {device.type.replace('-', ' ')} • {device.ip}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-slate-200 group-hover:bg-indigo-600 group-hover:text-white'
                    }`}
                  >
                    {isSelected ? 'Conectado' : 'Conectar'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Pairing Code & Web Receiver */}
        {activeTab === 'pairing' && (
          <div className="flex flex-col items-center justify-center py-4 space-y-4 text-center overflow-y-auto">
            <div className="p-4 rounded-3xl bg-slate-950 border border-slate-800 flex flex-col items-center">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
                Código de Pareamento da TV
              </span>
              <div className="text-4xl font-mono font-extrabold tracking-widest text-indigo-400 bg-indigo-500/10 px-6 py-2.5 rounded-2xl border border-indigo-500/20">
                {pairingCode}
              </div>
            </div>

            <div className="max-w-sm space-y-2 text-xs text-slate-300">
              <p>
                1. No navegador da sua Smart TV (Samsung, LG, Android TV ou Roku), acesse o aplicativo.
              </p>
              <p>
                2. Clique em <strong>"Modo Tela de TV (Receptor)"</strong> ou digite o código acima.
              </p>
              <p>
                3. A TV passará a exibir o canal sintonizado e responderá ao controle remoto virtual deste celular!
              </p>
            </div>

            <a
              href={receiverUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Testar Modo Receptor em Nova Aba</span>
            </a>
          </div>
        )}

        {/* Tab 3: Direct M3U8 Stream Link */}
        {activeTab === 'm3u8' && (
          <div className="space-y-4 py-2 overflow-y-auto">
            <p className="text-xs text-slate-400">
              Você pode copiar a URL direta do fluxo m3u8 para reproduzir em reprodutores de Smart TV como IPTV Smarters, SS IPTV, VLC ou Kodi:
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
              <p>• Formato: Apple HLS (HTTP Live Streaming - m3u8)</p>
              <p>• Protocolo: HTTPS / HTTP Adaptativo</p>
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
