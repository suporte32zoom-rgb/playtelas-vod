import { useState, useEffect, useCallback } from 'react';
import { Channel, ParentalControlSettings, UserProfileType } from '../types/tv';

const STORAGE_KEY = 'cinelive_parental_settings';

const DEFAULT_SETTINGS: ParentalControlSettings = {
  pin: '1234',
  isPinSet: true,
  activeProfile: 'adulto',
  kidsModeActive: false,
  lockedChannelIds: [],
  maxRatingKids: 0 // 0 means 'Livre' only
};

export function useParentalControl() {
  const [settings, setSettings] = useState<ParentalControlSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          activeProfile: 'adulto',
          kidsModeActive: false,
          lockedChannelIds: []
        };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinPromptReason, setPinPromptReason] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  const verifyPin = useCallback((enteredPin: string): boolean => {
    return enteredPin === settings.pin;
  }, [settings.pin]);

  const changePin = useCallback((currentPin: string, newPin: string): { success: boolean; message: string } => {
    if (currentPin !== settings.pin) {
      return { success: false, message: 'PIN atual incorreto.' };
    }
    if (!/^\d{4}$/.test(newPin)) {
      return { success: false, message: 'O novo PIN deve conter exatamente 4 dígitos.' };
    }
    setSettings((prev) => ({ ...prev, pin: newPin }));
    return { success: true, message: 'PIN atualizado com sucesso!' };
  }, [settings.pin]);

  const setProfile = useCallback((profile: UserProfileType, _onPinRequired?: () => void) => {
    setSettings((prev) => ({
      ...prev,
      activeProfile: profile,
      kidsModeActive: false
    }));
  }, []);

  const toggleChannelLock = useCallback((_channelId: string) => {
    setSettings((prev) => ({ ...prev, lockedChannelIds: [] }));
  }, []);

  const isChannelAllowed = useCallback((_channel: Channel): boolean => {
    return true;
  }, []);

  const isChannelLocked = useCallback((_channel: Channel): boolean => {
    return false;
  }, []);

  const promptPin = useCallback((reason: string, onSuccess: () => void) => {
    setPinPromptReason(reason);
    setPendingAction(() => onSuccess);
    setIsPinModalOpen(true);
  }, []);

  const resolvePinPrompt = useCallback((enteredPin: string): boolean => {
    if (verifyPin(enteredPin)) {
      setIsPinModalOpen(false);
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
      return true;
    }
    return false;
  }, [verifyPin, pendingAction]);

  const closePinModal = useCallback(() => {
    setIsPinModalOpen(false);
    setPendingAction(null);
  }, []);

  return {
    settings,
    verifyPin,
    changePin,
    setProfile,
    toggleChannelLock,
    isChannelAllowed,
    isChannelLocked,
    isPinModalOpen,
    pinPromptReason,
    promptPin,
    resolvePinPrompt,
    closePinModal
  };
}
