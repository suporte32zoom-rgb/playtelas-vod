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
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
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

  const setProfile = useCallback((profile: UserProfileType, onPinRequired?: () => void) => {
    if (settings.activeProfile === 'kids' && profile !== 'kids') {
      // Leaving Kids profile requires PIN
      if (onPinRequired) {
        onPinRequired();
      }
      return;
    }

    setSettings((prev) => ({
      ...prev,
      activeProfile: profile,
      kidsModeActive: profile === 'kids'
    }));
  }, [settings.activeProfile]);

  const toggleChannelLock = useCallback((channelId: string) => {
    setSettings((prev) => {
      const exists = prev.lockedChannelIds.includes(channelId);
      const updated = exists
        ? prev.lockedChannelIds.filter((id) => id !== channelId)
        : [...prev.lockedChannelIds, channelId];
      return { ...prev, lockedChannelIds: updated };
    });
  }, []);

  const isChannelAllowed = useCallback((channel: Channel): boolean => {
    if (settings.activeProfile === 'kids') {
      // In kids mode: strictly only infantil category or Livre rating, and no locked channels
      if (channel.category === 'infantil') return true;
      if (channel.isAdultOrRestricted) return false;
      if (channel.minAgeRating && channel.minAgeRating > 0) return false;
      if (settings.lockedChannelIds.includes(channel.id)) return false;
      // Allow general public/culture if Livre
      return true;
    }

    if (settings.activeProfile === 'familia') {
      // Familia mode blocks 16+ and 18+ content
      if (channel.isAdultOrRestricted) return false;
      if (settings.lockedChannelIds.includes(channel.id)) return false;
      return true;
    }

    // Adulto mode: all channels allowed, but individually locked channels still require unlock
    return true;
  }, [settings.activeProfile, settings.lockedChannelIds]);

  const isChannelLocked = useCallback((channel: Channel): boolean => {
    return settings.lockedChannelIds.includes(channel.id);
  }, [settings.lockedChannelIds]);

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
