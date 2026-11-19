import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600/90 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-white shadow-xl shadow-amber-950/40 border border-amber-400/30 animate-pulse">
      <WifiOff className="w-4 h-4 shrink-0 text-amber-200" />
      <span>Modo Offline — Catálogo e Guia salvos em cache.</span>
    </div>
  );
};
