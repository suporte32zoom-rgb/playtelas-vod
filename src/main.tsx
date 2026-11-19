import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RootErrorBoundary caught error:', error, errorInfo);
  }

  handleReload = async () => {
    try {
      localStorage.removeItem('cinelive_last_channel');
    } catch {
      // ignore
    }
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-6 text-center"
          style={{
            minHeight: '100vh',
            backgroundColor: '#090d16',
            color: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl"
            style={{
              maxWidth: '420px',
              width: '100%',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid #1e293b',
              borderRadius: '24px',
              padding: '32px',
            }}
          >
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-4">
              <svg className="w-8 h-8" style={{ width: '32px', height: '32px', color: '#fb7185' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2" style={{ color: '#ffffff', fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
              Ops! Ocorreu um problema
            </h2>
            <p className="text-xs text-slate-400 mb-6" style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '16px' }}>
              Houve uma instabilidade temporária ao carregar a interface. Clique abaixo para limpar o cache e reiniciar o PlayTelas.
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] font-mono text-rose-300/80 bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 mb-5 break-words" style={{ fontSize: '0.72rem', color: '#fda4af', marginBottom: '20px', wordBreak: 'break-word' }}>
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReload}
              className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition cursor-pointer active:scale-95"
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '12px',
                background: 'linear-gradient(to right, #4f46e5, #e11d48)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.875rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Limpar Cache e Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  );
}
