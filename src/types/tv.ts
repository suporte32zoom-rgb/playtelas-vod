export type CategoryId =
  | 'todos'
  | 'esportes'
  | 'filmes-series'
  | 'infantil'
  | 'tv-ao-vivo'
  | 'noticias'
  | 'entretenimento'
  | 'agro'
  | 'religioso'
  | 'regional'
  | 'favoritos';

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  iconName: string;
  description: string;
  color: string;
  gradient: string;
  subcategories: string[];
}

export interface StreamSource {
  title: string;
  url: string;
  quality: string;
  isPartTime?: boolean;
  isGeoBlocked?: boolean;
  referrer?: string | null;
  userAgent?: string | null;
}

export interface EPGProgram {
  id: string;
  title: string;
  description: string;
  startTime: string; // "14:00"
  endTime: string;   // "15:30"
  startMinutes: number; // minutes from midnight (0 - 1439)
  endMinutes: number;
  rating: 'Livre' | '10' | '12' | '14' | '16' | '18';
  category: string;
}

export interface Channel {
  id: string;
  channelNumber: number;
  name: string;
  category: Exclude<CategoryId, 'todos' | 'favoritos'>;
  subcategory: string;
  logo: string;
  tvgId: string;
  streams: StreamSource[];
  bestQuality: string;
  isAdultOrRestricted?: boolean;
  minAgeRating?: number;
  description: string;
  epgSchedule: EPGProgram[];
}

export type AspectRatioMode = '16:9' | '4:3' | 'fill' | 'cinema';
export type EqualizerMode = 'padrao' | 'dialogo' | 'musica' | 'cinema';

export interface PlaybackState {
  currentStreamIndex: number;
  quality: string; // 'auto' | '1080p' | '720p' | '480p'
  volume: number; // 0 - 1
  volumeBoost: number; // 1.0 - 2.5
  isMuted: boolean;
  aspectRatio: AspectRatioMode;
  equalizer: EqualizerMode;
  isPlaying: boolean;
  isBuffering: boolean;
  error: string | null;
  sleepTimer: number | null; // minutes remaining or null
}

export type UserProfileType = 'adulto' | 'kids' | 'familia';

export interface ParentalControlSettings {
  pin: string; // 4 digits e.g. "1234"
  isPinSet: boolean;
  activeProfile: UserProfileType;
  kidsModeActive: boolean;
  lockedChannelIds: string[];
  maxRatingKids: number; // e.g. 0 (Livre) or 10
}

export interface SmartTVDevice {
  id: string;
  name: string;
  type: 'chromecast' | 'apple-tv' | 'samsung-tizen' | 'lg-webos' | 'android-tv' | 'roku' | 'browser-receiver';
  ip?: string;
  status: 'connected' | 'available' | 'disconnected';
  pairingCode?: string;
}

export interface ScheduledNotification {
  id: string;
  channelId: string;
  channelName: string;
  programTitle: string;
  startTime: string;
  date: string;
  notified?: boolean;
}
