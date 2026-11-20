import type { MentoringDeliveryMode } from '../api/mentoringPairingApi';

export function getMentoringSessionDaysRemaining(scheduledStart: string, now = new Date()): number | null {
  const sessionDate = new Date(scheduledStart);
  if (Number.isNaN(sessionDate.getTime())) return null;

  const sessionDay = Date.UTC(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
  const currentDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((sessionDay - currentDay) / 86_400_000);
}

export function isMentoringSessionDay(scheduledStart: string, now = new Date()): boolean {
  return getMentoringSessionDaysRemaining(scheduledStart, now) === 0;
}

export function getMentoringDeliveryModeLabel(deliveryMode: MentoringDeliveryMode): string {
  if (deliveryMode === 'ONLINE') return 'Video only';
  if (deliveryMode === 'HYBRID') return 'Hybrid: in person and video';
  return 'In person';
}
