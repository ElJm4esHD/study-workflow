const TZ = 'America/Argentina/Buenos_Aires';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const todayAR = (now: Date = new Date()): string => fmt.format(now);

const parse = (s: string): number => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
};
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return iso(parse(s)) === s;
}

export const isValidTime = (s: unknown): s is string =>
  typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export const addDays = (date: string, n: number): string => iso(parse(date) + n * 86_400_000);

export const weekdayOf = (date: string): number => new Date(parse(date)).getUTCDay() || 7;

export const formatDate = (date: string): string => date.split('-').reverse().join('/');

const dm = (d: string) => formatDate(d).slice(0, 5);
const days = (a: string, b: string): number => Math.round((parse(a) - parse(b)) / 86_400_000);

/** "Hoy", "Mañana", "En 3 días", "Ayer", "Hace 3 días"; más lejos, `dd/mm`. */
export function relDate(date: string, today: string): string {
  const n = days(date, today);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  if (n >= 2 && n <= 6) return `En ${n} días`;
  if (n <= -2 && n >= -6) return `Hace ${-n} días`;
  return dm(date);
}

/** Para lo que ya venció: "Vencida ayer", "Vencida hace 2 días", "Vencida el 03/11". */
export function lateText(date: string, today: string): string {
  const n = days(today, date);
  return n === 1 ? 'Vencida ayer' : n <= 6 ? `Vencida hace ${n} días` : `Vencida el ${dm(date)}`;
}
