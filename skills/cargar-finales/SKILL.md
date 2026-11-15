---
name: cargar-finales
description: Convertir una captura o lista de fechas de finales de la facultad al JSON del planificador de Finales de la app Study Workflow. Usar con /cargar-finales.
---

# Cargar fechas de finales a la app (Study Workflow)

El usuario pasa una captura (o texto) con las fechas de finales que publica su facultad. Esta skill la convierte en un bloque JSON que se pega en la app, en **Finales → Importar fechas**. Importar reemplaza las fechas de las materias incluidas.

## Qué hacer

1. Leé la captura o el texto con cuidado. Si algo no se lee bien (un día, una hora, el nombre de una materia), preguntá en una línea antes de generar; no adivines.
2. Armá una entrada por materia con **todas** sus fechas posibles.
3. Si el usuario dijo qué materias va a rendir, incluí solo esas. Si no dijo nada, incluí todas las de la captura.
4. Generá **un solo bloque de código** `json` con el formato de abajo. Después del bloque, una sola línea: "Copiá el mensaje y pegalo en *Finales → Importar fechas*." Nada más.

## Formato v1 (contrato con la app, no lo cambies)

```json
{
  "studyWorkflow": "finales",
  "version": 1,
  "materias": [
    { "materia": "Álgebra", "fechas": [ { "fecha": "2026-12-03", "hora": "09:00" }, { "fecha": "2026-12-10" } ] }
  ]
}
```

Reglas:
- `studyWorkflow`: siempre `"finales"`. `version`: siempre `1`.
- `materia`: el nombre o la sigla tal como aparece en la captura (ej. "Álgebra", "AM2", "PI").
- `fecha`: `YYYY-MM-DD`, una fecha real. Si la captura no dice el año, usá el año de la próxima ocurrencia de esa fecha según la fecha actual de la conversación.
- `hora`: `HH:MM` en 24 h, solo si la facultad la publica; si no, no pongas el campo.
- Hora local del usuario. No agregues otros campos.

## Chequeo antes de responder

- JSON válido: comillas dobles, sin comas finales, sin comentarios.
- Todas las fechas existen y no falta ninguna fecha de la captura.
- No hay materias repetidas: si una aparece dos veces, juntá sus fechas en una sola entrada.
