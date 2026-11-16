/** Novedades que muestra Ajustes › Acerca de › Novedades. Lo más nuevo primero; cada pedido sube la versión de package.json y suma su entrada acá (un test verifica que coincidan). */
export type Novedad = { version: string; fecha: string; titulo: string; items: string[] };

export const NOVEDADES: Novedad[] = [
  { version: '2.0.0', fecha: '16/11/2026', titulo: 'La app funciona sola', items: [
    'Todo vive en tu dispositivo: crear, editar, borrar e importar andan sin conexión, en la web y en el celu. El servidor solo sincroniza.',
    'Se sincroniza al abrir, al volver la red, cada 5 minutos y al instante después de cada cambio. Si dos dispositivos tocan lo mismo, gana el cambio más nuevo.',
    'El widget y los recordatorios leen los datos del celu: andan sin conexión y se actualizan solos con lo que cambiás en la compu.',
    'Ajustes › Datos muestra el estado de la sincronización; el backup nuevo (versión 2) se exporta e importa ahí.',
    'Tus datos de la versión 1.x se migraron con un conversor que verifica que no se pierda nada.',
  ] },
  { version: '2.0.0-beta.5', fecha: '15/11/2026', titulo: 'Migración de tus datos (prueba)', items: [
    'Conversor de tus datos de la versión 1.x a la 2.0, con informe de cantidades antes y después y vuelta atrás.',
    'La versión de prueba se instala y se deploya al lado de la real (otro contenedor, puerto y datos) y no la toca.',
  ] },
  { version: '2.0.0-beta.4', fecha: '15/11/2026', titulo: 'Widget y recordatorios desde el celu (prueba)', items: [
    'El widget y los recordatorios leen los datos guardados en el celu: andan sin conexión y se actualizan al instante con lo que hacés en la app.',
    'Tildar en el widget se guarda al toque y sube solo cuando hay conexión; si la misma tarea cambió en otro dispositivo, gana el cambio más nuevo.',
    'Los cambios de la compu llegan al widget y a las alarmas en segundo plano.',
  ] },
  { version: '2.0.0-beta.3', fecha: '15/11/2026', titulo: 'La app funciona sola (prueba)', items: [
    'Los datos y la lógica de todos los módulos ahora viven en el dispositivo: crear, editar, borrar e importar andan sin conexión, en la web y en el celu.',
    'El servidor solo guarda y entrega cambios. Se sincroniza al abrir, al volver la red, cada 5 minutos y 2 segundos después de cada cambio; si dos dispositivos tocan lo mismo gana el cambio más nuevo.',
    'Ajustes › Datos muestra el estado de la sincronización y permite sincronizar ahora. El backup nuevo (versión 2) se exporta e importa desde ahí.',
    'Versión de prueba: el widget y los recordatorios del celu todavía leen del servidor viejo; se pasan al dispositivo en el próximo paso.',
  ] },
  { version: '2.0.0-beta.2', fecha: '15/11/2026', titulo: 'Base de sincronización (prueba)', items: [
    'Primer paso de la app que funciona sin conexión y sincroniza con tu servidor: motor de sincronización, almacenamiento local y las rutas nuevas del servidor. Todavía no cambia nada de lo que ves.',
  ] },
  { version: '1.1.1', fecha: '15/11/2026', titulo: 'Código abierto', items: [
    'El proyecto está en GitHub con licencia AGPL-3.0, README nuevo y capturas con datos de ejemplo.',
    'La dirección del servidor que trae el APK sale de tu .env.deploy al compilarlo.',
  ] },
  { version: '1.1.0', fecha: '15/11/2026', titulo: 'Tema claro, Semana y Finales nuevos', items: [
    'Tema claro, oscuro o según el sistema (Ajustes › Apariencia). El widget y la pantalla de arranque del celu lo siguen.',
    'Vista Semana nueva: grilla horaria limpia con el color de cada materia, exámenes destacados, tareas sin hora arriba y la hora actual marcada. En el celu muestra 3 días y se desliza; tocá un hueco para crear un evento a esa hora.',
    'Finales rediseñado: elegís qué rendís, cargás las fechas en una fila por materia y ves la mejor combinación en un mini calendario; las demás muestran solo lo que cambia.',
    'Versiones: Ajustes › Acerca de muestra la versión de la app con su fecha y la del servidor.',
  ] },
  { version: '1.0.1', fecha: '15/11/2026', titulo: 'Semana más prolija', items: [
    'En la vista Semana cada tarea ocupa una línea y lo que no entra se ve con “+N más”.',
  ] },
  { version: '1.0.0', fecha: '15/11/2026', titulo: 'Pulido final', items: [
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
  { version: '0.7.0', fecha: '14/11/2026', titulo: 'Pulido de la interfaz', items: [
    'Tema oscuro, tarjetas, animaciones con resortes y vibración con la intensidad que elijas.',
    'Subtareas que se tildan desde la lista.',
    'Widget de To-do con el estilo nuevo y botón + para crear.',
    'Deslizar entre secciones en el celu.',
  ] },
  { version: '0.6.0', fecha: '14/11/2026', titulo: 'Finales, subtareas y recordatorios', items: [
    'Planificador de finales: cargás las fechas posibles de cada materia (a mano o pegando lo que arma Claude), ves las combinaciones y al elegir una se crean los finales en el calendario.',
    'Subtareas dentro de una tarea; al tildarlas todas se completa la principal.',
    'Recordatorios que suenan en el celu para tareas y eventos, con opción insistente.',
    'Arreglos del APK: sin barra negra arriba, el botón Atrás vuelve a la pantalla anterior y los títulos largos usan dos líneas.',
  ] },
  { version: '0.5.0', fecha: '06/11/2026', titulo: 'Widget en el celu', items: [
    'Widget de To-do en la pantalla de inicio: muestra tus tareas y las tildás sin abrir la app, aun sin conexión.',
  ] },
  { version: '0.4.0', fecha: '05/11/2026', titulo: 'App para el celu', items: [
    'App para Android que se conecta a tu servidor.',
    'Sin conexión ves la última copia y podés tildar tareas; se sincronizan al volver.',
    'Compartir un plan desde Claude a la app lo abre directo en Importar.',
  ] },
  { version: '0.3.0', fecha: '05/11/2026', titulo: 'Diseño nuevo', items: [
    'Tema oscuro con tarjetas y una pantalla de Inicio con lo de hoy, el próximo examen y los próximos 7 días.',
    'Materias con sigla y color pastel.',
    'Tareas con duración estimada y categoría (tarea, entrega o estudio), también al importar planes.',
    'Calendario Mes con chips por materia y el detalle del día.',
  ] },
  { version: '0.2.0', fecha: '05/11/2026', titulo: 'Calendario', items: [
    'Calendario con vista Mes y Semana: eventos, parciales, recuperatorios y finales.',
    'Eventos que se repiten cada semana, como las clases.',
    'Las tareas con fecha también aparecen en el calendario.',
  ] },
  { version: '0.1.0', fecha: '04/11/2026', titulo: 'Primera versión', items: [
    'To-do con fecha, hora y materia, y vistas Hoy, Próximas y Sin fecha.',
    'Materias con nombre y color.',
    'Importar un plan de estudio armado con Claude: pegás el texto, ves la vista previa y se cargan las tareas y los exámenes.',
    'Corre en tu servidor y se abre desde cualquier equipo de tu red Tailscale.',
  ] },
];
