# Formato de importación de fechas de finales (v1)

Contrato con la skill de Claude que convierte la captura de la facultad a JSON. **No se cambia sin subir `version`, seguir aceptando las anteriores y avisar.** Lo implementa `parseFinales` en `modules/finals/shared.ts`.

Se pega en **Finales → Importar fechas**. No se importa desde "Importar plan" ni desde el menú Compartir.

## Formato

```json
{
  "studyWorkflow": "finales",
  "version": 1,
  "materias": [
    {
      "materia": "Álgebra",
      "fechas": [
        { "fecha": "2026-12-03", "hora": "09:00" },
        { "fecha": "2026-12-10" }
      ]
    }
  ]
}
```

- `studyWorkflow: "finales"` y `version: 1` obligatorios.
- `materias`: lista no vacía. Cada una con `materia` (nombre o sigla) y `fechas` (todas las fechas posibles de esa materia).
- Hora local de Argentina. Los campos desconocidos se ignoran.

| Campo | Regla |
|---|---|
| `materia` | texto no vacío; conviene usar el nombre o la sigla tal como están en la app |
| `fecha` | `YYYY-MM-DD`, tiene que ser una fecha real |
| `hora` | opcional, `HH:MM`, 24 h; si la facultad no publica hora, no se pone |

Las fechas repetidas (misma fecha y hora) dentro de una materia se cuentan una sola vez.

## Texto alrededor

Se puede pegar el mensaje entero de Claude: se busca el primer objeto JSON con `"studyWorkflow": "finales"`, con o sin fences de markdown.

## Materias

Se matchean por **nombre o sigla**, sin distinguir mayúsculas ni tildes, contra las materias no archivadas. Si una no matchea, en la vista previa se elige a cuál corresponde o "No importar". No se crean materias desde acá: se crean en Ajustes.

## Qué hace al importar

**Reemplaza** todas las fechas posibles de las materias que vienen en el JSON. Las materias que no vienen no se tocan. No toca el calendario: los eventos `final` se crean recién al elegir una combinación.

## Mensajes de error

Generales (no se puede continuar):

- `No encontré fechas de finales en el texto pegado.`
- `Versión de finales no soportada (<v>). Actualizá la app.`
- `No hay materias en el texto pegado.`

Por materia (se muestran en la vista previa; las fechas válidas de esa materia igual se importan):

- `La materia no es un objeto.`
- `Falta el nombre de la materia.`
- `Fecha inválida (usar AAAA-MM-DD): "<x>".`
- `Hora inválida (usar HH:MM): "<x>".`
- `La materia no tiene fechas válidas.`
