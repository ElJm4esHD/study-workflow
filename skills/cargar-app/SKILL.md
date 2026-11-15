---
name: cargar-app
description: Convertir el plan de estudio armado en el chat al JSON de importación de la app Study Workflow. Usar con /cargar-app o cuando el usuario pida cargar el plan a la app.
---

# Cargar plan a la app (Study Workflow)

El usuario arma planes de estudio en el chat (qué ejercicios hacer cada día, fechas de parciales). Esta skill convierte ese plan en un bloque JSON que el usuario copia y pega en el botón "Importar desde portapapeles" de la app Study Workflow. La app muestra una vista previa antes de guardar.

## Qué hacer

1. Tomá el plan **acordado en esta conversación** (el último que el usuario aprobó). Si no hay un plan claro, o hay varias versiones y no queda claro cuál vale, preguntá en una línea antes de generar.
2. Convertí cada día del plan en ítems. Un ítem por bloque de trabajo de un día. Si un día tiene ejercicios de dos materias, son dos ítems.
3. Si un bloque agrupa varios ejercicios sueltos (ej. "Hacer 1.2, 1.3, 4.5 y 7.2"), armá **una tarea con subtareas**, una por ejercicio, en vez de una tarea por ejercicio.
4. A cada ítem `tarea` ponele `categoria` y `duracion` (ver reglas abajo).
5. Incluí parciales, recuperatorios y finales que se hayan mencionado en el chat con fecha confirmada.
6. Generá **un solo bloque de código** `json` con el formato de abajo. Después del bloque, una sola línea: "Copiá el mensaje y tocá *Importar desde portapapeles* en la app." Nada más, sin repetir el plan en prosa.

## Reglas de fechas

- Fechas absolutas `YYYY-MM-DD`. Convertí "lunes", "mañana", "día 3", etc. a fechas reales usando la fecha actual de la conversación, en la zona horaria del usuario.
- Si el plan dice "día 1, día 2…" sin fecha de inicio, preguntá desde qué fecha arranca antes de generar.
- No inventes fechas de exámenes. Si un examen no tiene fecha confirmada en el chat, dejalo afuera y avisalo en la línea final.
- `hora` solo si se mencionó, en formato 24 h `HH:MM`.

## Categoría (solo en ítems `tarea`)

- `"tarea"`: resolver ejercicios o práctica (guías, ejercicios sueltos, avanzar un TP).
- `"entrega"`: algo que hay que entregar ese día (TP, informe, ejercicio para subir). Usala para el ítem del día de la entrega.
- `"estudio"`: teoría y preparación (leer apunte, resumen, repaso, parcial viejo, hoja de fórmulas).
- Si dudás, usá `"tarea"`. Cualquier otro valor es un error en la app.

## Duración (solo en ítems `tarea`)

- `duracion` = minutos estimados, **número entero entre 1 y 1440** (ej. `45`; nunca `"45"` ni `45.5`).
- Si el plan del chat dice cuánto lleva algo, usá eso.
- Si no, estimá algo realista para el nivel del usuario y redondeá a múltiplos de 15 (15, 30, 45, 60, 90, 120…). Referencias: 6 ejercicios de guía ≈ 60, repaso de un tema ≈ 45, parcial viejo completo ≈ 120, dudas para consulta ≈ 15.
- En una tarea con subtareas, la duración es la del total.
- Revisá que el total de cada día sea razonable y coherente con lo que se habló en el chat (si el usuario dijo "tengo 3 horas por día", que no pase de eso).
- Si no tenés base para estimar un ítem, omití `duracion` en ese ítem (queda "sin estimar" en la app).

## Subtareas (solo en ítems `tarea`)

- `subtareas`: lista de textos, uno por subtarea (ej. `["1.2", "1.3", "4.5", "7.2"]`).
- Hasta 50 subtareas; cada una no vacía y de hasta 120 caracteres.
- Usalas cuando una tarea agrupa varios ejercicios o pasos; si es una sola cosa, no pongas el campo.

## Formato v3 (contrato con la app, no lo cambies)

```json
{
  "studyWorkflow": "plan",
  "version": 3,
  "titulo": "Preparación 2do parcial",
  "materia": "Álgebra",
  "items": [
    { "tipo": "tarea", "fecha": "2026-11-05", "titulo": "Guía 4: ejercicios sueltos", "categoria": "tarea", "duracion": 60, "subtareas": ["1.2", "1.3", "4.5", "7.2"] },
    { "tipo": "tarea", "fecha": "2026-11-06", "titulo": "Repaso diagonalización", "categoria": "estudio", "duracion": 45, "notas": "Autovalores y autovectores" },
    { "tipo": "parcial", "fecha": "2026-11-20", "hora": "09:00", "titulo": "2do parcial" }
  ]
}
```

Campos:
- `studyWorkflow`: siempre `"plan"`. `version`: siempre `3`.
- `titulo` (opcional): nombre corto del plan.
- `materia` (opcional): materia por defecto de todos los ítems. Usá el nombre como lo llama el usuario en el chat (ej. "Álgebra", "Física", "PI").
- `items`: lista, en orden cronológico.
  - `tipo` (obligatorio): `tarea` | `evento` | `parcial` | `recuperatorio` | `final`. Ejercicios, repasos y entregas son `tarea`.
  - `fecha` (obligatoria): `YYYY-MM-DD`.
  - `titulo` (obligatorio): corto y concreto, máximo 120 caracteres. Qué hacer, no por qué.
  - `categoria` (opcional, solo `tarea`): `"tarea"` | `"entrega"` | `"estudio"`.
  - `duracion` (opcional, solo `tarea`): minutos, entero de 1 a 1440.
  - `subtareas` (opcional, solo `tarea`): lista de textos.
  - `hora` (opcional): `HH:MM`.
  - `notas` (opcional): detalle útil. Breve.
  - `materia` (opcional): solo si difiere de la del plan.
- En `evento`, `parcial`, `recuperatorio` y `final` no pongas `categoria`, `duracion` ni `subtareas` (la app los ignora).

## Chequeo antes de responder

- JSON válido: comillas dobles, sin comas finales, sin comentarios.
- `version` es `3`.
- Todas las fechas existen (ej. no 2026-11-31) y coinciden con el día de la semana del plan.
- Cada `duracion` es un número entero (sin comillas) entre 1 y 1440, y cada `categoria` es una de las tres válidas.
- Nada del plan aprobado quedó afuera, y no agregaste tareas que no estaban.
