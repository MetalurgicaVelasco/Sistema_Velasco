# ROADMAP — Pendientes y mejoras

> Lista viva de mejoras y correcciones pendientes, organizadas por módulo. No es un
> plan cerrado ni tiene orden de prioridad fijo; se va tachando y reordenando.
> Última actualización: 08/07/2026.

## Tablero de planificación

- [ ] **Editar el modo (Manual / Semiautomático / Automático) desde el tablero.** Hoy
      el modo no se puede cambiar desde el modal de la actividad.
- [ ] **Bug — candado (🔒) no centrado en setups cortos.** En bloques con poco tiempo de
      setup, el ícono del candado del fantasma no queda centrado. En el sistema viejo
      no pasa; revisar cómo lo resolvía.
- [ ] **Reordenar operarios.** Poder cambiar el orden en que aparecen los operarios
      (las filas) en el tablero.
- [ ] **Imágenes faltantes.** Falta mostrar la foto del elemento en: los bloques de las
      actividades, los tooltips (hover) y el modal que se abre al clickear un bloque.
- [ ] **Estética de los botones "Marcar como hecho" / "Desanclar":** copiar la del
      sistema viejo (colores, forma). Hoy usan el estilo secundario genérico.

## Proyectos

- [ ] **Menú contextual en franja 3 (elementos):** clic derecho debe mostrar "Nuevo
      elemento".
- [ ] **Menú contextual en franja 2 (proyecto):** clic derecho sobre un proyecto debe
      mostrar "Editar" (lleva a la vista del proyecto para editarlo), manteniendo ademas
      el "Nuevo proyecto" que ya aparece.
- [ ] **Bug — breadcrumb saltea el proyecto.** Al entrar a un conjunto desde la vista de
      proyectos, el breadcrumb queda "Proyectos > Conjunto"; debería mostrar todos los
      niveles ("Proyectos > Proyecto > Conjunto > ..."), sin importar desde que vista se
      llegue.

## General / UI (transversal)

- [ ] **Modales — comportamiento uniforme.** Todos los modales deben: (a) poder moverse
      (arrastrar por el encabezado), (b) tener siempre la "x" para cerrar, y (c) **nunca**
      cerrarse al clickear fuera de ellos.
- [ ] **Desplegables — si cierran al clickear fuera.** Los desplegables de campos (selects,
      dropdowns) si deben cerrarse al clickear fuera (a diferencia de los modales).
- [ ] **Persistir la vista por modulo.** Cada modulo debe recordar la vista/estado donde
      se lo dejo la ultima vez, para poder saltar entre modulos sin perder el contexto ni
      tener que volver a navegar hasta donde se estaba.
