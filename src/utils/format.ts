export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m <= 0) return `${s} sn`;
  return `${m} dk ${s.toString().padStart(2, '0')} sn`;
}

export function formatPercent(n: number): string {
  return `%${Math.round(n)}`;
}
