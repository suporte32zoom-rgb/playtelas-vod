import { Channel, EPGProgram } from '../types/tv';
import rawChannels from './channels.json';

export const CHANNELS: Channel[] = rawChannels as Channel[];

export function getAllChannels(): Channel[] {
  return CHANNELS;
}

export function getChannelById(id: string): Channel | undefined {
  return CHANNELS.find((c) => c.id === id);
}

export function getCurrentProgram(channel: Channel, referenceDate: Date = new Date()): EPGProgram {
  if (!channel.epgSchedule || channel.epgSchedule.length === 0) {
    return {
      id: 'epg-default',
      title: 'Programação Ao Vivo',
      description: 'Transmissão contínua em alta definição.',
      startTime: '00:00',
      endTime: '23:59',
      startMinutes: 0,
      endMinutes: 1439,
      rating: 'Livre',
      category: channel.subcategory
    };
  }

  const currentMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();

  // Find the program that surrounds currentMinutes
  const match = channel.epgSchedule.find((prog) => {
    if (prog.startMinutes <= prog.endMinutes) {
      return currentMinutes >= prog.startMinutes && currentMinutes < prog.endMinutes;
    } else {
      // Over midnight
      return currentMinutes >= prog.startMinutes || currentMinutes < prog.endMinutes;
    }
  });

  return match || channel.epgSchedule[0];
}

export function getNextProgram(channel: Channel, referenceDate: Date = new Date()): EPGProgram | undefined {
  if (!channel.epgSchedule || channel.epgSchedule.length < 2) return undefined;
  const current = getCurrentProgram(channel, referenceDate);
  const currentIndex = channel.epgSchedule.findIndex((p) => p.id === current.id);
  if (currentIndex === -1) return channel.epgSchedule[1];
  const nextIndex = (currentIndex + 1) % channel.epgSchedule.length;
  return channel.epgSchedule[nextIndex];
}

export function getProgramProgress(program: EPGProgram, referenceDate: Date = new Date()): number {
  const currentMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();
  let totalMinutes = program.endMinutes - program.startMinutes;
  if (totalMinutes <= 0) totalMinutes += 1440;

  let elapsedMinutes = currentMinutes - program.startMinutes;
  if (elapsedMinutes < 0) elapsedMinutes += 1440;

  const progress = Math.min(100, Math.max(0, Math.round((elapsedMinutes / totalMinutes) * 100)));
  return isNaN(progress) ? 50 : progress;
}

export function getRemainingTimeText(program: EPGProgram, referenceDate: Date = new Date()): string {
  const currentMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();
  let end = program.endMinutes;
  if (end < program.startMinutes && currentMinutes >= program.startMinutes) {
    end += 1440;
  }
  let diff = end - currentMinutes;
  if (diff < 0) diff += 1440;
  
  if (diff >= 60) {
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hours}h ${mins}m restantes`;
  }
  return `${diff}m restantes`;
}
