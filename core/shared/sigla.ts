const STOP = new Set(['DE', 'DEL', 'LA', 'EL', 'Y', 'EN', 'A']);
const ROMAN: Record<string, string> = { I: '1', II: '2', III: '3', IV: '4', V: '5' };

export function makeSigla(name: string): string {
  const up = name.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
  let words = up.split(/[^A-Z0-9]+/).filter(Boolean);
  let num = '';
  const last = words.at(-1);
  if (words.length > 1 && last && (/^\d+$/.test(last) || ROMAN[last])) {
    num = ROMAN[last] ?? last;
    words = words.slice(0, -1);
  }
  words = words.filter((w) => !STOP.has(w));
  if (!words.length) return up.replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'MAT';
  const base = words.length > 1 ? words.map((w) => w[0]).join('') : words[0]!.slice(0, 3);
  return (base + num).slice(0, 5);
}

export function normalizeSigla(s: unknown): string | null {
  const v = typeof s === 'string' ? s.trim().toUpperCase() : '';
  return /^[A-Z0-9]{1,5}$/.test(v) ? v : null;
}
