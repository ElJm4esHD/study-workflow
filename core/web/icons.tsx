import { createElement } from 'react';
import {
  BookOpen, Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Ellipsis, Flag, Gauge, House,
  Inbox, List, ListChecks, Plus, RefreshCw, Settings, Trash2, Type, Vibrate, X, type LucideIcon, type LucideProps,
} from 'lucide-react';

/** Set único de íconos (Lucide: trazo de 2 px, grilla de 24). Los módulos importan de acá, nunca de lucide-react. */
const make = (I: LucideIcon) => (p: LucideProps) => createElement(I, { size: 24, 'aria-hidden': true, ...p });

export const SettingsIcon = make(Settings);
export const ChevronIcon = make(ChevronDown);
export const ChevronRightIcon = make(ChevronRight);
export const ChevronLeftIcon = make(ChevronLeft);
export const PlusIcon = make(Plus);
export const CloseIcon = make(X);
export const CheckIcon = make(Check);
export const ChecklistIcon = make(ListChecks);
export const ImportIcon = make(Download);
export const CalendarIcon = make(Calendar);
export const HomeIcon = make(House);
export const FlagIcon = make(Flag);
export const MoreIcon = make(Ellipsis);
export const ListIcon = make(List);
export const BookIcon = make(BookOpen);
export const TrashIcon = make(Trash2);
export const InboxIcon = make(Inbox);
export const RefreshIcon = make(RefreshCw);
export const GaugeIcon = make(Gauge);
export const VibrateIcon = make(Vibrate);
export const TypeIcon = make(Type);
