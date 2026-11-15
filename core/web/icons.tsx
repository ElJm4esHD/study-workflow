import { createElement } from 'react';
import {
  Archive, ArchiveRestore, CircleAlert, BookOpen, Calendar, CalendarClock, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Download, Ellipsis, Flag, Gauge,
  GraduationCap, House, Inbox, List, ListChecks, ListTree, PartyPopper, PenLine, Plus, RefreshCw, RotateCcw, Settings, Trash2,
  Type, Upload, Vibrate, X, type LucideIcon, type LucideProps,
} from 'lucide-react';

/** Set único de íconos (Lucide: trazo de 2 px, grilla de 24). Los módulos importan de acá, nunca de lucide-react. */
const make = (I: LucideIcon) => (p: LucideProps) => createElement(I, { size: 24, 'aria-hidden': true, ...p });

export const AlertIcon = make(CircleAlert);
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
export const UploadIcon = make(Upload);
export const ClockIcon = make(Clock);
export const SubtasksIcon = make(ListTree);
export const PartyIcon = make(PartyPopper);
export const EventIcon = make(CalendarClock);
export const ParcialIcon = make(PenLine);
export const RecuperatorioIcon = make(RotateCcw);
export const FinalIcon = make(GraduationCap);
export const ArchiveIcon = make(Archive);
export const UnarchiveIcon = make(ArchiveRestore);
