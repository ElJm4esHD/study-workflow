# Checklist manual en el S25

Para repetir antes de dar por buena una versión. Marcá lo que anda y anotá lo que no.
Instalar: `npm run apk` y después `adb install -r dist\study-workflow.apk` (o pasarlo a mano, ver `android.md`).

## 1. Instalación e ícono
- [ ] El ícono del lanzador se ve nítido (casilla clara con tilde oscuro sobre fondo oscuro).
- [ ] Con "Íconos temáticos" activado (Fondo de pantalla y estilo), el ícono toma el color del tema.
- [ ] Al abrir la app, el splash es del mismo oscuro que la app (sin salto de color ni destello blanco).
- [ ] Barra de estado y barra de navegación oscuras, sin franjas de otro color; nada queda tapado por la cámara ni por la barra de gestos.

## 2. TalkBack (Ajustes › Accesibilidad › TalkBack)
- [ ] En Inicio y To-do, deslizar de a un elemento lee en orden lógico: título, tarjeta, tareas.
- [ ] Cada tarea dice "Completar: …" y, al tocarla dos veces, cambia a "pulsado"/"no pulsado".
- [ ] En Calendario (mes), cada día dice el día, la fecha y qué hay ("martes 17/11: parcial de …, 2 tareas").
- [ ] Nueva tarea: los campos dicen su nombre (Título, Fecha, Hora…). Escribir `930` en Hora lo deja en 09:30.
- [ ] El botón del calendario de Fecha abre el selector; se recorre día por día y cada uno dice "martes 17 de noviembre de 2026".
- [ ] "Deshacer" después de borrar se anuncia y se puede tocar.
- [ ] Si falla la sincronización, el aviso de arriba ("Sin conexión…" / "N cambios sin subir") se anuncia solo.
- [ ] La búsqueda (Más › Buscar) anuncia "N resultados".

## 3. Letra grande
- [ ] Ajustes › Pantalla › Tamaño de letra al máximo: Inicio, To-do, Calendario, una tarea y Ajustes se leen sin cortes ni superposiciones.
- [ ] Lo mismo con el ajuste "Grande" de la app (Ajustes › Apariencia) y la letra del sistema al máximo a la vez.
- [ ] La barra de abajo no pisa los rótulos (pueden cortarse con "…").

## 4. Teclado y formularios
- [ ] Al tocar Título, Fecha, Hora o Notas, el teclado no tapa el campo y la barra de abajo se esconde.
- [ ] Fecha: `5/11`, `hoy`, `mañana` y `0511` se entienden. Hora: `9`, `930`, `21` se entienden.
- [ ] Editar una tarea y apretar Atrás: pregunta "¿Salir sin guardar?".
- [ ] Tocar Guardar dos veces seguidas crea una sola tarea.

## 5. Modo avión
- [ ] Con red: abrir Inicio, To-do y Calendario. Activar modo avión.
- [ ] Arriba aparece un aviso de sincronización (sin red); la app sigue andando entera.
- [ ] Crear, editar, borrar y tildar tareas y eventos, e importar un plan: todo anda.
- [ ] El widget (si está puesto) refleja esos cambios al instante, también en modo avión.
- [ ] Desactivar modo avión: el aviso desaparece y los cambios se sincronizan (verlos en la compu).

## 6. Recordatorios
- [ ] Ajustes › Recordatorios › Probar sonido: aparece la notificación y suena (con el celu en silencio también, es sonido de alarma).
- [ ] Una tarea con fecha de hoy y recordatorio "A la hora" (dentro de 2 minutos) suena a tiempo con la app cerrada.
- [ ] "Insistente": sigue sonando hasta bajar la notificación.
- [ ] Tildar la tarea antes de la hora cancela el recordatorio.
- [ ] Reiniciar el celu y comprobar que un recordatorio futuro sigue programado.

## 7. Widget
- [ ] El widget de To-do muestra las tareas de hoy con la barra de color de la materia.
- [ ] Tildar una tarea en el widget la completa (y se ve en la app).
- [ ] El botón + abre "Nueva tarea".
- [ ] Cambiar el color de acento en Ajustes › Apariencia cambia el contador y el + del widget (puede tardar unos segundos).
- [ ] Sin conexión, el widget sigue mostrando todo y deja tildar; el tilde se ve en la app al abrirla y sube solo al volver la red.
- [ ] Tildar en el widget una tarea con recordatorio cancela el recordatorio.
- [ ] Cambiar algo en la compu: el widget lo muestra después del sync de fondo (o al abrir la app).
- [ ] Con el tema Claro, el widget se ve claro; con "Según el sistema", cambia al pasar el celu de claro a oscuro.

## 7 bis. Tema
- [ ] Ajustes › Apariencia › Tema › Claro: toda la app pasa a claro, la barra de estado tiene íconos oscuros.
- [ ] Cerrar la app y abrirla: el splash sale claro, sin destello oscuro.
- [ ] "Según el sistema" sigue al modo del celu (Ajustes rápidos › Modo oscuro) sin reiniciar la app.
- [ ] Volver a Oscuro: todo vuelve, splash incluido.

## 8. Gestos
- [ ] Deslizar de izquierda a derecha entre Inicio, To-do y Calendario cambia de sección.
- [ ] En el mes del calendario, deslizar cambia de mes (no de sección).
- [ ] En Semana, deslizar mueve de a 3 días; tocar un hueco muestra "+ HH:MM" y al tocarlo abre Nuevo evento con fecha y hora.
- [ ] En Semana, tildar una tarea desde la grilla o desde "Todo el día".
- [ ] Tirar hacia abajo desde arriba refresca.
- [ ] Mantener apretada una tarea y moverla la reordena (solo las que no tienen hora).
- [ ] Atrás: desde una tarea vuelve a la lista; desde una pantalla principal minimiza la app.
- [ ] Con "Reducir movimiento" o "Sin animaciones" no hay animaciones ni inercia en las hojas.

## 9. Datos
- [ ] Ajustes › Datos › Exportar abre el navegador y baja `study-workflow-AAAA-MM-DD.json`.
- [ ] (Solo si querés probar el ciclo completo) Importar ese archivo en una base de pruebas: reemplaza todo y la app recarga.
- [ ] Sincronizar ahora (Ajustes › Datos): muestra "Sincronizado hace instantes" y, con la compu, aparecen los cambios de la otra.
- [ ] Exportar e importar usan el formato v2 (solo registros); un backup 1.x no se acepta (se convierte en la migración).
