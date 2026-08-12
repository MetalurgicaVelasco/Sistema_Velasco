# ARQUITECTURA — Sistema Velasco (React)

> Documento vivo. Recoge las decisiones de arquitectura tomadas para la reescritura
> en React del sistema interno de Metalúrgica Velasco. Se actualiza a medida que se
> definen cosas nuevas.
>
> Última actualización: 11/08/2026 (§6 Actividades ya desarrollado, §7 supervisor provisorio,
> §15 documentos de envío, §16 actividades del operario, §17 fotos múltiples)

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
(campos `es_cliente` / `es_proveedor`).

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
  Moneda, Importe, OC Cliente, Contacto, Responsable, Creado por, IVA, Notas.
- **Franja 3 — Detalle:** los items del registro seleccionado. Columnas (ej.): Nº Item,
  Tipo, Cant. Pedida, Cant. Remitida, Descripción, Estado, Plazo, Urgencia, Fecha Remitido,
  Código de Matriz, Sector, Equipo, Stock disponible, Stock en producción.
  - **Despliegue según sección** (un mismo módulo se ve distinto según dónde se mira):
    - En **Ventas**, los items se ven **planos** (las filas tal cual, sin explotar). A
      Ventas le importa qué se vende, no la estructura de fabricación.
    - En **Producción**, la franja **sí permite explotar** la jerarquía: conjunto →
      subconjuntos anidados (a cualquier profundidad) → productos → procesos.
  - Política de uso: ser estrictos y no pasar de **1 nivel de subconjunto** en la práctica,
    aunque el modelo recursivo (§8) soporte más si aparecen.
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

### Sobre Actividades (vista de operarios) — desarrollado

Único ámbito que ven los operarios. Cada operario tiene el **listado de tareas del día**,
puede navegar a otros días y registra lo que hace desde una tablet o PC del taller.
El detalle del modelo está en **§16**.

Módulo en uso: **Actividades Personal**. Quedan por definir *Registro de Operarios* y
*Logística*; *Tablero* dentro de esta sección se prevé como la vista del **tablero real**
(§16.4).

---

## 7. Roles, permisos y auditoría

- Cada usuario tiene un **Rol**.
- Los permisos (qué módulos ve / edita) se definen **por rol**, no por usuario.
- Existe un **Rol Maestro** con acceso total, salvo la configuración del Admin Principal.
- **Auditoría**: el sistema registra quién cambió qué y cuándo.
- Auth mediante **Supabase Auth**.

### Estado real (11/08/2026): identidad sí, roles todavía no

El módulo de Roles **no está construido**. Lo que existe hoy:

- **Vínculo usuario ↔ persona:** `personal.usuario_id` apunta a `auth.users`. Sin ese
  vínculo, una persona no puede entrar ni ver sus actividades. Es la base de todo lo
  demás.
- **`personal.es_supervisor` (provisorio):** quien la tiene ve y edita las actividades de
  cualquiera; el resto, solo las propias. Es un **reemplazo temporal** del sistema de
  roles, decidido para no frenar el módulo de operarios.

> ⚠ Deuda consciente: `es_supervisor` desaparece cuando exista el módulo de Roles. Se
> eligió así porque diseñar permisos **antes** de tener usuarios reales usando el sistema
> lleva a un modelo que después hay que rehacer.

**Cumplimiento en la base:** las notas de proyecto ya tienen RLS por autor
(`creado_por = auth.uid()` para editar y borrar). El resto de las tablas todavía usa
"cualquier usuario autenticado hace todo": la restricción es de pantalla, no de base.
Endurecerlo queda pendiente y es requisito antes de que los operarios usen el sistema en
producción con datos sensibles.

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
  estructura anidada dentro del proyecto.
- **El avance se modela en dos niveles distintos (no confundir):**
  - **Estado del proyecto** = estado *comercial / de coordinación*. Valores reales en uso:
    `Proyectando, Solicitud, Pedido, Mantenimiento, Cerrado, Anulado, Perdido` (con
    `Cerrado` teniendo sub-estado `Enviado / Terminado / Stockeado`). Es el mismo registro
    que cambia de estado, no se duplica.
  - **Estado del item** = avance *físico* de la pieza en el taller:
    `Espera MP, Llegó MP, Proceso, Enviar a TT, TT, Llegó TT, Terminado, Enviado,
    Stockeado, Anulado`.
  - El detalle del significado de cada estado vive en `NEGOCIO.md` (sección 4).
- Los **procesos** del item son los que se convierten en bloques/actividades del Tablero.

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

- [ ] **Notas:** hasta qué niveles de la matriz soportar notas. En React se arrancó con
      `notas_proyecto` (tabla propia, **no** polimórfica) para las notas del proyecto:
      se prefirió una tabla por concepto antes que replicar la polimorfia del viejo.
      Falta decidir si los otros niveles (item, producto, conjunto) llevan tabla propia o
      se unifica.
- [ ] **RLS pareja en todas las tablas** (hoy solo `notas_proyecto` restringe por autor;
      ver §7).
- [ ] **Presupuestos:** existe la solapa en la franja 4 de Empresas y de Proyectos, pero
      no el modelo. Falta definir si es un documento propio versionable o algo derivado
      del proyecto.
- [ ] **Compras** (Órdenes de Compra, Compras, Recepciones): solapas creadas, sin modelo.
- [x] **Librería de drag-and-drop del tablero:** **dnd-kit** (decidido 04/07/2026; ver §14).
      Calendario / date picker siguen pendientes.
- [ ] **Códigos hexadecimal** de los colores pastel.
- [ ] **Script de migración** de datos maestros desde la Supabase vieja a la nueva.
- [ ] **Por qué módulo empezar** el desarrollo.

---

## 14. Tablero de planificación (módulo React)

**Documentos del módulo:** `TABLERO_PLAN.md` (decisiones y roadmap),
`AUDITORIA_SISTEMA_VIEJO.md` (restricciones: qué no repetir),
`TABLERO_SPEC_VISUAL.md` (réplica visual del tablero viejo).

**Modelo de planificación (decidido 04/07/2026):**

- La planificación vive en `procesos` con columnas nullable: `plan_fecha`,
  `plan_hora`, `plan_operario_id`, `plan_maquina_id` (nullable: hay procesos sin
  máquina). Un solo `estado` (enum: `sin_planificar / planificado / hecho`); sin
  sentinels (`NULL` = sin planificar). Tiempos reales `real_*` para `hecho`.
- `plan_aceptado` (jsonb) es el snapshot de lo que el planificador aceptó
  (setup, operación por pieza, margen, cantidad, modo). El ancho y comportamiento
  del bloque se **derivan** de este snapshot. Reemplaza a las columnas espejo
  `ot_ack_*` del sistema viejo.
- **Cambio directo vs. divergencia (decidido 06/07/2026):** hay dos orígenes de
  cambio de un proceso, con tratamiento distinto.
  - **Desde el tablero** (modal de la actividad: tiempos de setup/operación/margen,
    operario, máquina, fecha/hora, `setup_solapable`): es un **cambio directo**. Se
    escribe el dato real del proceso **y** el snapshot `plan_aceptado` a la vez,
    quedando iguales, así que **no genera divergencia** (el planificador ya sabe lo
    que cambió; no tiene sentido avisárselo a sí mismo).
  - **Desde Oficina Técnica / Proyectos:** toca el proceso real sin actualizar el
    snapshot → el tablero muestra la **divergencia (⚠)** hasta que el planificador
    la **aplica** (adopta el valor de OT en el snapshot) o la **ignora**.
  - Así el ⚠ queda reservado para lo único que importa avisar: "OT cambió algo sin
    que el planificador se entere".
- La **urgencia** se puede editar desde el modal del tablero, pero vive en el
  **proyecto** (no en el proceso, para no duplicar la fuente): se guarda con un
  UPDATE aparte a `proyectos` y **afecta a todos los bloques de ese proyecto**, no
  solo al editado. El modal avisa de esto al editarla.
- `proceso_eliminado` (soft-delete visible en tablero), `setup_solapable`,
  `grupo_division_id` (uuid) se conservan del contrato viejo.
- Tablas de soporte: `personal_vacaciones`, `configuraciones` (clave/valor; la
  ventana horaria del tablero — default 06:00–17:00 — el gap de cascada y el máximo de
  simultáneas se leen de la clave `tablero`). Colores de máquinas y de operarios como
  columnas (`maquinas.color`, `personal.color`); horarios de jornada y sábado en
  `personal`.
- **Pulmones: no se usan.** La tabla `pulmones` (reservas de tiempo del operario)
  quedó creada pero **inerte**: el planificador deja espacios a mano en lugar de
  reservas duras. El motor de cascada no tiene pasada de pulmones. No reintroducir
  salvo pedido explícito.

**Motor de planificación:** funciones puras TypeScript en
`features/tablero/motor/`, sin acceso a DB ni DOM. Simulación y aplicación usan el
mismo código; la única vía de escritura es la RPC atómica `aplicar_plan_tablero`.
Testeado con Vitest. Reglas portadas del motor viejo: anclas, excepción
setup_solapable, filtro de pasado, hechas como anclas duras, detección de conflictos
residuales. (No se portó la lógica de pulmones: no se usan.)

**Dos tableros:** el de operarios (edición, drag & drop con **dnd-kit**) y, a futuro,
el de máquinas (visor de solo lectura sobre el mismo motor). En la vista por
operarios el borde del bloque codifica la máquina; en la futura vista por máquinas,
el operario (ver `NEGOCIO.md` §6).

---

## 15. Documentos de envío (notas de envío y remitos)

> Implementado. Reemplaza el circuito manual de Word + Drive.

### El principio: lo remitido es DERIVADO, no un estado

La cantidad remitida de un elemento **no se guarda** en ninguna columna: se calcula
sumando lo que dicen los documentos. Se leyó así del sistema viejo y se mantuvo a
propósito: un estado guardado se desincroniza en cuanto se corrige un documento.

Regla completa:

- **Suman** las líneas de las notas de envío y las de los remitos **directos**.
- **No suma** un remito que *cierra* una nota de envío: esas unidades ya las contó la
  nota. Si sumaran las dos, se contaría doble.

### Por qué existen los dos documentos

El **remito** sale de TacticaSoft y es el documento válido. Pero emitirlo **bloquea el
pedido** en Táctica: si falta ponerle precio o llegó la orden de compra del cliente, no se
puede remitir todavía. Para poder entregar igual, el taller emite una **nota de envío**,
que es el papel que firma quien se lleva las piezas. Cuando después se emite el remito, se
lo vincula a esa nota y el circuito cierra.

También se usan notas para enviar piezas que **no se cobran** (muestras del cliente),
donde no hay pedido ni remito posible.

### Modelo

| Tabla | Qué guarda |
|---|---|
| `notas_envio` | número correlativo propio, número impreso (si es externa), fecha, empresa, proyecto (opcional), pedido, observaciones y **snapshot del cliente** |
| `notas_envio_items` | línea: elemento (FK real), descripción impresa y cantidad |
| `remitos` | número de Táctica, fecha, empresa, proyecto, y `tipo` = `nota` \| `directo` |
| `remitos_items` | línea: elemento, cantidad y **`nota_envio_id`** (con valor = cierra esa nota y no suma) |

Decisiones dentro del modelo:

- **Snapshot del cliente en la nota:** nombre, razón social, CUIT, contacto y dirección se
  copian al emitir. Si mañana el cliente cambia de dirección, el documento firmado tiene
  que seguir diciendo lo que decía.
- **`descripcion` se guarda además del `elemento_id`:** es el texto que quedó impreso.
- **Numeración por secuencia de Postgres** (`siguiente_numero_nota_envio`), no leyendo y
  actualizando un contador como hacía el viejo: es atómica y no necesita reintentos.
- **Un conjunto entra como UNA línea**, con su cantidad. Retrabajos y dispositivos nunca
  se entregan al cliente y quedan fuera.
- Un elemento ya cubierto por un **remito directo** no puede ir en una nota.

### Edición

Una nota **cerrada por un remito** no se puede editar ni borrar (desincronizaría el
remito). De los remitos se editan **número y fecha**; para cambiar qué cubren, se borran y
se rehacen. Borrar un remito reabre las notas que cerraba.

---

## 16. Actividades del operario

> Implementado. Es el único ámbito que usan los operarios (§6).

### 16.1 Qué ve

La **lista del día**: sus procesos planificados para una fecha (los mismos datos que el
tablero, leídos por `plan_fecha` + `plan_operario_id`). Puede navegar a otros días y recibe
un aviso de lo que quedó **atrasado**. Un supervisor puede mirar y editar la agenda de
cualquiera.

Dentro de cada actividad tiene la **orden de trabajo digital** (los mismos datos que la OT
impresa) y, por separado, la **carpeta completa** del ítem: portada con los datos del
trabajo, la lista de todos los procesos y una OT por proceso — incluido **lo que registró
quien hizo los procesos anteriores**. Es la digitalización de la carpeta de papel: el
contexto completo de la pieza, no solo el paso propio.

### 16.2 Tiempos: tramos

El registro de tiempo son **tramos** (`actividad_tramos`), un renglón por tarjeta:

- `tipo` = `trabajo` \| `pausa`; la pausa lleva **motivo obligatorio** (y quién autorizó,
  si fue un cambio de planificación).
- `fin` en null = **está corriendo**. Así no hace falta un estado aparte para saber qué
  está en curso.
- **Dos pares de horarios:** `inicio`/`fin` son los que valen para el cálculo, e
  `inicio_real`/`fin_real` guardan **cuándo se tocó el botón** y no se pisan nunca. Si se
  corrige un horario a mano, el tramo queda marcado como `editado`.

> El objetivo del par real/efectivo es que corregir no borre la evidencia: siempre se puede
> reconstruir qué pasó de verdad.

Un operario puede tener **dos actividades corriendo a la vez** (el caso de la máquina
automática), y el tiempo cuenta en las dos.

### 16.3 Estados y quién cierra

Se agregó el estado **`hecho_operario`** a `procesos`: el operario terminó, pero el
supervisor todavía no lo cerró. Al cerrarlo (`hecho`) se aplica la regla de predecesores
que ya existía.

`procesos.finalizado_operario_en` guarda **cuándo** finalizó el operario y **sobrevive** al
cierre del supervisor: es lo que permite distinguir, en el tablero, lo que hizo un operario
(✓ verde) de lo que se marcó hecho a mano. Se limpia si la actividad se reabre.

Los procesos en `hecho_operario` son **ancla dura** del motor de cascada, igual que los
`hecho`: si ya ocurrieron, moverlos sería falsear lo que pasó.

### 16.4 Plan y realidad no se pisan

Decisión de fondo, tomada el 11/08/2026:

- Lo que registra el operario **nunca mueve** la planificación del tablero. Si la realidad
  sobrescribiera el plan, se perdería justamente lo que se quiere medir: el desvío.
- El tablero **nunca modifica** los tramos registrados. Mover un bloque de una actividad
  cerrada sí la **reabre** (si se replanifica es porque algo hay que rehacer), pero no
  toca lo que se registró.
- La comparación se resuelve con **dos vistas del tablero**: el **planificado** (el actual,
  editable) y el **real** (dibujado a partir de los tramos, solo lectura, con las pausas e
  interrupciones a la vista). Mismo dato, dos lecturas.

> Por eso se descartó marcar "divergencia" entre plan y realidad: con las dos vistas al
> lado, un símbolo que avise del desvío es redundante.

---

## 17. Fotos múltiples

Un proyecto admite hasta **10** fotos y un elemento hasta **5**. Viven en la tabla `fotos`
(`proyecto_id` **o** `elemento_id`, nunca los dos: lo garantiza un `check`), con el `path`
del bucket y la `posicion`.

**La columna vieja `foto_url` se mantiene**, sincronizada con la foto **principal** (la de
posición 1). El tablero, la carpeta impresa, el mail y la etiqueta la siguen leyendo sin
cambios. Es deliberado: borrarla obligaba a tocar cinco lugares a la vez.

La galería es un componente compartido y se usa en los tres lugares donde se cargan fotos
(formulario de proyecto, modal de elemento y vista del elemento). Esto ataca un problema
concreto del sistema viejo: **dos pantallas guardaban la foto por caminos distintos y
mostraban cosas distintas**. Una sola fuente, un solo componente.

En la vista compacta ocupa **alto fijo** (miniatura + contador "+N"): cargar fotos no puede
mover ni achicar los campos del formulario.
