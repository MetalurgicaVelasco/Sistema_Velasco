# ROADMAP — Pendientes y mejoras

> Lista viva de mejoras y correcciones pendientes, organizadas por módulo. No es un
> plan cerrado ni tiene orden de prioridad fijo; se va tachando y reordenando.
> Última actualización: 11/08/2026.

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
- [x] ~~Vista general del proyecto~~ (doble clic en la fila): encabezado con estado, aviso
      de pedido faltante, columna de cantidad remitida y barra de acciones.
- [x] ~~Duplicar proyecto~~ (copia profunda: elementos, procesos y correlatividades, con
      pedido vacío y avance reseteado).
- [x] ~~✉ Copiar mail~~ (mismo formato que el viejo, al portapapeles con formato).
- [x] ~~🏷 Etiqueta de envío~~ (media hoja A4, logo desde `public/`).
- [x] ~~Notas del proyecto~~ (tabla con autor, fecha de creación y de modificación; solo
      el autor edita, con RLS).
- [x] ~~Franja 4 (Enlazados)~~: solapas Notas del Proyecto y Remitos y NdE funcionales;
      Presupuestos, Órdenes de Compra, Compras y Recepciones quedan como esqueleto.

## Documentos de envío

- [x] ~~Notas de envío y remitos~~ (modelo, generación, edición y borrado; cantidad
      remitida derivada). Ver `ARQUITECTURA.md` §15.
- [x] ~~Solapa "Remitos y NdE"~~ en Empresas y en la franja 4 de Proyectos.
- [x] ~~Aviso de remito incompleto~~ al cerrar un proyecto.

## Actividades del operario

- [x] ~~Identidad~~: vínculo usuario ↔ persona y marca de supervisor.
- [x] ~~Lista del día~~ con navegación por fecha y aviso de atrasadas.
- [x] ~~Orden de trabajo digital + cronómetro~~ con pausas motivadas, finalizar y reabrir.
- [x] ~~Carpeta digital completa del ítem~~ (portada, lista de procesos y una OT por
      proceso, con lo que registró cada operario).
- [x] ~~Corregir horarios y agregar/borrar tramos.~~
- [x] ~~Tilde verde en el tablero~~ para lo terminado por un operario; esos procesos son
      ancla del motor de cascada.
- [ ] **Corte automático al fin de la jornada.** Si el operario se olvida de finalizar, el
      contador queda corriendo toda la noche. Cortar el conteo al fin de su horario y dejar
      la actividad marcada como "sin cerrar" para que la complete al día siguiente.
- [ ] **Tablero real** (ver `ARQUITECTURA.md` §16.4): segunda vista del tablero dibujada a
      partir de los tramos, solo lectura, con pausas e interrupciones. Interruptor
      "Planificado / Real" en el tablero, y también una vista dentro de la sección
      Actividades.
- [ ] **Actividades agrupadas.** Varios ítems con el mismo proceso se ejecutan juntos: una
      sola sección de tiempos para el grupo y, al terminar, un reparto estimado del tiempo
      por ítem (con default proporcional a las cantidades y botón "completar" que ajusta el
      resto). Agrupar desde el tablero, admitiendo ítems de proyectos distintos.
- [ ] **Actividad rápida sin proyecto** (urgencias): el supervisor crea una actividad con
      los datos mínimos para que el operario registre, y después se reemplaza por el
      proceso real. Falta definir la dinámica del reemplazo.
- [ ] **Dos operarios en una misma actividad.** Poco frecuente pero real; cambia el modelo
      de fondo (hoy una actividad tiene un solo operario).
- [ ] **Línea temporal real del trabajo** del operario (más allá de los tramos por
      actividad).

## Calidad

- [ ] **Tests de lo nuevo.** Hoy hay 151 tests, pero la carpeta digital, la galería de
      fotos y los documentos de envío entraron sin cobertura. El cálculo de tiempos sí
      tiene tests (15), que era el punto de mayor riesgo.

## General / UI (transversal)

- [x] ~~Modales — comportamiento uniforme~~ (movibles, × siempre, no cierran al clic
      afuera). Los 5 modales que faltaban migraron al `Modal` compartido.
- [x] ~~Desplegables — sí cierran al clic afuera.~~ Hecho.
- [x] ~~Persistir la vista por módulo.~~ Hecho en Proyectos (filtros + selecciones) vía
      `shared/lib/vistaModulos.ts`; el mismo mecanismo sirve para otros módulos.
      Además, Proyectos arranca filtrado en estado "Pedido".
- [x] ~~Volver a un módulo sin espera.~~ Cada sección recuerda su último módulo y los
      módulos ya visitados quedan montados (ocultos) en vez de desmontarse. El Tablero
      queda afuera a propósito: se recarga cada vez.
- [x] ~~Columnas configurables~~ (mostrar/ocultar, ancho, orden y posición, persistidas por
      usuario) vía `TablaConfigurable` + `useConfigTabla`.
- [x] ~~Sacar los diálogos del navegador.~~ `window.confirm/alert/prompt` reemplazados por
      `ModalConfirmar` y `ModalPrompt` en todo el sistema.
- [x] ~~Code splitting.~~ Cada módulo se descarga al entrar; las librerías van en un chunk
      aparte.
- [x] ~~Fotos múltiples~~ (10 por proyecto, 5 por elemento) con galería compacta y visor
      con flechas en la actividad y la carpeta. Ver `ARQUITECTURA.md` §17.
- [ ] **Resaltado de la barra al saltar por un enlazado.** Al navegar de un módulo a otro
      por un concepto enlazado, el contenido cambia pero la barra sigue marcando la sección
      y el módulo anteriores. Se arregla pasándole la selección desde `App`.
- [ ] **Filtros sin tildes en la base (`unaccent`).** Hoy los filtros de texto que cruzan
      tablas potencialmente grandes (descripción de proyecto / item) ignoran tildes
      filtrando **client-side** (traen la lista y comparan con `contiene()` de
      `shared/lib/texto`). Anda perfecto a la escala actual. A futuro, cuando `proyectos`
      o `elementos` crezcan mucho, conviene pasarlo a la base para volver a filtrar en el
      servidor: extensión `unaccent` + función inmutable `f_unaccent` + columnas generadas
      `descripcion_norm` (lower + sin tildes) con índice, y filtrar sobre esas columnas.
