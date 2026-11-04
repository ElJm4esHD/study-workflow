import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api, ApiError, useApi } from '../../../core/web/api.ts';
import { useCore } from '../../../core/web/CoreContext.tsx';
import { PlusIcon } from '../../../core/web/icons.tsx';
import { formatDate, todayAR } from '../../../core/shared/dates.ts';
import type { TodoItem } from '../server/service.ts';
import { groupTodos, orderBetween, type TodoView } from './views.ts';
import './todo.css';

const VIEWS: { id: TodoView; label: string }[] = [
  { id: 'hoy', label: 'Hoy' }, { id: 'proximas', label: 'Próximas' }, { id: 'sin-fecha', label: 'Sin fecha' },
  { id: 'materia', label: 'Por materia' }, { id: 'completadas', label: 'Completadas' },
];
const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Algo salió mal.');

type RowProps = { item: TodoItem; today: string; view: TodoView; color?: string; sortable: boolean; onToggle(i: TodoItem): void };
function Row({ item, today, view, color, sortable, onToggle }: RowProps) {
  const s = useSortable({ id: item.id, disabled: !sortable });
  const late = !item.completed && item.dueDate !== null && item.dueDate < today;
  // En Hoy y Próximas la fecha ya la da el grupo (salvo las vencidas).
  const showDate = item.dueDate !== null && view !== 'hoy' && view !== 'proximas';
  return (
    <li ref={s.setNodeRef} className={`todo-row${s.isDragging ? ' dragging' : ''}${item.completed ? ' done' : ''}`}
      style={{ transform: CSS.Transform.toString(s.transform), transition: s.transition, ['--bar' as string]: color ?? 'transparent' }}
      {...s.attributes} {...s.listeners}>
      <input type="checkbox" className="todo-check" checked={item.completed} onChange={() => onToggle(item)}
        aria-label={`${item.completed ? 'Destildar' : 'Completar'}: ${item.title}`} />
      <Link to={`/todo/${item.id}`} className="todo-body" draggable={false}>
        <span className="todo-title">{item.title}</span>
        <span className="todo-meta muted">
          {late && <strong className="late">Vencida </strong>}
          {item.dueTime && `${item.dueTime} `}
          {(showDate || late) && formatDate(item.dueDate!)}
        </span>
      </Link>
    </li>
  );
}

export function TodoPage() {
  const { materias, notify } = useCore();
  const [params, setParams] = useSearchParams();
  const view = VIEWS.find((v) => v.id === params.get('vista'))?.id ?? 'hoy';
  const materiaId = params.get('materia');
  const { data, error, reload } = useApi<TodoItem[]>('/api/todo');
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

  const colorOf = (id: string | null) => materias.find((m) => m.id === id)?.color;
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
    if (!over || active.id === over.id) return;
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
    if (!t) return;
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
      <h1>To-do</h1>
      <div className="todo-tabs" role="tablist" aria-label="Vistas">
        {VIEWS.map((v) => (
          <button key={v.id} role="tab" aria-selected={v.id === view} className="todo-tab"
            onClick={() => setParams(v.id === 'hoy' ? {} : { vista: v.id }, { replace: true })}>{v.label}</button>
        ))}
      </div>
      {view === 'materia' && (
        <div className="todo-tabs" role="group" aria-label="Materia">
          {[{ id: null, name: 'Todas', color: undefined }, ...materias.filter((m) => !m.archived), { id: 'none', name: 'Sin materia', color: undefined }].map((m) => (
            <button key={m.id ?? 'all'} className="todo-tab" aria-pressed={materiaId === m.id} onClick={() => setMateria(m.id)}>
              {m.color && <span className="dot" style={{ background: m.color }} aria-hidden="true" />}{m.name}
            </button>
          ))}
        </div>
      )}
      {error && !data && <p className="error" role="alert">{error.message} <button className="btn" onClick={reload}>Reintentar</button></p>}
      {data && empty && <p className="muted pad">{view === 'completadas' ? 'Todavía no completaste nada.' : 'Nada pendiente por acá.'}</p>}
      {groups.filter((g) => g.items.length).map((g) => {
        const sortable = g.reorderable ? g.items.filter((i) => !i.dueTime) : [];
        return (
          <section key={g.key} className="todo-group">
            {(groups.length > 1 || view === 'proximas') && <h2>{g.label}</h2>}
            <DndContext sensors={sensors} onDragEnd={(ev) => onDragEnd(sortable, ev)}>
              <SortableContext items={sortable.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ul className="list">
                  {g.items.map((i) => (
                    <Row key={i.id} item={real.get(i.id) ?? i} today={today} view={view} color={colorOf(i.materiaId)}
                      sortable={g.reorderable && !i.dueTime} onToggle={(x) => toggle(x.id)} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </section>
        );
      })}
      <div className="todo-end" />
      <Link to="/todo/nueva" className="todo-fab" aria-label="Nueva tarea"><PlusIcon /></Link>
      <form className="todo-add" onSubmit={quickAdd}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Agregar tarea…"
          aria-label="Agregar tarea rápido" enterKeyHint="send" />
      </form>
    </>
  );
}
