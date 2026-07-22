# ROADMAP — Pendientes y mejoras

> Lista viva de mejoras y correcciones pendientes, organizadas por módulo. No es un
> plan cerrado ni tiene orden de prioridad fijo; se va tachando y reordenando.
> Última actualización: 08/07/2026.

## Tablero de planificación

- [x] ~~Imágenes en bloques, tooltips y modales~~ (heredando la del padre si el elemento
      no tiene foto propia).
- [x] ~~Editar el modo (Manual / Semi / Automática) desde el modal de actividad.~~
- [x] ~~Reordenar operarios~~ (botón "⇄ Orden" en la barra → modal con arrastre y flechas).
- [x] ~~Bug — candado (🔒) no centrado en setups cortos.~~ Faltaba `justify-content:center`
      en el fantasma del setup.
- [x] ~~Estética de los botones "Marcar como hecho" / "Desanclar".~~ Copiados del viejo
      (verde y ámbar, con ✓ y 🔓).
- [ ] **Velocidad (mejora de fondo).** Hoy cada acción relee todo el tablero de la base
      (~4 round-trips). La solución de fondo es actualizar el estado en memoria en vez
      de releer. Se pospuso: con la carga paralelizada quedó aceptable.

## Ideas a futuro (sin fecha)

- [ ] **Navegación como panel lateral izquierdo.** Reemplazar la barra superior por un
      panel a la izquierda: se ven las secciones y, al clickear una, se despliegan sus
      módulos anidados debajo. Gana espacio vertical, clave para el tablero.
- [ ] **Zoom del tablero.** Para ver más o menos días/horas según haga falta.
- [ ] **Vista de solo lectura para proyectar** (el tablero en pantalla grande, sin
      posibilidad de editar).

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
- [ ] **Filtros sin tildes en la base (`unaccent`).** Hoy los filtros de texto que cruzan
      tablas potencialmente grandes (descripción de proyecto / item) ignoran tildes
      filtrando **client-side** (traen la lista y comparan con `contiene()` de
      `shared/lib/texto`). Anda perfecto a la escala actual. A futuro, cuando `proyectos`
      o `elementos` crezcan mucho, conviene pasarlo a la base para volver a filtrar en el
      servidor: extensión `unaccent` + función inmutable `f_unaccent` + columnas generadas
      `descripcion_norm` (lower + sin tildes) con índice, y filtrar sobre esas columnas.
