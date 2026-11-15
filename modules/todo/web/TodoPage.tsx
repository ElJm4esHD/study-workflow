import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useMatch, useOutlet, useSearchParams } from 'react-router';
import { AnimatePresence } from 'motion/react';
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api, useApi, errMsg } from '../../../core/web/api.ts';
import { useCore } from '../../../core/web/CoreContext.tsx';
import { BookIcon, ClockIcon, InboxIcon, PartyIcon, PlusIcon, UploadIcon } from '../../../core/web/icons.tsx';
import { lateText, relDate } from '../../../core/shared/dates.ts';
import { fmtDuration } from '../../../core/shared/duration.ts';
import { materiaVars } from '../../../core/web/MateriaChip.tsx';
import { vibrate } from '../../../core/web/haptics.ts';
import { EmptyState, Floating, PageHeader, PullToRefresh, Segmented, Skeleton, TaskRow, ErrorState } from '../../../core/web/ui.tsx';
import { useSubtasks } from './Subtasks.tsx';
import { TODO_CATEGORIES } from '../shared.ts';
import type { TodoItem } from '../app/service.ts';
import { groupMinutes, groupTodos, keepSearch, orderBetween, type TodoView } from './views.ts';
import { TodoEditPage } from './TodoEditPage.tsx';
import { todoDefaults } from './TodoSettings.tsx';
import './todo.css';
import { useToday } from '../../../core/web/useToday.ts';

const PAGE = 30;
const VIEWS = [['hoy', 'Hoy'], ['proximas', 'Próximas'], ['sin-fecha', 'Sin fecha'], ['materia', 'Por materia'], ['completadas', 'Completadas']] as const;

/** Meta de una tarea (materia, categoría, subtareas, vencida/hora/fecha). Compartida con la tarjeta Hoy. */
export function TaskMeta({ item, today, sigla, showDate }: { item: TodoItem; today: string; sigla?: string; showDate: boolean }) {
  const late = !item.completed && item.dueDate !== null && item.dueDate < today;
  const cat = TODO_CATEGORIES.find((c) => c.id === item.category)!;
  return <>
    {sigla && <span className="chip">{sigla}</span>}
    {item.category !== 'tarea' && <span className={`tag mi-tag ${item.category}`}>{item.category === 'entrega' ? <UploadIcon /> : <BookIcon />}{cat.label}</span>}
    {late && <span className="tag late mi-tag"><ClockIcon />{lateText(item.dueDate!, today)}</span>}
    {item.dueTime && !late && <span className="tag mi-tag"><ClockIcon />{item.dueTime}</span>}
    {!late && showDate && item.dueDate !== null && <span className="tag">{relDate(item.dueDate, today)}</span>}
  </>;
}

type RowProps = { item: TodoItem; today: string; view: TodoView; sigla?: string; color?: string; selected: boolean; sortable: boolean; layout: boolean;
  onToggle(): void; onSaved(i: TodoItem): void };
function Row({ item, today, view, sigla, color, selected, sortable, layout, onToggle, onSaved }: RowProps) {
  const s = useSortable({ id: item.id, disabled: !sortable });
  const { search } = useLocation();
  return (
    <TaskRow {...useSubtasks(item, onSaved)}
      title={item.title} done={item.completed} selected={selected} colorVars={color ? materiaVars(color) : undefined}
      meta={<TaskMeta item={item} today={today} sigla={sigla} showDate={view !== 'hoy'} />}
      duration={item.durationMin ? fmtDuration(item.durationMin) : ''}
      to={{ pathname: `/todo/${item.id}`, search: keepSearch(search) }}
      toggleLabel={`${item.completed ? 'Destildar' : 'Completar'}: ${item.title}`}
      noLayout={!layout} onToggle={onToggle}
      dndRef={s.setNodeRef} dndProps={{ ...s.attributes, role: 'group', 'aria-disabled': undefined, ...s.listeners }} /* con hora no se reordena, pero la fila no está deshabilitada */ dragging={s.isDragging}
      dndStyle={{ transform: CSS.Transform.toString(s.transform), transition: s.transition }}
    />
  );
}

function ListSkeleton() {
  return <div className="card todo-skel" role="status" aria-label="Cargando">{[0, 1, 2, 3].map((i) => (
    <div key={i} className="skel-row"><Skeleton w="22px" h={22} r={6} /><div><Skeleton w={`${70 - i * 8}%`} /><Skeleton w="30%" h={10} /></div></div>
  ))}</div>;
}

export function TodoPage() {
  const { materias, notify, settings } = useCore();
  const dflt = todoDefaults(settings);
  const [params, setParams] = useSearchParams();
  const view: TodoView = VIEWS.find(([v]) => v === params.get('vista'))?.[0] ?? 'hoy';
  const materiaId = params.get('materia');
  const { data, error, reload } = useApi<TodoItem[]>('/api/todo');
  const { key, search } = useLocation();
  const editing = useMatch('/todo/:id')?.params.id;
  const first = useRef(true);
  // En la compu la lista sigue montada al guardar en el panel: se recarga en cada navegación.
  useEffect(() => { if (first.current) first.current = false; else reload(); }, [key, reload]);
  const [items, setItems] = useState<TodoItem[]>([]);
  // Ítems recién tildados: siguen en su vista 1,5 s para poder deshacer con otro toque.
  const [linger, setLinger] = useState<Set<string>>(new Set());
  const [dndBusy, setDndBusy] = useState(false);
  const timers = useRef(new Map<string, number>());
  const [title, setTitle] = useState('');
  const adding = useRef(false);
  // Listas largas: se dibujan de a PAGE por grupo (con 200+ tareas el celu tardaba segundos); "Mostrar más" suma otra página.
  const [extra, setExtra] = useState<Record<string, number>>({});
  const today = useToday();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => { if (data) setItems(data); }, [data]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const materiaOf = (id: string | null) => materias.find((m) => m.id === id);
  const old = (i: TodoItem) => view === 'completadas' && dflt.hideCompletedDays !== null && i.completed && !linger.has(i.id) && !!i.completedAt
    && Date.now() - Date.parse(i.completedAt) > dflt.hideCompletedDays * 86_400_000; // se oculta de la vista, no se borra
  const shown = items.map((i) => (linger.has(i.id) ? { ...i, completed: !i.completed } : i)).filter((i) => !old(i));
  const real = new Map(items.map((i) => [i.id, i]));
  const groups = groupTodos(shown, view, today, materiaId);

  async function patch(id: string, p: Record<string, unknown>, rollback: () => void) {
    try { await api('PATCH', `/api/todo/${id}`, p); } catch (e) { rollback(); notify(errMsg(e)); }
  }

  function toggle(id: string) {
    const cur = items.find((i) => i.id === id)!;
    const next = !cur.completed;
    const prev = items;
    vibrate(next ? 'success' : 'tick');
    clearTimeout(timers.current.get(id));
    const unlinger = () => setLinger((s) => { const n = new Set(s); n.delete(id); return n; });
    if (linger.has(id)) { // segundo toque: vuelve a su estado original
      timers.current.delete(id);
      unlinger();
    } else {
      setLinger((s) => new Set(s).add(id));
      timers.current.set(id, window.setTimeout(() => { timers.current.delete(id); unlinger(); }, 1500));
    }
    setItems((xs) => xs.map((i) => (i.id === id ? { ...i, completed: next, completedAt: next ? new Date().toISOString() : null } : i)));
    void patch(id, { completed: next }, () => { setItems(prev); unlinger(); });
  }

  function onDragEnd(list: TodoItem[], { active, over }: DragEndEvent) {
    // El reacomodo ya lo hizo dnd-kit: sin animación de layout en este render, si no la fila "vuelve" y salta.
    setTimeout(() => setDndBusy(false), 50);
    if (!over || active.id === over.id) return;
    vibrate('release');
    const from = list.findIndex((i) => i.id === active.id), to = list.findIndex((i) => i.id === over.id);
    const moved = arrayMove(list, from, to);
    const sortOrder = orderBetween(moved[to - 1]?.sortOrder, moved[to + 1]?.sortOrder);
    const prev = items;
    setItems((xs) => xs.map((i) => (i.id === active.id ? { ...i, sortOrder } : i)));
    void patch(String(active.id), { sortOrder }, () => setItems(prev));
  }

  async function quickAdd(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || adding.current) return;
    adding.current = true;
    const body = {
      title: t, durationMin: dflt.durationMin, category: dflt.category,
      dueDate: view === 'hoy' ? today : null,
      materiaId: view === 'materia' && materiaId && materiaId !== 'none' ? materiaId : null,
    };
    try {
      const created = await api<TodoItem>('POST', '/api/todo', body);
      setItems((xs) => [...xs, created]);
      setTitle('');
      vibrate('tick');
    } catch (err) { notify(errMsg(err)); } finally { adding.current = false; }
  }

  const setMateria = (v: string | null) => setParams(v ? { vista: 'materia', materia: v } : { vista: 'materia' }, { replace: true });
  const empty = groups.every((g) => g.items.length === 0);
  const pending = items.filter((i) => !i.completed);
  const forToday = pending.filter((i) => i.dueDate === today).length;
  const late = pending.filter((i) => i.dueDate !== null && i.dueDate < today).length;
  const sub = data ? [`${forToday} para hoy`, late > 0 && `${late} ${late === 1 ? 'vencida' : 'vencidas'}`].filter(Boolean).join(' · ') : undefined;

  return (
    <>
    <PullToRefresh>
      <PageHeader title="To-do" sub={sub} />
      <div className="seg-scroll">
        <Segmented name="todo-view" label="Vistas" value={view} options={VIEWS}
          onChange={(v) => setParams(v === 'hoy' ? {} : { vista: v }, { replace: true })} />
      </div>
      {view === 'materia' && (
        <div className="pills scroll" role="group" aria-label="Materia">
          {[{ id: null, name: 'Todas', sigla: 'Todas', color: undefined }, ...materias.filter((m) => !m.archived), { id: 'none', name: 'Sin materia', sigla: 'Sin materia', color: undefined }].map((m) => (
            <button key={m.id ?? 'all'} className="pill" title={m.name} aria-pressed={materiaId === m.id} onClick={() => setMateria(m.id)}>
              {m.color && <span className="dot" style={materiaVars(m.color)} aria-hidden="true" />}{m.color && ' '}{m.sigla}
            </button>
          ))}
        </div>
      )}
      <form className="todo-quick" onSubmit={quickAdd}>
        <PlusIcon size={20} />
        <input className="bare" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={view === 'hoy' ? 'Agregar tarea para hoy…' : 'Agregar tarea…'}
          aria-label="Agregar tarea rápido" enterKeyHint="send" />
        <kbd className="kbd">Enter</kbd>
      </form>
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {!data && !error && <ListSkeleton />}
      {data && empty && (view === 'hoy'
        ? <EmptyState icon={PartyIcon} title="Todo listo por hoy" action={<button className="btn" onClick={() => setParams({ vista: 'proximas' }, { replace: true })}>Ver próximas</button>}>No quedan tareas para hoy.</EmptyState>
        : <EmptyState icon={InboxIcon} title={view === 'completadas' ? 'Todavía nada completado' : 'Nada pendiente por acá'}>{view === 'completadas' ? 'Lo que tildes queda acá.' : 'Las tareas nuevas aparecen acá.'}</EmptyState>)}
      <div className="cols">
      {groups.filter((g) => g.items.length).map((g) => {
        const gk = `${view}:${g.key}`, cap = PAGE + (extra[gk] ?? 0), listed = g.items.slice(0, cap), rest = g.items.length - listed.length;
        const sortable = g.reorderable ? listed.filter((i) => !i.dueTime) : [];
        const { minutes, unestimated } = groupMinutes(g.items);
        const total = [minutes && fmtDuration(minutes), unestimated && `${unestimated} sin estimar`].filter(Boolean).join(', ');
        return (
          <section key={g.key} className="todo-group">
            <div className={`todo-sec${g.key === 'vencidas' ? ' late' : ''}`}><span>{g.label}</span><span className="num">{total}</span></div>
            <DndContext sensors={sensors} onDragStart={() => { setDndBusy(true); vibrate('tick'); }} onDragCancel={() => setDndBusy(false)} onDragEnd={(ev) => onDragEnd(sortable, ev)}>
              <SortableContext items={sortable.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ul className="card rows">
                  <AnimatePresence initial={false}>
                    {listed.map((i) => {
                      const m = materiaOf(i.materiaId);
                      return <Row key={i.id} item={real.get(i.id) ?? i} today={today} view={view} sigla={m?.sigla} color={m?.color}
                        selected={editing === i.id} sortable={g.reorderable && !i.dueTime} layout={!dndBusy}
                        onToggle={() => toggle(i.id)}
                        onSaved={(n) => setItems((xs) => xs.map((x) => (x.id === n.id ? n : x)))} />;
                    })}
                  </AnimatePresence>
                </ul>
              </SortableContext>
            </DndContext>
            {rest > 0 && <button type="button" className="btn more-btn" onClick={() => setExtra((x) => ({ ...x, [gk]: (x[gk] ?? 0) + PAGE }))}>Mostrar {Math.min(PAGE, rest)} más ({rest} sin mostrar)</button>}
          </section>
        );
      })}
      </div>
    </PullToRefresh>
      {!editing && <Floating><nav aria-label="Acción rápida"><Link to={{ pathname: '/todo/nueva', search: keepSearch(search) }} className="todo-fab" aria-label="Nueva tarea"><PlusIcon /></Link></nav></Floating>}
    </>
  );
}

const useWide = () => {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const q = window.matchMedia('(min-width: 1024px)');
    const f = () => setWide(q.matches);
    q.addEventListener('change', f);
    return () => q.removeEventListener('change', f);
  }, []);
  return wide;
};

/** Compu (≥ 1024 px): lista + panel de edición al lado. Celu: la edición es una pantalla aparte. */
export function TodoLayout() {
  const outlet = useOutlet();
  const wide = useWide();
  const { key } = useLocation();
  if (!wide) return outlet ?? <TodoPage />;
  // Sin tarea elegida el panel ofrece "Nueva tarea"; la key lo vacía después de guardar.
  return <div className="todo-split"><div><TodoPage /></div><aside>{outlet ?? <TodoEditPage key={key} embedded />}</aside></div>;
}
