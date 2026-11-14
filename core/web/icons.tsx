import type { ReactNode } from 'react';

const Svg = ({ children }: { children: ReactNode }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
export const SettingsIcon = () => <Svg><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></Svg>;
export const ChevronIcon = () => <Svg><path d="m6 9 6 6 6-6" /></Svg>;
export const PlusIcon = () => <Svg><path d="M12 5v14M5 12h14" /></Svg>;
export const ChecklistIcon = () => <Svg><path d="m4 6 2 2 3-3M4 14l2 2 3-3M13 7h7M13 15h7" /></Svg>;
export const ImportIcon = () => <Svg><path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></Svg>;
export const CalendarIcon = () => <Svg><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>;
export const HomeIcon = () => <Svg><path d="m3 11 9-8 9 8M5 10v10h5v-6h4v6h5V10" /></Svg>;
export const FlagIcon = () => <Svg><path d="M5 21V4M5 4h13l-3 4.5 3 4.5H5" /></Svg>;
