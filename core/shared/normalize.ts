export const nameKey = (s: string): string =>
  s.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** ¿Alguno de los textos contiene `q`? Sin mayúsculas ni tildes ("algebra" encuentra "Álgebra"). */
export const contains = (q: string, ...texts: (string | null | undefined)[]): boolean => {
  const k = nameKey(q);
  return texts.some((t) => t != null && nameKey(t).includes(k));
};
