export function calculateNextHeavyRunAt(
  nextRunAt: string | Date | null,
  heavyIntervalMinutes: number,
): Date | null {
  if (!nextRunAt) return null;
  const interval = Number.isFinite(heavyIntervalMinutes) && heavyIntervalMinutes > 0
    ? Math.floor(heavyIntervalMinutes)
    : 15;
  const candidate = new Date(nextRunAt);
  if (!Number.isFinite(candidate.getTime())) return null;

  for (let offset = 0; offset <= interval; offset += 1) {
    const minuteSlot = Math.floor(candidate.getTime() / 60_000);
    if (minuteSlot % interval === 0) return candidate;
    candidate.setTime(candidate.getTime() + 60_000);
  }
  return null;
}
