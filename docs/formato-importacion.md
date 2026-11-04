# Formato de importación de planes (v1)

Contrato con la skill de Claude que genera el JSON. **No se cambia sin subir `version` y avisar.** Lo implementa `modules/import/server/parser.ts`.

## Formato

```json
{
  "studyWorkflow": "plan",
  "version": 1,
  "titulo": "Preparación 2do parcial",
  "materia": "Álgebra",
  "items": [
    { "tipo": "tarea", "fecha": "2026-11-05", "titulo": "Guía 4: ej. 1 a 6", "notas": "Repasar teoría de autovalores antes" },
    { "tipo": "parcial", "fecha": "2026-11-20", "hora": "09:00", "titulo": "2do parcial" }
  ]
}
```

- Plan: `studyWorkflow: "plan"` y `version: 1` obligatorios. `titulo` y `materia` opcionales; `materia` es la default de los ítems.
- Ítem: `tipo`, `fecha` y `titulo` obligatorios; `hora`, `notas` y `materia` opcionales (`materia` pisa la del plan).
- Hora local de Argentina. Los campos desconocidos se ignoran.

| Campo | Regla |
|---|---|
| `tipo` | `tarea`, `evento`, `parcial`, `recuperatorio` o `final` |
| `fecha` | `YYYY-MM-DD`, tiene que ser una fecha real |
| `hora` | `HH:MM`, 24 h |
| `titulo` | texto no vacío, hasta 120 caracteres |
| `notas`, `materia` | texto |

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
- `Las notas tienen que ser texto.` / `La materia tiene que ser texto.`

## Materias

Se matchean por nombre sin distinguir mayúsculas ni tildes. Si no existe, la vista previa ofrece crearla (con color) o asignar una existente. Nada se guarda sin confirmar.

## Duplicados

Un ítem es duplicado si coincide **fecha + título (sin mayúsculas ni tildes) + materia** con una tarea con fecha o un evento no repetitivo ya cargado, o con un ítem anterior del mismo plan. Los duplicados se marcan y se omiten por defecto (se pueden volver a tildar).

## Mapeo de tipos

- `tarea` → ítem del To-do con fecha (y hora, si hay).
- `evento`, `parcial`, `recuperatorio`, `final` → evento del Calendario con ese tipo.
