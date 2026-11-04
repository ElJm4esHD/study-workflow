export const nameKey = (s: string): string =>
  s.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
