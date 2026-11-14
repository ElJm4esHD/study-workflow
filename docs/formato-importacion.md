# Formato de importación de planes (v3)

Contrato con la skill de Claude que genera el JSON. **No se cambia sin subir `version` y avisar.** Lo implementa `modules/import/server/parser.ts`.

## Formato

```json
{
  "studyWorkflow": "plan",
  "version": 3,
  "titulo": "Preparación 2do parcial",
  "materia": "Álgebra",
  "items": [
    { "tipo": "tarea", "fecha": "2026-11-05", "titulo": "Guía 4: ej. 1 a 6", "notas": "Repasar teoría de autovalores antes", "duracion": 45, "categoria": "estudio", "subtareas": ["Ej. 1", "Ej. 2", "Ej. 3"] },
    { "tipo": "parcial", "fecha": "2026-11-20", "hora": "09:00", "titulo": "2do parcial" }
  ]
}
```

- Plan: `studyWorkflow: "plan"` y `version` (`1`, `2` o `3`) obligatorios; la skill debe emitir `3`. `titulo` y `materia` opcionales; `materia` es la default de los ítems.
- Ítem: `tipo`, `fecha` y `titulo` obligatorios; `hora`, `notas`, `materia`, `duracion`, `categoria` y `subtareas` opcionales (`materia` pisa la del plan).
- Hora local de Argentina. Los campos desconocidos se ignoran.

| Campo | Regla |
|---|---|
| `tipo` | `tarea`, `evento`, `parcial`, `recuperatorio` o `final` |
| `fecha` | `YYYY-MM-DD`, tiene que ser una fecha real |
| `hora` | `HH:MM`, 24 h |
| `titulo` | texto no vacío, hasta 120 caracteres |
| `duracion` | solo `tarea`: minutos, entero entre 1 y 1440 (número, no texto) |
| `categoria` | solo `tarea`: `tarea` (default), `entrega` o `estudio` |
| `subtareas` | solo `tarea`: lista de hasta 50 textos no vacíos de hasta 120 caracteres cada uno |
| `notas`, `materia` | texto |

`duracion`, `categoria` y `subtareas` se ignoran (sin error) en `evento`, `parcial`, `recuperatorio` y `final`.

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
- `Subtareas inválidas (lista de hasta 50 textos de hasta 120 caracteres).`
- `Las notas tienen que ser texto.` / `La materia tiene que ser texto.`

## Materias

Se matchean por nombre sin distinguir mayúsculas ni tildes. Si no existe, la vista previa ofrece crearla (con color) o asignar una existente. Nada se guarda sin confirmar.

## Duplicados

Un ítem es duplicado si coincide **fecha + título (sin mayúsculas ni tildes) + materia** con una tarea con fecha o un evento no repetitivo ya cargado, o con un ítem anterior del mismo plan. Los duplicados se marcan y se omiten por defecto (se pueden volver a tildar).

## Mapeo de tipos

- `tarea` → ítem del To-do con fecha (y hora, si hay), con su duración, categoría y subtareas (todas sin tildar).
- `evento`, `parcial`, `recuperatorio`, `final` → evento del Calendario con ese tipo.

## Cambios de v1 a v2

- `version` pasa a `2`. La app sigue leyendo planes con `version: 1`; si uno trae `duracion` o `categoria`, también se leen (es el mismo parser).
- Nuevo campo opcional `duracion` en los ítems `tarea`: minutos estimados, número entero entre 1 y 1440 (por ejemplo `45`; no `"45"` ni `45.5`).
- Nuevo campo opcional `categoria` en los ítems `tarea`: `"tarea"` (default si falta), `"entrega"` o `"estudio"`. Cualquier otro valor es un error del ítem.
- En `evento`, `parcial`, `recuperatorio` y `final`, `duracion` y `categoria` se ignoran.
- Todo lo demás (campos, reglas y mensajes de v1) queda igual.

## Cambios de v2 a v3

- `version` pasa a `3`. La app sigue leyendo planes con `version: 1` y `2`; si traen `subtareas`, también se leen (es el mismo parser).
- Nuevo campo opcional `subtareas` en los ítems `tarea`: lista de textos, uno por subtarea (por ejemplo `["1.2", "1.3", "4.5", "7.2"]`). Hasta 50, cada uno no vacío y de hasta 120 caracteres. Si no cumple, es un error del ítem.
- La tarea se crea con esas subtareas sin tildar. En las listas se ve solo la tarea principal con su progreso (`0/4`); tildarlas todas la completa.
- En `evento`, `parcial`, `recuperatorio` y `final`, `subtareas` se ignora.
- Los duplicados se siguen detectando por fecha + título + materia (las subtareas no cuentan).
- Todo lo demás queda igual.
