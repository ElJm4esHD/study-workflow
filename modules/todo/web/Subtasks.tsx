import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { api, errMsg } from '../../../core/web/api.ts';
import { useBlock, useCore } from '../../../core/web/CoreContext.tsx';
import { vibrate } from '../../../core/web/haptics.ts';
import { ChevronRightIcon, SubtasksIcon } from '../../../core/web/icons.tsx';
import { useMotion } from '../../../core/web/motion.tsx';
import type { Subtask, TodoItem } from '../server/service.ts';

/** Subtareas tildables desde la lista: el contador de la fila las despliega debajo y cada tilde se guarda al toque. */
export function useSubtasks(item: TodoItem, onSaved: (i: TodoItem) => void) {
  const { notify } = useCore();
  const { block } = useBlock();
  const { spring } = useMotion();
  const [open, setOpen] = useState(false);
  const [subs, setSubs] = useState<Subtask[]>(item.subtasks ?? []);
  useEffect(() => setSubs(item.subtasks ?? []), [item.subtasks]);
  if (subs.length === 0) return {};

  async function toggle(id: string) {
    if (block()) return;
    const prev = subs, next = subs.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
    setSubs(next);
    vibrate(next.every((s) => s.done) ? 'success' : 'tick');
    try { const r = await api<TodoItem | undefined>('PATCH', `/api/todo/${item.id}`, { subtasks: next }); if (r) onSaved(r); }
    catch (e) { setSubs(prev); notify(errMsg(e)); }
  }

  const done = subs.filter((s) => s.done).length;
  return {
    trailing: (
      <button type="button" className="sub-btn" aria-expanded={open} aria-label={`Subtareas: ${done} de ${subs.length}`} onClick={() => setOpen(!open)}>
        <SubtasksIcon size={14} />{done}/{subs.length}<ChevronRightIcon size={14} className="sub-chev" />
      </button>
    ),
    below: (
      <AnimatePresence initial={false}>
        {open && (
          <m.ul className="sub-list" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring('gentle')}>
            {subs.map((s) => (
              <li key={s.id} className={s.done ? 'done' : undefined}>
                <button type="button" className="chk" aria-pressed={s.done} onClick={() => void toggle(s.id)}><span /></button>
                <span className="sub-title">{s.title}</span>
              </li>
            ))}
          </m.ul>
        )}
      </AnimatePresence>
    ),
  };
}
