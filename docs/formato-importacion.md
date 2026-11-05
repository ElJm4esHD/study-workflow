# Formato de importación de planes (v2)

Contrato con la skill de Claude que genera el JSON. **No se cambia sin subir `version` y avisar.** Lo implementa `modules/import/server/parser.ts`.

## Formato

```json
{
  "studyWorkflow": "plan",
  "version": 2,
  "titulo": "Preparación 2do parcial",
  "materia": "Álgebra",
  "items": [
    { "tipo": "tarea", "fecha": "2026-11-05", "titulo": "Guía 4: ej. 1 a 6", "notas": "Repasar teoría de autovalores antes", "duracion": 45, "categoria": "estudio" },
    { "tipo": "parcial", "fecha": "2026-11-20", "hora": "09:00", "titulo": "2do parcial" }
  ]
}
```

- Plan: `studyWorkflow: "plan"` y `version` (`1` o `2`) obligatorios; la skill debe emitir `2`. `titulo` y `materia` opcionales; `materia` es la default de los ítems.
- Ítem: `tipo`, `fecha` y `titulo` obligatorios; `hora`, `notas`, `materia`, `duracion` y `categoria` opcionales (`materia` pisa la del plan).
- Hora local de Argentina. Los campos desconocidos se ignoran.

| Campo | Regla |
|---|---|
| `tipo` | `tarea`, `evento`, `parcial`, `recuperatorio` o `final` |
| `fecha` | `YYYY-MM-DD`, tiene que ser una fecha real |
| `hora` | `HH:MM`, 24 h |
| `titulo` | texto no vacío, hasta 120 caracteres |
| `duracion` | solo `tarea`: minutos, entero entre 1 y 1440 (número, no texto) |
| `categoria` | solo `tarea`: `tarea` (default), `entrega` o `estudio` |
| `notas`, `materia` | texto |

`duracion` y `categoria` se ignoran (sin error) en `evento`, `parcial`, `recuperatorio` y `final`.

## Texto alrededor

Se puede pegar el mensaje entero de Claude: se busca el primer objeto JSON con `"studyWorkflow": "plan"`, con o sin fences de markdown.

## Mensajes de error

Del plan (no se puede continuar):

- `No encontré un plan en el texto pegado.`
- `Versión de plan no soportada (<v>). Actualizá la app.`
- `El plan no tiene ítems.`

Por ítem (se marca en la vista previa y no se importa):

- `El ítem no es un objeto.`
- `Tipo inválido: "<tipo>".`
- `Fecha inválida (usar AAAA-MM-DD).`
- `Falta el título.` / `El título supera los 120 caracteres.`
- `Hora inválida (usar HH:MM).`
- `Duración inválida (minutos enteros entre 1 y 1440).`
- `Categoría inválida: "<x>".`
- `Las notas tienen que ser texto.` / `La materia tiene que ser texto.`

## Materias

Se matchean por nombre sin distinguir mayúsculas ni tildes. Si no existe, la vista previa ofrece crearla (con color) o asignar una existente. Nada se guarda sin confirmar.

## Duplicados

Un ítem es duplicado si coincide **fecha + título (sin mayúsculas ni tildes) + materia** con una tarea con fecha o un evento no repetitivo ya cargado, o con un ítem anterior del mismo plan. Los duplicados se marcan y se omiten por defecto (se pueden volver a tildar).

## Mapeo de tipos

- `tarea` → ítem del To-do con fecha (y hora, si hay), con su duración y categoría.
- `evento`, `parcial`, `recuperatorio`, `final` → evento del Calendario con ese tipo.

## Cambios de v1 a v2

- `version` pasa a `2`. La app sigue leyendo planes con `version: 1`.
- Nuevo campo opcional `duracion` en los ítems `tarea`: minutos estimados, número entero entre 1 y 1440 (por ejemplo `45`; no `"45"` ni `45.5`).
- Nuevo campo opcional `categoria` en los ítems `tarea`: `"tarea"` (default si falta), `"entrega"` o `"estudio"`. Cualquier otro valor es un error del ítem.
- En `evento`, `parcial`, `recuperatorio` y `final`, `duracion` y `categoria` se ignoran.
- Todo lo demás (campos, reglas y mensajes de v1) queda igual.
