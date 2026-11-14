const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Primer objeto JSON con `"studyWorkflow": kind` dentro de un texto cualquiera (mensaje entero, fences de markdown). */
// shortcut: O(n^2) worst case on pathological text with many unbalanced '{'; fine for pasted chat messages.
export function findTagged(text: string, kind: string): Record<string, unknown> | null {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    let depth = 0;
    let inStr = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (c === '\\') j++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        try {
          const obj: unknown = JSON.parse(text.slice(i, j + 1));
          if (isObj(obj) && obj.studyWorkflow === kind) return obj;
        } catch {
          // not JSON; keep scanning
        }
        break;
      }
    }
  }
  return null;
}
