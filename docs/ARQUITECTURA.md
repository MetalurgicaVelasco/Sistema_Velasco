# ARQUITECTURA — Sistema Velasco (React)

> Documento vivo. Recoge las decisiones de arquitectura tomadas para la reescritura
> en React del sistema interno de Metalúrgica Velasco. Se actualiza a medida que se
> definen cosas nuevas.
>
> Última actualización: 01/07/2026 (agregadas §8.3 procesos e items, §14 estándar de
> modales y §15 paleta de botones; notas en §5 sobre acciones en franja 2 y la vista
> dedicada del item)

---

## 1. Stack técnico

| Capa | Tecnología |
|---|---|
| UI / framework | React + Vite |
| Lenguaje | TypeScript |
| Backend / base de datos | Supabase (PostgreSQL) vía cliente Supabase |
| Hosting | Vercel (auto-deploy desde GitHub) |
| Repositorio | GitHub |

**No se usa Next.js**: la app es interna, detrás de login, sin necesidad de SSR ni SEO.
React + Vite es lo apropiado.

**Flujo de deploy:** se programa local (o con Claude Code) → `git push` a GitHub →
Vercel detecta el push, corre el build y publica automáticamente.

---

## 2. Cuentas

Todas con mail de la empresa, salvo Claude (cuenta personal de Tomi).

| Servicio | Detalle |
|---|---|
| GitHub | Repo `Sistema_Velasco` (org `MetalurgicaVelasco`), privado |
| Supabase | Proyecto "Sistema Velasco", región South America (São Paulo) — **base nueva** |
| Vercel | Proyecto `sistema-velasco`, conectado al repo |

La contraseña de Postgres de Supabase queda guardada en lugar seguro (se usa solo para
conexiones externas tipo DBeaver/TablePlus o migraciones masivas, no en el día a día).

---

## 3. Principios de diseño

1. **Una sola app unificada.** Proyectos + Tablero + Matriz + Recursos, etc., todo en
   una misma aplicación React con navegación interna. Sin saltos entre páginas separadas
   (a diferencia del HTML actual, que tenía `proyectos.html` y `tablero_operarios.html`
   por separado).
2. **Reescritura desde cero, no migración línea por línea.** Se repiensa por componentes.
   El HTML actual queda como referencia funcional mientras se construye React.
3. **App interna y futuro Portal de Clientes serán dos apps separadas** sobre el mismo
   Supabase, aisladas por Row Level Security (RLS).
4. **Base de datos nueva.** Arranca limpia con la arquitectura nueva. Se migran solo
   "datos maestros" (empresas, contactos, máquinas, materiales, matriz de productos);
   los proyectos viejos se migran al final, antes del switch definitivo.
5. **Modelo de dominio propio + capa adaptadora (principio fundacional).** La app modela
   **el negocio del taller**, no los conceptos de ningún sistema externo. Nuestro idioma
   (Proyecto, Item, Proceso, estados como "Solicitud"/"Cotizado"/"Confirmado", etc.) lo
   define cómo trabaja Velasco, no cómo lo llama TacticaSoft, Oppen u Odoo. Toda
   integración con un sistema externo pasa por una **capa traductora (adaptador /
   anticorrupción)** que mapea los conceptos del ERP a los nuestros. La app nunca conoce
   el vocabulario del ERP; solo el adaptador lo conoce.
   - Cambiar de ERP = reescribir **un adaptador**, no la app.
   - El mapeo no siempre es 1:1 (un "Pedido" nuestro puede ser 2 entidades en otro ERP, o
     al revés). Esa fricción es trabajo real, pero queda **contenida en el adaptador**.
   - **Modelo de dos sistemas:** la parte administrativa/comercial/fiscal puede vivir en un
     ERP con API abierta (candidato: Oppen, cuando se migre de Táctica); la parte operativa
     (proyectos, tablero, procesos, planificación) es esta app, porque ningún ERP
     generalista resuelve bien la producción de un taller a medida. Se conectan por API a
     través del adaptador.
   - Hoy TacticaSoft no expone una API abierta (solo conectores cerrados a plataformas
     puntuales). La extracción realista de datos hoy es exportación periódica a CSV/Excel +
     import (mismo canal que ya se usa para Power BI). Confirmar con el proveedor si existe
     API/acceso a base no publicado.

---

## 4. Convenciones de base de datos

- Tablas en **plural** (`personal`, `empresas`, `proyectos`).
- Foreign keys en **singular** (`empresa_id`, `personal_id`).
- Tablas auxiliares con **prefijo de módulo** (`personal_vacaciones`, `empresa_contactos`).

### Renombres respecto del sistema viejo

| Tabla vieja | Tabla nueva |
|---|---|
| `operarios` | `personal` |
| `actividades_tablero` | `procesos` |
| `clientes` | `empresas` |

`empresas` modela una entidad que puede ser cliente, proveedor o ambos
(campos `es_cliente` / `es_proveedor`, más `es_transporte`).

---

## 5. Estructura de la interfaz — vista tipo TácticaSoft

Vista principal de los módulos: **4 franjas horizontales apiladas** (cada una ocupa el
ancho completo de la pantalla y una fracción de la altura), de arriba hacia abajo. Alturas
de referencia (se afinan al maquetar; alguna franja podría volverse ajustable/colapsable):

| Franja | Contenido | Altura aprox. |
|---|---|---|
| 1 | **Filtros** | 15% |
| 2 | **Lista** (ej: proyectos) | 35% |
| 3 | **Detalle** del seleccionado | 35% |
| 4 | **Enlazados** | 15% |

- **Franja 1 — Filtros:** muchos campos de filtro (los que hoy existen en la vista de
  proyectos del HTML).
- **Franja 2 — Lista:** los registros que cumplen los filtros. Columnas (ej. Proyectos):
  Nº Proyecto, Nº Pedido, Cliente, Descripción, Estado, Fecha Creación, Plazo de Entrega,
  Moneda, Importe, OC Cliente, Contacto, Responsable, Creado por, IVA, Notas. **Las
  acciones del registro (Editar / Borrar) viven en esta franja** (en la fila del
  registro), no en el detalle, para no confundirlas con la edición de los items del
  detalle.
- **Franja 3 — Detalle:** los items del registro seleccionado. Columnas (ej.): Nº Item,
  Tipo, Cant. Pedida, Cant. Remitida, Descripción, Estado, Plazo, Urgencia, Fecha Remitido,
  Código de Matriz, Sector, Equipo, Stock disponible, Stock en producción, y el conteo
  **"N proceso(s)"** por item.
  - **Despliegue según sección** (un mismo módulo se ve distinto según dónde se mira):
    - En **Ventas**, los items se ven **planos** (las filas tal cual, sin explotar). A
      Ventas le importa qué se vende, no la estructura de fabricación.
    - En **Producción**, la franja **sí permite explotar** la jerarquía: conjunto →
      subconjuntos anidados (a cualquier profundidad) → productos → procesos.
  - Política de uso: ser estrictos y no pasar de **1 nivel de subconjunto** en la práctica,
    aunque el modelo recursivo (§8) soporte más si aparecen.
  - **Vista dedicada del item:** doble click (o el botón **Editar**) en una fila de item
    abre una **vista a módulo completo** con el encabezado del item (foto, cliente,
    pedido, cantidad, etc.) y sus **procesos** (ver §8.3). Los procesos NO se editan dentro
    del form del proyecto, sino en esta vista, sobre un item ya guardado.
- **Franja 4 — Enlazados:** pestañas con los conceptos vinculados al registro seleccionado
  (Presupuestos, Pedidos, Facturas, Remitos, Recibos, Órdenes de Compra, Compras, Pagos,
  Recepciones, Logística, etc.). Cada pestaña lista los conceptos de ese tipo enlazados al
  registro.

### Navegación encadenada por enlazados

Gesto central del sistema: **doble click en un concepto enlazado** →
1. lleva a su **módulo nativo**,
2. **limpia todos los filtros** previos,
3. aplica el filtro del **identificador** de ese concepto, para que quede solo ese.

Desde ahí, sus propios enlazados aparecen en la franja 4, y se puede volver a saltar.
Ejemplo: Proyecto → (doble click en una OC) → Compras > Órdenes de Compra filtrado por esa
OC → (doble click en su pago) → Compras > Pagos filtrado por ese pago. Se "viaja" por la
red de conceptos enlazados, siempre con el mismo gesto.

Otras interacciones:
- **Click derecho**: acciones contextuales.
- **Tooltips** en las franjas de lista y detalle.

---

## 6. Secciones y módulos

El sistema se organiza en **secciones** que agrupan **módulos**. Un mismo módulo puede
aparecer en varias secciones con distinta configuración (ej: Pedidos muestra importes en
Ventas, pero no en Producción).

### Mapa completo (esqueleto prototipo)

- **Ventas:** Solicitudes, Presupuestos, Pedidos, Facturas, Remitos, Recibos (con
  comprobante adjunto), Dashboard.
- **Compras:** Órdenes de Compra, Compras, Pagos (CCA), Recepción, Recibos Proveedor,
  Dashboard.
- **Empresas:** Empresas, Sectores/Equipos, Contactos, Transportes (en duda), Dashboard.
- **Inventarios:** Matriz de Productos, Stock (la matriz, solo con productos configurados
  para controlar stock), Depósitos, Movimientos, Reservas, Materiales, Dashboard.
- **RRHH:** Personal, Vacaciones, Asistencia, Liquidaciones, Dashboard.
- **Activos:** Propiedades, Máquinas, Mantenimientos, Dashboard.
- **Producción:** Proyectos, Productos, Procesos, Tablero, Matriz de Productos,
  Mantenimientos, Dashboard. *(Es la sección representada en la maqueta de la vista
  detallada.)*
- **Fondos:** Cuentas, Movimientos.
- **Contabilidad:** Plan de Cuentas, Asientos, Libros, Balances.
- **Configuraciones:** Monedas, Talonarios, Usuarios, Roles.
- **Actividades:** Registro de Operarios, Actividades Personal, Logística, Tablero.
- **Portal Clientes:** Solicitudes, Presupuestos, Pedidos, Facturas, Remitos, Recibos.

### Dos niveles de presencia

Cada sección/módulo está en uno de dos estados de cara a la interfaz:

1. **Funcional:** se visualiza y se usa.
2. **Solo visible:** se ve el botón de la sección o módulo, pero no se accede (sirve para
   que se entienda el esqueleto completo del sistema). Es indistinto si por detrás la tabla
   existe o no: de cara a la UI, es un botón que no lleva a ningún lado.

Alcance de la primera etapa (a hoy): se desarrolla **Empresas** primero. Quedan **solo
visibles** —sin desarrollar— Ventas y Compras completas, Contabilidad completa, Fondos
completa, Portal Clientes completo, Talonarios (en Configuraciones) y Propiedades (en
Activos), entre otros.

### Sobre Actividades (vista de operarios) — idea, no se desarrolla ahora

Único ámbito que ven los operarios. Objetivo: que cada operario tenga el **listado de
tareas del día** y pueda ver las de los días siguientes. Flujo previsto: el operario llega
al taller, abre este módulo en una tablet o PC, y ahí tiene toda la info para trabajar e ir
**registrando lo que hace**. Los módulos internos de esta sección todavía no están
definidos; se hilan más adelante.

---

## 7. Roles, permisos y auditoría

- Cada usuario tiene un **Rol**.
- Los permisos (qué módulos ve / edita) se definen **por rol**, no por usuario.
- Existe un **Rol Maestro** con acceso total, salvo la configuración del Admin Principal.
- **Auditoría**: el sistema registra quién cambió qué y cuándo.
- Auth mediante **Supabase Auth**.

---

## 8. Jerarquía de datos

Conviven **dos estructuras anidadas distintas**. Es importante no confundirlas.

### 8.1 Matriz de Productos (catálogo del cliente)

Representa cómo viven las piezas en la planta del cliente. Es información **reutilizable**:
un producto matriz se carga una vez y se usa en muchos proyectos.

```
Cliente → Sector → Equipo → Conjunto → Subconjunto → Producto → Procesos
```

- Conjunto y Subconjunto son **composición** (un conjunto agrupa subconjuntos, que agrupan
  productos).
- La composición se arma **desde el contenedor** (editás el equipo y le agregás conjuntos,
  editás el conjunto y le agregás subconjuntos/productos, etc.).
- Las relaciones son **reutilizables** (un mismo conjunto/producto puede aparecer en varios
  contenedores → relaciones N:M, estilo árbol de componentes / BOM).

**Anidado de N niveles.** El modelo se deja preparado de forma **recursiva**: un conjunto o
subconjunto puede contener otros conjuntos/subconjuntos a cualquier profundidad, además de
productos y procesos. Pensado para fabricación de máquinas complejas a futuro, aunque no se
use en el corto plazo. Se decidió así porque el costo de modelarlo recursivo ahora es casi
nulo, mientras que retrofitearlo después sería costoso.

**Navegación (vista de Conjunto / Subconjunto):**
- La vista de un Conjunto es análoga a la de un Producto, pero en lugar de solo procesos
  muestra sus **subconjuntos + productos + procesos**.
- La vista de un Subconjunto es análoga a la del Conjunto.
- **Expandir** (chevron): despliega los hijos en línea, para vistazo rápido sin perder
  contexto.
- **Abrir** (click en el nombre): lleva a la vista dedicada de ese nivel.
- Los productos se pueden expandir para ver sus procesos, o abrir para llegar a la vista
  completa del producto.

### 8.2 Proyecto → Items

```
Proyecto → Item → Proceso
```

- En el HTML actual los items son **planos** (todos hermanos).
- En React, el item del proyecto gana un campo **Tipo** (Conjunto / Producto), permitiendo
  estructura anidada dentro del proyecto (vía `tipo` + `parent_item_id`).
- **El avance se modela en dos niveles distintos (no confundir):**
  - **Estado del proyecto** = estado *comercial / de coordinación*. Valores reales en uso:
    `Proyectando, Solicitud, Pedido, Mantenimiento, Cerrado, Anulado, Perdido` (con
    `Cerrado` teniendo sub-estado `Enviado / Terminado / Stockeado`). Es el mismo registro
    que cambia de estado, no se duplica.
  - **Estado del item** = avance *físico* de la pieza en el taller:
    `Espera MP, Llegó MP, Proceso, Enviar a TT, TT, Llegó TT, Terminado, Enviado,
    Stockeado, Anulado`.
  - El detalle del significado de cada estado vive en `NEGOCIO.md` (sección 4).
- Los **procesos** del item son los que se convierten en bloques/actividades del Tablero
  (ver §8.3).

### 8.3 Procesos del item (implementado)

Cada item tiene una lista ordenada de **procesos** (tabla `procesos`, el renombre
normalizado de `actividades_tablero`). Un proceso es un paso de trabajo del item y es lo
que se convierte en bloque del Tablero. Se editan en la **vista dedicada del item** (§5),
sobre un item ya guardado.

**Modelo de datos:**
- `procesos`: `item_id`, `orden`, `tipo_proceso_id` (FK al catálogo de tipos) **o**
  `proceso_otro` (texto libre cuando es "Otro"), `modo`, los tres tiempos (`setup_min`,
  `operacion_min`, `margen_min`), `maquina_id` / `maquina_otra`, `operario_id`,
  `detalle_trabajo`, `es_retrabajo`. **No denormaliza** cliente/pedido/fotos (eso sale por
  join cuando haga falta, a diferencia del viejo).
- `correlatividades`: tabla propia (`predecesor_id` → `sucesor_id`), muchos-a-muchos;
  puede cruzar items del mismo proyecto. Se crean lineales al agregar procesos (el nuevo
  encadena con el anterior) y se pueden editar a mano o **redefinir** (borra las internas
  del item y las recrea lineales según el orden actual, sin tocar las que van a otros items).

**Duraciones — tres tiempos de entrada, el total se deriva:**
- **Setup** (`setup_min`): seteo de máquina, una sola vez.
- **Operación** (`operacion_min`): por pieza (admite decimales).
- **Margen** (`margen_min`): global.
- Total = `setup + cantidad_del_item × operación (+ margen)`. **No se guarda
  pre-calculado**, para que no quede viejo si cambia la cantidad del item.

**Modo** (define la ocupación operario/máquina en el Tablero, badge MAN/SEMI/AUTO):
- `manual`: el operario está presente todo el tiempo.
- `semi_automatica`: setup y la máquina sigue sola hasta fin de jornada; retoma al otro día.
- `automatica`: setup y la máquina corre 24/7 hasta terminar.

**"Otro" proceso:** `tipo_proceso_id` null + `proceso_otro` (texto). Se decidió así en vez
de una fila fija "Otro" en el catálogo, porque el nombre concreto varía por caso
(Granallado, etc.).

**Suplentes derivados:** los suplentes de máquina y operario **no se guardan por proceso**;
se derivan de recursos (otras máquinas que hacen ese tipo de proceso; los suplentes de la
máquina elegida, o del tipo de proceso si no lleva máquina). Si más adelante hace falta
override por proceso, se agregan tablas de cruce.

**Fase 2 (con el Tablero):** estados de planificación, ✓Hecho/Desanclar, grupo de división
(sub-procesos por pieza), buscador de predecesores entre items, duración del planificador.
Nada de eso está todavía en el esquema.

---

## 9. Colores por nivel jerárquico

El color comunica **qué tipo de cosa es** (no la profundidad). La profundidad se lee por la
**sangría / indentación**. Todos en pastel claro y suave, descansados a la vista.

| Nivel | Color |
|---|---|
| Proyecto | Rojo pastel claro |
| Conjunto | Naranja pastel claro |
| Subconjunto | Amarillo pastel claro |
| Producto | Blanco |

> Los códigos hexadecimal exactos se afinan al maquetar, cuidando que entre rojo, naranja y
> amarillo haya suficiente contraste aunque sean todos suaves.

(Para los colores de los **botones de acción**, ver §15.)

---

## 10. Adjuntos y documentos (planos, sólidos, PDF)

### Dónde viven los archivos

- Los archivos pesados **nunca** van dentro de PostgreSQL. La base guarda solo
  **metadatos + una referencia**; el archivo vive en almacenamiento de objetos.
- **Almacenamiento elegido: Supabase Storage.** Razones: ya es parte del stack, usa el
  mismo sistema de auth/permisos (RLS) que el resto de la app, y el volumen actual
  (~50 GB) entra en el plan Pro sin costo extra.
- **Diseño agnóstico del lugar físico.** Como la base guarda una referencia y no el
  archivo, se puede migrar a otro storage (ej: Cloudflare R2) sin tocar el modelo de
  datos. R2 queda como carta para un escenario futuro puntual (ej: Portal de Clientes
  sirviendo muchas descargas, donde el egress gratis de R2 pesaría). Hoy no se justifica.

### Tabla `adjuntos` (polimórfica)

Mismo patrón que `notas`: `parent_type` (proyecto / item / conjunto / subconjunto /
producto / proceso) + `parent_id` + metadatos (nombre, tipo, tamaño, referencia al
archivo, quién lo subió, fecha).

### Versionado de planos (revisiones)

Se separa el **documento lógico** de sus **versiones**:

- Un documento ("Plano del eje principal") es una identidad estable adjunta a una entidad.
- Cada documento tiene una o varias **versiones** (Rev A, B, C...). Cada versión guarda:
  letra/número de revisión, archivo, quién la subió, cuándo, y comentario opcional de qué
  cambió.
- Al subir una modificación **no se pisa el archivo**: se crea una versión nueva, que pasa
  a ser la **vigente**; la anterior queda **histórica/obsoleta** pero accesible.
- **Historial inmutable**: las revisiones viejas no se borran ni se editan (registro de
  trazabilidad, coherente con la auditoría).
- **UI**: se muestra prominente la revisión vigente, con historial desplegable de las
  anteriores. Las obsoletas van **visualmente atenuadas / marcadas como obsoleto** (evitar
  fabricar contra un plano viejo). Misma lógica visual que los bloques completados
  desaturados del tablero.
- Asunción: un documento lógico = un archivo por revisión (no un set de varios planos).

### Permisos

- La capacidad de subir/revisar adjuntos es un **permiso por rol** (no por usuario).
- Esquema tentativo: Oficina Técnica sube documentos y crea revisiones; Operarios solo ven
  y descargan la vigente; Admin/Maestro todo.
- Se arranca con **un solo permiso** ("gestionar adjuntos"); se separa "subir nuevo" vs
  "revisar existente" solo si más adelante hace falta.

### Para el radar (no decidir ahora)

- Notificar a quien trabaja en un item cuando se sube una revisión nueva (cae en el futuro
  sistema de notificaciones).
- Previsualización: los PDF se ven en el navegador; los nativos de SolidWorks/AutoCAD solo
  se guardan y se descargan (no hay preview).

---

## 11. Facturación / ARCA — preparación futura

> **Estado: NO se implementa ahora.** Hoy la facturación se hace en TacticaSoft. Esta
> sección solo deja la arquitectura preparada para el escenario futuro de "ERP/CRM
> integrado completo", donde el sistema reemplace la parte comercial/fiscal de TacticaSoft.
> Se considera un horizonte lejano.

### Cómo se haría el día que se implemente

- **Vía intermediario, no contra ARCA en crudo.** Servicios tipo TusFacturasAPP o AfipSDK
  exponen una API REST/JSON que envuelve los web services SOAP de ARCA (WSAA + WSFE),
  manejan los certificados, generan CAE + QR + PDF, y mantienen la integración al día con
  los cambios normativos. Evita el grueso del trabajo y, sobre todo, del mantenimiento.
- **Requiere capa de servidor (Edge Functions).** La integración fiscal NO puede correr en
  el navegador: el certificado / API key son secretos de servidor. React llamaría a una
  Edge Function de Supabase, y esa función llama al intermediario. Esto vale para ARCA y
  para cualquier otra cosa que necesite secretos del lado servidor → es el primer caso que
  introduce esta capa en la arquitectura.

### Qué dejar listo desde el inicio (sin programar la integración)

- **Comprobantes como entidad de primera clase.** Tabla `comprobantes` (facturas, notas de
  crédito/débito) con campos fiscales previstos: CAE, vencimiento de CAE, punto de venta,
  tipo de comprobante, alícuotas de IVA, CUIT receptor, etc. Al principio se cargan
  manualmente con el número que sale de TacticaSoft (igual que ya se hace hoy con remitos);
  el día que se integre ARCA, los campos ya existen.
- **`empresas` con datos fiscales completos** (CUIT, razón social, condición frente al IVA).
  Ya contemplado en la sección de convenciones.
- **Lugar previsto para Edge Functions** en la estructura del repo (no se crea ahora).

---

## 12. Estructura del repo (organización del código)

El código de la app se organiza **por funcionalidad (feature)**, no por tipo de archivo.
Cada módulo del sistema vive en su propia carpeta con todo lo suyo adentro (componentes,
lógica, tipos), y lo genuinamente compartido vive en una zona común.

```
src/
  features/
    proyectos/
    tablero/
    matriz/
    ...
  shared/
    components/   (modales, botones, las 4 franjas de la UI, etc.)
    lib/          (cliente de Supabase, helpers de fecha/formato)
    types/        (tipos compartidos)
  App.tsx, main.tsx   (raíz que arma y conecta todo)
```

**Por qué por feature:** el árbol se lee como el sistema mismo, escala sin ensuciar
(sumar un módulo = sumar una carpeta), y mapea limpio a la migración pantalla por pantalla
del HTML viejo. Sobre todo, ataca de raíz la deuda técnica que se está dejando atrás: lo
común (modal de confirmación, "marcar proceso como hecho", helpers de fecha) vive **una
sola vez** en `shared/` en lugar de duplicarse entre páginas como pasaba en el HTML.

> La forma exacta de las carpetas se afina al construir. `shared/` es también el lugar
> natural para la futura capa de Edge Functions (ver sección 11) cuando se introduzca.

---

## 13. Decisiones pendientes

- [ ] **Notas:** hasta qué niveles de la matriz soportar notas (hoy `notas` es polimórfica
      con `parent_type` = proyecto / item / producto; falta decidir si se extiende a
      conjunto, subconjunto, sector, equipo). Pendiente de definir.
- [ ] **Librerías a sumar** (drag-and-drop para el tablero, calendario, date picker, etc.).
- [ ] **Códigos hexadecimal** de los colores pastel por nivel jerárquico (§9).
- [ ] **Script de migración** de proyectos viejos desde la Supabase vieja a la nueva
      (los datos maestros —empresas, recursos— ya se migraron).

---

## 14. Estándar de modales

Todos los modales del sistema usan el componente compartido
`shared/components/Modal.tsx`, que garantiza **tres reglas**:

1. **No se cierran al clickear afuera.** Solo se cierran con la × del header, con sus
   botones (Cancelar) o con **Esc**. Evita perder lo cargado por un click accidental en
   el fondo.
2. **Se arrastran** tomándolos de la barra de título.
3. **La × queda siempre visible:** el header es fijo y solo el cuerpo scrollea.

El ancho se controla con el prop `ancho` (px). Los modales que todavía usan divs ad-hoc
(`ModalItem`, `ModalProceso`, `ModalPersonal`, `ModalMaquina`) se van migrando a `<Modal>`
para cumplir el estándar.

---

## 15. Paleta de colores de acción (botones)

Los botones usan los colores del **sistema viejo** (no índigo/gris):

| Rol | Fondo | Borde | Texto | Hover |
|---|---|---|---|---|
| **Primario** (acción principal) | `#0C447C` | — | `#FFFFFF` | fondo `#0A3866` |
| **Secundario / base** | `#FFFFFF` | `#C8C6BE` | `#2C2C2A` | fondo `#F5F3EC` |
| **Peligro / eliminar** | `#FEF0F0` | `#E24B4A` | `#A32D2D` | fondo `#FEDADA` |
| **Retrabajo** (acento naranja) | `#FFF4E6` | `#E69138` | `#854F0B` | fondo `#FFE9CF` |

Los badges de modo de proceso en la tarjeta: MAN gris (`#E8E6DF`/`#5F5E5A`), SEMI violeta
(`#5C4A8A`/blanco), AUTO negro (`#1A1A1A`/blanco).
