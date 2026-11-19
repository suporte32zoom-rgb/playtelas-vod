import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'banner' | 'icon' }> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Suppress if already running in standalone mode
  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    if (variant === 'icon') {
      return (
        <button
          onClick={install}
          title="Instalar App PWA"
          aria-label="Instalar App PWA"
          className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 hover:border-indigo-500/50 transition flex items-center justify-center cursor-pointer"
        >
          <Download className="w-4 h-4" />
        </button>
      );
    }

    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-violet-500 transition cursor-pointer active:scale-95"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Instalar no iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-sm">
                    TV
                  </div>
                  <h3 className="text-base font-semibold text-white">Instalar no iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-800/50">
                  <Share2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <p>
                    1. Toque no botão de <strong>Compartilhar</strong> na barra de navegação do Safari.
                  </p>
                </div>
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-800/50">
                  <PlusSquare className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <p>
                    2. Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
