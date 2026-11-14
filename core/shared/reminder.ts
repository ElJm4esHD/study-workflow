/** Recordatorio: minutos antes del vencimiento (0 = a la hora). Tope de 4 semanas. */
export const REMINDER_MAX = 40_320;
export const isValidReminder = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= REMINDER_MAX;
