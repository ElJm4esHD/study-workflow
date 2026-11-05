export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return [h && `${h} h`, (m || !h) && `${m} min`].filter(Boolean).join(' ');
}
