# ARQUITECTURA — Sistema Velasco (React)

> Documento vivo. Recoge las decisiones de arquitectura tomadas para la reescritura
> en React del sistema interno de Metalúrgica Velasco. Se actualiza a medida que se
> definen cosas nuevas.
>
> Última actualización: 22/06/2026 (agregadas secciones de Adjuntos y de Facturación/ARCA)

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
ancho completo de la pantalla y una fracción de la altura), de arriba hacia abajo:

1. **Filtros** — franja angosta arriba.
2. **Lista** (ej: lista de proyectos) — franja media.
3. **Detalle** del elemento seleccionado — franja media.
4. **Enlazados** (presupuestos, pedidos, remitos, facturas, etc.) — franja angosta abajo.

Interacciones:
- **Doble click**: navega a otro módulo limpiando filtros.
- **Click derecho**: acciones contextuales.
- **Tooltips** en las franjas de lista y detalle.

---

## 6. Secciones y módulos

El sistema se organiza en **secciones** que agrupan **módulos**. Un mismo módulo puede
aparecer en varias secciones con distinta configuración (ej: Remitos muestra importes en
Ventas, pero no en Producción).

Secciones previstas: **Empresas, Ventas, Compras, Producción, Inventario, RRHH, Activos,
Fondos, Contabilidad, Actividades, Portal Clientes.**

En una primera etapa, la mayoría de los módulos avanzados quedan visibles pero
deshabilitados.

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
  estructura anidada dentro del proyecto.
- Un proyecto tiene un campo de **estado** (consulta → cotizado → confirmado → en producción
  → entregado → cerrado). Es el mismo registro que cambia de estado, no se duplica.
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

## 12. Decisiones pendientes

- [ ] **Notas:** hasta qué niveles de la matriz soportar notas (hoy `notas` es polimórfica
      con `parent_type` = proyecto / item / producto; falta decidir si se extiende a
      conjunto, subconjunto, sector, equipo). Pendiente de definir.
- [ ] **Estructura de carpetas del repo** (organización por features vs. por tipo de archivo).
- [ ] **Librerías a sumar** (drag-and-drop para el tablero, calendario, date picker, etc.).
- [ ] **Códigos hexadecimal** de los colores pastel.
- [ ] **Script de migración** de datos maestros desde la Supabase vieja a la nueva.
- [ ] **Por qué módulo empezar** el desarrollo.
