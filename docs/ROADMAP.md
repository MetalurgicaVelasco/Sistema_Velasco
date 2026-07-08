# ROADMAP — Pendientes y mejoras

> Lista viva de mejoras y correcciones pendientes, organizadas por módulo. No es un
> plan cerrado ni tiene orden de prioridad fijo; se va tachando y reordenando.
> Última actualización: 08/07/2026.

## Tablero de planificación

- [ ] **Imágenes faltantes.** Falta mostrar la foto del elemento en: los bloques de las
      actividades, los tooltips (hover) y el modal que se abre al clickear un bloque.
      <- en curso.
- [ ] **Editar el modo (Manual / Semiautomático / Automático) desde el tablero.** Hoy
      el modo no se puede cambiar desde el modal de la actividad.
- [ ] **Reordenar operarios.** Poder cambiar el orden en que aparecen los operarios
      (las filas) en el tablero.
- [ ] **Bug — candado (🔒) no centrado en setups cortos.** En bloques con poco tiempo de
      setup, el ícono del candado del fantasma no queda centrado. En el sistema viejo
      no pasa; revisar cómo lo resolvía.
- [ ] **Estética de los botones "Marcar como hecho" / "Desanclar":** copiar la del
      sistema viejo (colores, forma). Hoy usan el estilo secundario genérico.
- [ ] **Velocidad (mejora de fondo).** Hoy cada acción relee todo el tablero de la base
      (~4 round-trips). La solución de fondo es actualizar el estado en memoria en vez
      de releer. Se pospuso: con la carga paralelizada quedó aceptable.

## Proyectos

- [x] ~~Menú contextual en franja 3 (elementos): "Nuevo elemento".~~ Hecho, con submenú
      anidado para crear en cualquier ancestro.
- [x] ~~Menú contextual en franja 2 (proyecto): "Editar".~~ Hecho.
- [x] ~~Bug — breadcrumb saltea el proyecto.~~ Hecho: muestra todos los niveles.
- [x] ~~Editar los datos del elemento actual~~ (botón "Editar datos" en su encabezado).
- [x] ~~Restricción de tipos según el nivel~~ (conjunto solo en la raíz; un componente
      no admite hijos).

## General / UI (transversal)

- [x] ~~Modales — comportamiento uniforme~~ (movibles, × siempre, no cierran al clic
      afuera). Los 5 modales que faltaban migraron al `Modal` compartido.
- [x] ~~Desplegables — sí cierran al clic afuera.~~ Hecho.
- [x] ~~Persistir la vista por módulo.~~ Hecho en Proyectos (filtros + selecciones) vía
      `shared/lib/vistaModulos.ts`; el mismo mecanismo sirve para otros módulos.
      Además, Proyectos arranca filtrado en estado "Pedido".
