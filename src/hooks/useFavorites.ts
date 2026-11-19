import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'cinelive_favorites';

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    // Default popular favorites to start with
    return ['ch-1', 'ch-2', 'ch-4', 'ch-10', 'ch-18'];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteIds));
    } catch {
      // ignore
    }
  }, [favoriteIds]);

  const toggleFavorite = useCallback((channelId: string) => {
    setFavoriteIds((prev) => {
      const exists = prev.includes(channelId);
      if (exists) {
        return prev.filter((id) => id !== channelId);
      } else {
        if (navigator.vibrate) navigator.vibrate(40);
        return [...prev, channelId];
      }
    });
  }, []);

  const isFavorite = useCallback(
    (channelId: string) => favoriteIds.includes(channelId),
    [favoriteIds]
  );

  return {
    favoriteIds,
    toggleFavorite,
    isFavorite,
    favoritesCount: favoriteIds.length
  };
}
