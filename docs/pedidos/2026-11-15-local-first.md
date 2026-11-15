# Pedido: local-first con sincronización (etapa 1: mi server)

## Objetivo

Hoy mi server hace todo (guarda, valida y calcula) y la app es una pantalla que le pide los datos. Quiero invertirlo:

- **La app hace todo:** guarda los datos en el dispositivo y corre toda la lógica (validaciones, repeticiones del calendario, importación de planes y de finales, combinaciones de finales), en la web y en el APK.
- **El almacenamiento es solo un destino de sincronización**, elegible en Ajustes. En este pedido el único destino es **Mi servidor**. En un pedido posterior se va a sumar **Google Drive** (carpeta oculta de la app, scope `drive.appdata`) para que cualquiera pueda usar la app sin server.
- **Mi server queda simple:** recibe y entrega cambios; no calcula ni valida reglas de negocio.

## Requisitos

1. **Funciona entero sin conexión** en la web y en el APK: crear, editar, borrar, importar, todo. Se sincroniza al volver la red, al abrir la app y cada pocos minutos.
2. **Sincronización independiente del destino:** el algoritmo (detectar cambios, combinarlos, resolver conflictos) es uno solo. El destino ("Mi servidor" hoy, "Google Drive" después) es un adaptador chico con dos operaciones: "subí estos cambios" y "dame lo que cambió desde X". Diseñalo pensando en que Drive no tiene lógica del lado del servidor: tiene que poder implementarse solo con archivos.
3. **Conflictos:** gana el último cambio por registro. Definí cómo se ordenan los cambios sin depender de que los relojes de los dispositivos estén bien (por ejemplo, un reloj lógico híbrido).
4. **Borrados:** con marca de borrado (tombstone), para que un dispositivo que estuvo sin conexión no vuelva a subir algo borrado. Definí cuándo se limpian.
5. **Widget y recordatorios** leen los datos del dispositivo, no del server. Elegí el almacenamiento local de forma que el código nativo (Kotlin) del widget pueda leerlo y tildar.
6. **Arquitectura modular intacta:** cada módulo sigue siendo una carpeta; sus datos y su lógica se mudan con él. Actualizá `docs/modulos.md`.
7. **Mis skills no cambian:** los formatos de importación (`plan` v3 y `finales` v1) siguen iguales.
8. **Rendimiento:** el arranque y las listas tienen que seguir siendo rápidos.

## Migración de mis datos (crítico)

- Backup completo de mi base del server antes de tocar nada.
- Script de migración probado primero con una **copia** de mi base, con un reporte que compare cantidades (materias, tareas, subtareas, eventos, planes, finales, recordatorios) antes y después: tienen que coincidir.
- **Mi versión actual sigue deployada y andando** hasta que la nueva esté verificada. Proponé cómo: por ejemplo, la versión nueva en otro puerto o con una bandera, y el corte final con mi OK.
- Plan de vuelta atrás documentado.

## Decisiones ya tomadas

- Orden: primero local-first + mi server (este pedido); Google Drive en un pedido aparte, después.
- Web pública para otros: GitHub Pages, en el pedido de Drive. Mi web sigue en mi server.
- Arranca ahora.

## Cómo trabajar

Etapas, **frenando en cada una** con qué probar:

1. **Diseño** (sin código): almacenamiento local en web y APK (con justificación de cada dependencia), modelo de cambios y protocolo de sincronización, conflictos y borrados, cómo lee el widget, migración y cómo convive con la versión actual. Señalá los riesgos.
2. **Base:** almacenamiento local + motor de sincronización + adaptador "Mi servidor", con tests fuertes del motor (dos dispositivos, offline largo, ediciones simultáneas, borrados, cambios de reloj).
3. **Módulos:** mover la lógica de cada módulo a la app, de a uno, con un commit por módulo.
4. **Widget, recordatorios y APK** leyendo del dispositivo.
5. **Migración** de mis datos con la copia, verificación y corte final con mi OK.

Reglas: sin subagentes, una sola revisión al final de cada etapa, Context7 una vez por librería, respuestas cortas, versión nueva con su entrada en Novedades.
