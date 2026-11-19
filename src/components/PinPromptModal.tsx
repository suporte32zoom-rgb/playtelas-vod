import React, { useState, useEffect } from 'react';
import { Lock, X, AlertCircle } from 'lucide-react';

interface PinPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: string;
  onVerify: (pin: string) => boolean;
}

export const PinPromptModal: React.FC<PinPromptModalProps> = ({
  isOpen,
  onClose,
  reason,
  onVerify
}) => {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setError(null);

    if (nextPin.length === 4) {
      const valid = onVerify(nextPin);
      if (!valid) {
        setError('PIN incorreto. Tente novamente.');
        setTimeout(() => setPin(''), 600);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xs rounded-3xl bg-slate-900 border border-slate-700/80 p-6 shadow-2xl text-slate-100 flex flex-col items-center text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3 mt-1">
          <Lock className="w-7 h-7" />
        </div>

        <h3 className="text-base font-bold text-white mb-1">Digite o PIN Parental</h3>
        <p className="text-xs text-slate-400 mb-5">{reason || 'Autorização de 4 dígitos necessária'}</p>

        {/* 4 Dots PIN Display */}
        <div className="flex items-center gap-3.5 mb-4">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                  isFilled
                    ? 'bg-indigo-500 border-indigo-400 scale-110 shadow-lg shadow-indigo-500/50'
                    : 'border-slate-600 bg-slate-800/60'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 mb-3 animate-shake">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 3x4 Numeric Keypad */}
        <div className="w-full grid grid-cols-3 gap-2.5 my-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              className="h-12 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:bg-indigo-600 active:text-white border border-slate-700/60 font-mono text-lg font-bold text-slate-200 transition active:scale-95 flex items-center justify-center cursor-pointer shadow"
            >
              {digit}
            </button>
          ))}
          <button
            onClick={() => setPin('')}
            className="h-12 rounded-2xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 text-xs font-semibold text-slate-400 hover:text-white transition active:scale-95 flex items-center justify-center cursor-pointer"
          >
            Limpar
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="h-12 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:bg-indigo-600 active:text-white border border-slate-700/60 font-mono text-lg font-bold text-slate-200 transition active:scale-95 flex items-center justify-center cursor-pointer shadow"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="h-12 rounded-2xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 text-xs font-semibold text-slate-400 hover:text-white transition active:scale-95 flex items-center justify-center cursor-pointer"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
};
