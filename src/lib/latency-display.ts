export function formatLatencySeconds(milliseconds: number | null | undefined): string {
  if (milliseconds == null || !Number.isFinite(milliseconds)) return '—';
  return `${(milliseconds / 1000).toFixed(2)}秒`;
}

export function latencySecondsValue(milliseconds: number): number {
  return milliseconds / 1000;
}

export function latencyThresholdForDisplay(milliseconds: number): number {
  return milliseconds / 1000;
}

export function latencyThresholdForStorage(seconds: number): number {
  return seconds * 1000;
}

export function normalizeLatencyMessage(message: string): string {
  return message.replace(/(\d+(?:\.\d+)?)ms\b/g, (_, value: string) => (
    formatLatencySeconds(Number(value))
  ));
}
