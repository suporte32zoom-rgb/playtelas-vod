import { useState, useEffect, useCallback } from 'react';
import { ScheduledNotification } from '../types/tv';

const STORAGE_KEY = 'cinelive_notifications_enabled';
const SCHEDULE_KEY = 'cinelive_scheduled_alerts';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [scheduledAlerts, setScheduledAlerts] = useState<ScheduledNotification[]>(() => {
    try {
      const stored = localStorage.getItem(SCHEDULE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [latestToast, setLatestToast] = useState<{ id: string; title: string; body: string } | null>(null);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isEnabled));
    } catch {
      // ignore
    }
  }, [isEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(scheduledAlerts));
    } catch {
      // ignore
    }
  }, [scheduledAlerts]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      setIsEnabled(true);
      return 'granted' as NotificationPermission;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        setIsEnabled(true);
        // Welcome notification
        sendNotification(
          '🔔 Notificações Ativadas!',
          'Você receberá alertas antes do início dos seus programas e jogos favoritos.'
        );
      } else {
        setIsEnabled(false);
      }
      return result;
    } catch (err) {
      console.warn('Notification permission error:', err);
      setIsEnabled(true);
      return 'default' as NotificationPermission;
    }
  }, []);

  const sendNotification = useCallback((title: string, body: string, icon: string = './pwa-192x192.png') => {
    // Show in-app toast
    const toastId = Math.random().toString();
    setLatestToast({ id: toastId, title, body });
    setTimeout(() => {
      setLatestToast((curr) => (curr?.id === toastId ? null : curr));
    }, 4500);

    // Show native system push notification if permitted
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon,
          badge: './icon.svg',
          tag: 'cinelive-alert',
          silent: false
        });
      } catch {
        // Fallback for Service Worker notification if available
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.ready
            .then((reg) => reg.showNotification(title, { body, icon }))
            .catch(() => {});
        }
      }
    }
  }, []);

  const toggleNotifications = useCallback(async () => {
    if (!isEnabled) {
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        await requestPermission();
      } else {
        setIsEnabled(true);
        sendNotification('Notificações Ligadas', 'Alertas de programação ativados.');
      }
    } else {
      setIsEnabled(false);
    }
  }, [isEnabled, requestPermission, sendNotification]);

  const scheduleProgramAlert = useCallback((channelId: string, channelName: string, programTitle: string, startTime: string) => {
    const newAlert: ScheduledNotification = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      channelId,
      channelName,
      programTitle,
      startTime,
      date: new Date().toLocaleDateString('pt-BR')
    };

    setScheduledAlerts((prev) => [...prev, newAlert]);
    sendNotification(
      '⏰ Alarme Agendado!',
      `Você será avisado quando "${programTitle}" começar às ${startTime} no canal ${channelName}.`
    );
  }, [sendNotification]);

  const removeProgramAlert = useCallback((alertId: string) => {
    setScheduledAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  const isProgramScheduled = useCallback((channelId: string, programTitle: string) => {
    return scheduledAlerts.some((a) => a.channelId === channelId && a.programTitle === programTitle);
  }, [scheduledAlerts]);

  return {
    permission,
    isEnabled,
    scheduledAlerts,
    latestToast,
    requestPermission,
    toggleNotifications,
    sendNotification,
    scheduleProgramAlert,
    removeProgramAlert,
    isProgramScheduled,
    dismissToast: () => setLatestToast(null)
  };
}
