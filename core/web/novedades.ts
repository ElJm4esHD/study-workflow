/** Novedades que muestra Ajustes › Acerca de › Novedades. Lo más nuevo primero; sumá una entrada por cada versión que cambie el uso. */
export type Novedad = { fecha: string; titulo: string; items: string[] };

export const NOVEDADES: Novedad[] = [
  { fecha: '15/11/2026', titulo: 'Pulido final', items: [
    'Fechas y horas se escriben rápido (5/11, hoy, mañana, 930) o se eligen en un calendario propio, que también anda con teclado y lector de pantalla.',
    'Borrar una tarea o un evento ya no pregunta: avisa y deja “Deshacer”.',
    'Si salís de una tarea o evento con cambios sin guardar, te avisa.',
    'Búsqueda global de tareas y eventos: tocá “/” o Ctrl+K en la compu, o “Buscar” en el menú Más del celu.',
    'Ajustes ordenado en secciones: pantalla de inicio, valores por defecto de tareas y recordatorios, color de acento, backup y “Acerca de”.',
    'Exportar e importar un backup completo en un archivo .json.',
    'Guía de primera vez para conectar el servidor, crear materias y cargar un plan.',
    'Las fechas se leen “Hoy”, “Mañana”, “En 3 días”, “Vencida hace 2 días”.',
    'Si el sistema pide reducir el movimiento, la app arranca sin animaciones.',
    'Ícono nuevo (con versión para íconos temáticos), la web se puede instalar como app de escritorio y la pestaña muestra el nombre de cada pantalla.',
    'Más rápida: la web baja comprimida y la vista Semana se carga solo cuando la abrís. Las listas largas muestran de a 30 tareas con “Mostrar más”.',
    'El widget de To-do usa el color de acento que elijas.',
  ] },
  { fecha: '14/11/2026', titulo: 'Pulido de la interfaz', items: [
    'Tema oscuro, tarjetas, animaciones con resortes y vibración con la intensidad que elijas.',
    'Subtareas que se tildan desde la lista.',
    'Widget de To-do con el estilo nuevo y botón + para crear.',
    'Deslizar entre secciones en el celu.',
  ] },
  { fecha: 'Antes', titulo: 'Lo primero', items: [
    'To-do, Calendario (mes y semana), Finales, importación de planes desde Claude y recordatorios que suenan en el celu.',
    'Funciona sin conexión en el APK: se pueden tildar tareas y se sincronizan al volver.',
  ] },
];
