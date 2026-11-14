import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useMatch, useOutlet, useSearchParams } from 'react-router';
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api, ApiError, useApi } from '../../../core/web/api.ts';
import { useBlock, useCore } from '../../../core/web/CoreContext.tsx';
import { PlusIcon } from '../../../core/web/icons.tsx';
import { formatDate, todayAR } from '../../../core/shared/dates.ts';
import { fmtDuration } from '../../../core/shared/duration.ts';
import { materiaVars } from '../../../core/web/MateriaChip.tsx';
import { TODO_CATEGORIES } from '../shared.ts';
import type { TodoItem } from '../server/service.ts';
import { groupMinutes, groupTodos, keepSearch, orderBetween, type TodoView } from './views.ts';
import { TodoEditPage } from './TodoEditPage.tsx';
import './todo.css';

const VIEWS: { id: TodoView; label: string }[] = [
  { id: 'hoy', label: 'Hoy' }, { id: 'proximas', label: 'Próximas' }, { id: 'sin-fecha', label: 'Sin fecha' },
  { id: 'materia', label: 'Por materia' }, { id: 'completadas', label: 'Completadas' },
];
const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Algo salió mal.');

type RowProps = { item: TodoItem; today: string; view: TodoView; sigla?: string; color?: string; selected: boolean; sortable: boolean; onToggle(i: TodoItem): void };
function Row({ item, today, view, sigla, color, selected, sortable, onToggle }: RowProps) {
  const s = useSortable({ id: item.id, disabled: !sortable });
  const late = !item.completed && item.dueDate !== null && item.dueDate < today;
  const cat = TODO_CATEGORIES.find((c) => c.id === item.category)!;
  const dm = (d: string) => formatDate(d).slice(0, 5);
  return (
    <li ref={s.setNodeRef} className={`task-row${s.isDragging ? ' dragging' : ''}${item.completed ? ' done' : ''}${selected ? ' sel' : ''}`}
      style={{ ...(color ? materiaVars(color) : {}), transform: CSS.Transform.toString(s.transform), transition: s.transition }}
      {...s.attributes} {...s.listeners}>
      <button type="button" className="chk" onClick={() => onToggle(item)} aria-pressed={item.completed}
        aria-label={`${item.completed ? 'Destildar' : 'Completar'}: ${item.title}`}><span /></button>
      <Link to={{ pathname: `/todo/${item.id}`, search: keepSearch(useLocation().search) }} className="body" draggable={false}>
        <div className="title">{item.title}</div>
        <div className="meta">
          {sigla && <span className="chip">{sigla}</span>}
          {item.category !== 'tarea' && <span className={`tag ${item.category}`}>{cat.label}</span>}
          {late && <span className="tag late">venció {dm(item.dueDate!)}</span>}
          {item.dueTime && <span className="tag">{item.dueTime}</span>}
          {!late && item.dueDate !== null && view !== 'hoy' && <span className="tag">{dm(item.dueDate)}</span>}
        </div>
      </Link>
      <span className="dur">{item.durationMin ? fmtDuration(item.durationMin) : ''}</span>
    </li>
  );
}

export function TodoPage() {
  const { materias, notify } = useCore();
  const { off, block } = useBlock();
  const [params, setParams] = useSearchParams();
  const view = VIEWS.find((v) => v.id === params.get('vista'))?.id ?? 'hoy';
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
  const timers = useRef(new Map<string, number>());
  const [title, setTitle] = useState('');
  const today = todayAR();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => { if (data) setItems(data); }, [data]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const materiaOf = (id: string | null) => materias.find((m) => m.id === id);
  const shown = items.map((i) => (linger.has(i.id) ? { ...i, completed: !i.completed } : i));
  const real = new Map(items.map((i) => [i.id, i]));
  const groups = groupTodos(shown, view, today, materiaId);

  async function patch(id: string, p: Record<string, unknown>, rollback: () => void) {
    try { await api('PATCH', `/api/todo/${id}`, p); } catch (e) { rollback(); notify(msg(e)); }
  }

  function toggle(id: string) {
    const cur = items.find((i) => i.id === id)!;
    const next = !cur.completed;
    const prev = items;
    setItems((xs) => xs.map((i) => (i.id === id ? { ...i, completed: next, completedAt: next ? new Date().toISOString() : null } : i)));
    clearTimeout(timers.current.get(id));
    const unlinger = () => setLinger((s) => { const n = new Set(s); n.delete(id); return n; });
    if (linger.has(id)) { // segundo toque: vuelve a su estado original
      timers.current.delete(id);
      unlinger();
    } else {
      setLinger((s) => new Set(s).add(id));
      timers.current.set(id, window.setTimeout(() => { timers.current.delete(id); unlinger(); }, 1500));
    }
    void patch(id, { completed: next }, () => { setItems(prev); unlinger(); });
  }

  function onDragEnd(list: TodoItem[], { active, over }: DragEndEvent) {
    if (!over || active.id === over.id || block()) return;
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
    if (!t || block()) return;
    const body = {
      title: t,
      dueDate: view === 'hoy' ? today : null,
      materiaId: view === 'materia' && materiaId && materiaId !== 'none' ? materiaId : null,
    };
    try {
      const created = await api<TodoItem>('POST', '/api/todo', body);
      setItems((xs) => [...xs, created]);
      setTitle('');
    } catch (err) { notify(msg(err)); }
  }

  const setMateria = (v: string | null) => setParams(v ? { vista: 'materia', materia: v } : { vista: 'materia' }, { replace: true });
  const empty = groups.every((g) => g.items.length === 0);

  return (
    <>
      <h1 className="page-title">To-do</h1>
      <div className="pills scroll" role="group" aria-label="Vistas">
        {VIEWS.map((v) => (
          <button key={v.id} className="pill" aria-pressed={v.id === view}
            onClick={() => setParams(v.id === 'hoy' ? {} : { vista: v.id }, { replace: true })}>{v.label}</button>
        ))}
      </div>
      {view === 'materia' && (
        <div className="pills scroll" role="group" aria-label="Materia">
          {[{ id: null, name: 'Todas', sigla: 'Todas', color: undefined }, ...materias.filter((m) => !m.archived), { id: 'none', name: 'Sin materia', sigla: 'Sin materia', color: undefined }].map((m) => (
            <button key={m.id ?? 'all'} className="pill" title={m.name} aria-pressed={materiaId === m.id} onClick={() => setMateria(m.id)}>
              {m.color && <span className="dot" style={materiaVars(m.color)} aria-hidden="true" />}{m.color && ' '}{m.sigla}
            </button>
          ))}
        </div>
      )}
      <form className="todo-quick" onSubmit={quickAdd}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Agregar tarea…"
          aria-label="Agregar tarea rápido" enterKeyHint="send" />
        <button className="icon-btn" aria-label="Agregar" aria-disabled={off}><PlusIcon /></button>
      </form>
      {error && !data && <p className="error" role="alert">{error.message} <button className="btn" onClick={reload}>Reintentar</button></p>}
      {data && empty && <p className="muted pad">{view === 'completadas' ? 'Todavía no completaste nada.' : 'Nada pendiente por acá.'}</p>}
      <div className="cols">
      {groups.filter((g) => g.items.length).map((g) => {
        const sortable = g.reorderable ? g.items.filter((i) => !i.dueTime) : [];
        const { minutes, unestimated } = groupMinutes(g.items);
        const total = [minutes && fmtDuration(minutes), unestimated && `${unestimated} sin estimar`].filter(Boolean).join(', ');
        return (
          <section key={g.key}>
            <div className={`todo-sec${g.key === 'vencidas' ? ' late' : ''}`}><span>{g.label}</span><span className="num">{total}</span></div>
            <DndContext sensors={sensors} onDragEnd={(ev) => onDragEnd(sortable, ev)}>
              <SortableContext items={sortable.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ul className="list">
                  {g.items.map((i) => {
                    const m = materiaOf(i.materiaId);
                    return <Row key={i.id} item={real.get(i.id) ?? i} today={today} view={view} sigla={m?.sigla} color={m?.color}
                      selected={editing === i.id} sortable={g.reorderable && !i.dueTime} onToggle={(x) => toggle(x.id)} />;
                  })}
                </ul>
              </SortableContext>
            </DndContext>
          </section>
        );
      })}
      </div>
      {!editing && <Link to={{ pathname: "/todo/nueva", search: keepSearch(search) }} className="todo-fab" aria-label="Nueva tarea" aria-disabled={off} onClick={(e) => { if (block()) e.preventDefault(); }}><PlusIcon /></Link>}
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
