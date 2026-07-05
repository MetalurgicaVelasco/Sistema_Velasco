# TABLERO — Especificación visual exhaustiva (réplica del sistema viejo)

> Extraída línea por línea de `tablero_operarios.html`. El objetivo es que la
> versión React sea **visualmente idéntica**. Cada valor viene del código fuente
> (se indica línea de referencia). Documento vivo: si en la reescritura decidimos
> apartarnos de algo, se anota acá.

---

## 1. Marco general de la página

| Elemento | Valor | Ref |
|---|---|---|
| Fuente | `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | L11 |
| Tamaño base | 13px | L11 |
| Color texto base | `#2C2C2A` | L11 |
| Fondo página | `#FAFAF8` | L11 |
| Layout | `body` flex column, `overflow:hidden` (app de viewport completo; solo scrollea el tablero) | L11 |

Estructura vertical: **header** → **leyenda** → **tablero scrolleable** (`.bw` con
`flex:1; overflow:auto`).

### Header (`.hd`)
Padding `10px 16px`, fondo blanco, `border-bottom: 2px solid #A8A79F`, z-index 100.
Izquierda: título "Tablero por Operario — Velasco" (17px/600) con la fecha larga
abajo (11px, `#888780`), y los botones de navegación de semana. Derecha: Deshacer,
contador de cambios (10px `#888780`), botón Proyectos y Recargar.

Botones de navegación `.b-nav`: 11px, padding `5px 10px`, radio 5, borde
`1px solid #C8C6BE`, fondo blanco, peso 500, hover `#F1EFE8`. Botones `.b`: igual
pero padding `5px 12px`. Variantes: Deshacer `.b-u` (`#FAEEDA` / texto `#633806` /
borde `#FAC775`), primario claro `.b-p` (`#E6F1FB` / `#0C447C` / `#85B7EB`),
Recargar con estilo inline (`#E6F1FB`, texto `#0C447C` 600, borde `#0C447C`).

### Leyenda (`.lg`)
Flex wrap, gap 12, padding `8px 16px`, fondo `#F3F2EC`, `border-bottom: 1px solid
#C8C6BE`, 10px. Contiene: etiqueta "Urgencia:" (600) + 4 swatches de urgencia
(`.ls`: 14×10px, radio 2, borde `1px solid #888`, fondo del color de urgencia),
separador vertical (`.ld`: 1×14px `#C8C6BE`), "Maquinas:" + un swatch por máquina
(`.lo`: 14×10px, **borde 2.5px del color de la máquina**, fondo blanco), separador,
y la nota `| = 12:00` en 9px. (L88-92, L4772-4785)

---

## 2. Grilla del tablero

### Estructura
`display: grid` con `grid-template-columns: 80px repeat(N, 400px)` donde N =
operarios visibles (`en_tablero !== false && activo !== false`, ordenados por
`orden_tablero` asc, sin orden al final alfabéticos). `min-width: 1000px`. (L18,
L2852)

Filas: fila de cabecera + **10 filas de días** = 2 días hábiles atrás + hoy + 7
días hábiles adelante, **salteando domingos**. `weekOffset` desplaza la ventana de a
7 días corridos. (L418-452)

### Celda esquina (`.hc`)
Texto `6h -> 17h`. Fondo `#DEEBF7`, `border-right: 3px solid #1a1a1a`,
`border-bottom: 2px solid #A8A79F`, padding 8, 10px/600 `#0C447C`, centrado con
`align-items: flex-end`, **sticky left+top**, z-index 30. (L19)

### Cabecera de operario (`.ho`)
Nombre ("Nombre A." con inicial de apellido). Fondo `#DEEBF7`, `border-right: 3px
solid #1a1a1a`, `border-bottom: 2px solid #A8A79F`, padding 8, **13px/700**
`#0C447C`, centrado, **sticky top**, z-index 15. (L20, L469-474)

### Cabecera de día (`.hr`, columna izquierda)
Fondo `#DEEBF7`, `border-right: 2px solid #A8A79F`, `border-bottom: 2px solid
#A8A79F`, padding `6px 8px`, 13px/700 `#0C447C`, **sticky left**, z-index 10, flex
column centrado. Texto: `Lun 6/7` (formato `['Dom','Lun','Mar','Mie','Jue','Vie','Sab'] + ' ' + d/m`).
Subtexto `.hr-n`: 10px/500 `#5F5E5A` — dice `hoy` o `ayer` (los futuros van vacíos).
- **Hoy** (`.td`): fondo `#A8D8F0`; el subtexto `hoy` pasa a `#0C447C`.
- **Pasado** (`.ps`): fondo `#9E9C96`, texto `#5F5E5A`.
- La altura se fija inline con `min-height = cellPixelHeight` (ver §3). (L21-24)

**Vacaciones:** franjas verticales pegadas al borde derecho del header del día, una
por operario de vacaciones: 14px de ancho, alto 100%, `writing-mode: vertical-rl`,
7px/600 blanco, letter-spacing 0.3px, fondo = `color_borde` del operario. El header
recibe `padding-right: 14·n + 8 px`. (L2890-2902)

---

## 3. Celdas de operario-día (`.cl`)

| Propiedad | Valor | Ref |
|---|---|---|
| Bordes | `border-right: 3px solid #1a1a1a` (separa operarios) · `border-bottom: 2px solid #1a1a1a` | L25 |
| Fondo base | `#fff` | L25 |
| Fila alterna (`.ra`, índice de día impar) | `#F3F2EC` | L26 |
| Día pasado (`.ps`) | `#9E9C96` (también si es alterna) | L26 |
| Día actual (`.td`) | `#fff` — **PERO** ver nota de cascada abajo | L26 |
| Sábado (`.wk-sep`) | `border-bottom: 8px solid #1a1a1a` (separador de semana) | L27 |
| Posición | `position: relative; overflow: visible; padding: 0` | L25 |

✅ **DECIDIDO (04/07/2026):** en el sistema viejo, si "hoy" cae en fila alterna, la
celda se pinta beige por un problema de cascada CSS (`.cl.ra` declarada después de
`.cl.td`, igual especificidad). En React esto se corrige: **la celda de hoy es
SIEMPRE blanca**, gane a quien gane (hoy > alterna > base). Divergencia deliberada
respecto del original, con una sola regla en el código.

### Altura de fila (regla clave)
`DAY_MIN_HEIGHT = 104`. La fila mide **siempre 2 bloques de alto**:
`rowHeight = 104 × 2 = 208px`. Para compensar el borde inferior (box-sizing), la
altura real de la celda es `cellPixelHeight = 208 + (sábado ? 8 : 2)` px, aplicada
inline a `.cl` (height) y `.hr` (min-height). Con 3+ actividades simultáneas los
bloques **se comprimen** dentro de los 208px; la fila nunca crece. (L170, L2872-2878)

### Marcas internas de la celda
- **Línea de mediodía** (`.nl`): vertical punteada en `left: 54.55%`
  (= (720−360)/660), `border-left: 1.5px dashed #C8C6BE`, z-index 2, sin eventos. (L32)
- **Gris de sábado** (`.sg`): franja derecha `width: 45.45%` (desde las 12:00 al
  fin), fondo `#9E9C96`, z-index 1, sin eventos. Solo en filas de sábado. (L33)
- **Botón "+"** (`.ab`): absoluto `bottom: 2px; right: 4px`, borde `1px dashed
  #C8C6BE`, radio 3, padding `2px 6px`, **8px** `#888780`, fondo
  `rgba(255,255,255,.8)`, z-index 6. Hover: fondo `#F1EFE8`, borde `#A8A79F`. Abre
  el selector de asignación del operario+día. (L28-31)
- **Drop target activo** (`.dov`): `outline: 2px dashed #378ADD; outline-offset:
  -2px; background: rgba(55,138,221,.12)`. (L97)

---

## 4. Geometría de los bloques (el corazón visual)

### Escala temporal horizontal
Ventana fija **06:00 → 17:00 = 660 minutos = 100% del ancho de celda** (400px):

```
pL(min) = max(0, (min − 360) / 660 × 100)   // posición izquierda en %
pW(dur) = dur / 660 × 100                    // ancho en %
```

Posicionamiento del bloque (L2991-2994):

```
left   = calc(pL(startMin)% + 1px)
width  = calc(min(pW(dur), 100 − pL(startMin))%)    // recorta al borde derecho
top    = track × blockH + 2 px
height = blockH − 4 px
```

El drop invierte la escala: `dropMin = round(360 + (x − cellLeft)/cellWidth × 660)`.
(L2924)

### Tracks verticales (apilamiento)
`effectiveOpStack = max(2, cantidad de tracks usados por ese operario ese día)` →
`blockH = 208 / effectiveOpStack` (con 2 tracks: 104px; con 3: ~69px; etc.).
Asignación (L2753-2829):
- **Track 0 (fila superior) = actividades manuales.**
- **Tracks ≥ 1 = automáticas y semi-automáticas**, ordenadas por hora de inicio
  (la más temprana toma el track más alto disponible ≥1).
- **Consistencia multi-día:** una actividad que cruza días conserva el MISMO track
  en todos sus bloques (pass 1 del algoritmo recuerda el track por actId).
- Un bloque solo (sin simultáneas) ocupa **media celda** de alto (104px), no toda.

### Partición multi-día (computeVB)
- **Manual / semi:** la duración se reparte respetando la jornada del operario
  (`sS`/`sE`, con horario especial de sábado); cada día genera una "parte" numerada
  1..N.
- **Automática 24/7:** el setup respeta jornada; después la máquina corre calendario
  continuo (noches y domingos incluidos) pero **solo se dibujan** las franjas que
  intersecan la jornada — las horas nocturnas/domingo "se evaporan" visualmente.
  Si una parte de máquina es contigua a la parte de setup del mismo día, se fusionan
  en un solo bloque. Las partes se numeran cronológicamente. (L731-839)

---

## 5. Estilo del bloque (`.bk`)

| Propiedad | Valor | Ref |
|---|---|---|
| Base | `position:absolute; border-radius:4px; padding:3px 5px; cursor:pointer; font-size:9px; line-height:1.3; user-select:none; z-index:5; display:flex; flex-direction:column; justify-content:center; overflow:hidden; min-width:6px` | L34 |
| **Borde** | `border-style: solid; border-width: 5px 2.5px` → **5px arriba/abajo, 2.5px a los lados** | L34 |
| Color de borde | **Color de la MÁQUINA** (`machColor`) | L2942 |
| Hover | `filter: brightness(.93)` | L96 |
| Arrastrando (`.dg`) | `opacity: .3` | L96 |
| Activo | `cursor: grabbing` | L96 |

⚠ **Discrepancia con NEGOCIO.md:** el documento dice "color del borde = operario";
en este tablero (vista por operarios) el borde codifica la **máquina** — el operario
ya está dado por la columna. Actualizar NEGOCIO.md §6 o decidir el criterio en la
charla de arquitectura. El color de operario (`color_borde`) se usa en las franjas de
vacaciones (y era el borde en el tablero viejo por máquinas).

### Colores de fondo por urgencia (L35-36)
| Urgencia | Fondo | Texto |
|---|---|---|
| urgente (`.bk-u`) | `#1A1A1A` | blanco (todas las sub-clases) |
| alta (`.bk-a`) | `#FF9B9B` | negro |
| media (`.bk-m`) | `#F0D47A` | negro |
| baja (`.bk-b`) | `#BDECB6` | negro |

### Colores de borde por máquina (L152-162)
| Máquina | Color |
|---|---|
| ST-30 | `#C62828` |
| TR-1 | `#fa6497` |
| TC-Alfredo | `#FF9800` |
| AR-3300 | `#2E7D32` |
| AR-1000 | `#6ffc74` |
| VF3-YT | `#1565C0` |
| VF4 | `#73bbf5` |
| Perfect-Jet | `#26dad4` |
| Otra / sin máquina | `#9E9E9E` |

(En React esto va a una columna `color` de `maquinas`; se documentan los hex para
migrarlos.)

### Estados especiales
- **Completada** (`.bk-d`): `filter: grayscale(55%) brightness(0.92); opacity: .75`
  — conserva el color base de urgencia, desaturado. No arrastrable. (L42, L2997)
- **Pulmón** (`.bk-pulmon`): fondo rayado diagonal 45°
  `repeating-linear-gradient(45deg, #EAE8E0 0 6px, #D4D2C8 6px 12px)`, texto
  `#5F5E5A`. Contenido centrado: "Pulmón" (11px/700) + rango `HH:MM-HH:MM` debajo. (L37-38, L3033-3048)

---

## 6. Contenido interno del bloque

Contenedor de texto `tx`: flex column centrado, overflow hidden, alineado a la
izquierda. Elementos, en orden (L3029-3105):

1. **Título** (`.bt`, 10px/700, nowrap+ellipsis): la descripción viene como
   `"Item - Proceso"`; se separa en el primer `" - "` → **item en 700, proceso en
   400**. Saltos de línea aplanados (`_flat`). Si no hay separador, todo en 700.
2. **Badge Pieza N/M** (si es sub-proceso dividido): inline junto al título, 9px/700,
   fondo `rgba(0,0,0,0.18)`, texto blanco, padding `0 4px`, radio 3, margen izq 4.
3. **Cliente** (`.bs`): 9px `#2C2C2A`, nowrap+ellipsis.
4. **Horario** (`.bm`): `HH:MM-HH:MM` del bloque visible, 9px, margin-top 1.
5. **Máquina** (`.bma`, SOLO si la máquina es "Otra"): nombre ideal o "Otra", 8px
   `#5F5E5A` itálica.
6. **"Ped. N"** (si hay pedido): 9px/700, color heredado, nowrap+ellipsis.

### Badges superpuestos (absolutos sobre el bloque)
| Badge | Posición | Estilo | Cuándo | Ref |
|---|---|---|---|---|
| Parte `N/M` | top 2, right 3 | fondo `rgba(0,0,0,.65)`, blanco, 8px/700, padding `1px 4px`, radio 3 | actividad multi-bloque | L3107-3112 |
| `A` / `S` (`.ba`) | top 2, right 3 (right 30 si hay badge de parte) | círculo 11×11, fondo `rgba(255,255,255,.25)`, 7px/700, color heredado | automática / semi | L47, L3113-3119 |
| ⚠️ (`.bk-warn`) | top 0, left 1 | 13px, z6, `text-shadow 0 0 2px rgba(255,255,255,.8)` | divergencia OT pendiente | L50, L2954-2962 |
| ⛔ (`.bk-deleted`) | top 0, left 1 | ídem | proceso eliminado desde Proyectos | L53, L2948-2953 |
| ⛔ (`.bk-incons`) | top 0, **right 1** | 13px, z6, color `#C92A2A`, shadow blanco | predecesor sin planificar o solapamiento detectado (tooltip nativo combinado) | L59, L2964-2988 |

### Foto en el bloque
Se muestra si: no es pulmón, `dur ≥ 150 min`, `blockH ≥ 56 px` y hay foto (resuelta
en runtime: foto del item → snapshot → foto del proyecto). El bloque pasa a
`flex-direction: row; align-items: stretch; gap: 3px` y la imagen va al final:
`width: 35px; object-fit: cover; border-radius: 2px; align-self: stretch`, con
`onerror` que la oculta. (L3018-3027, L3217-3223)

---

## 7. Automáticas y semi: setup vs máquina sola

Dentro del bloque, la porción de **máquina sola** se distingue de la de **setup**
(L3122-3215):

- Se calcula cuántos minutos de setup caen en ESTE bloque (walk por partes; para
  auto-24/7 el setup está solo en los primeros bloques).
- **Overlay rayado** sobre la porción de máquina: desde `setupPct%` hasta el borde
  derecho, `repeating-linear-gradient(135deg, rgba(0,0,0,.08) 0 6px, transparent
  6px 12px)`, `border-radius: 0 4px 4px 0`, z1, sin eventos.
- **Separador vertical** en la frontera setup/máquina: 2px de ancho,
  `rgba(0,0,0,.55)`, z2.
- **Etiqueta "MANUAL" vertical** (una letra por línea) centrada en la zona de setup,
  solo si `setupWidthPx ≥ 12` y `blockHeightPx ≥ 56`. Tamaño de letra:
  `clamp(7, floor(altoBloque × 0.70 / 6), 11)` px, Arial 800, `rgba(0,0,0,.85)`.
  (El ancho en px se estima con celda de 400px: `blockWidthPx = pct/100 × 400`.)
- El texto del bloque se corre: `padding-left: setupPct% + 6px`.

### Bloque fantasma del setup (ghost)
Si el bloque real de una auto/semi está en un track ≥ 1, se dibuja un **ghost no
interactivo en el track 0** que ocupa solo la porción de setup: fondo rayado
`repeating-linear-gradient(135deg, rgba(128,128,128,.22) 0 6px, rgba(200,200,200,.12)
6px 12px)`, borde `1px dashed rgba(0,0,0,.35)` — o **`3px solid #000`** si
`setup_solapable` —, radio 4, contenido `🔒` (10px) + descripción con "Ped. N"
(10px `#5F5E5A` 600, ellipsis), mismo alto que un bloque (`blockH − 4`, top 2).
Muestra el mismo tooltip que el bloque real (delay 60ms). Señala que el operario SÍ
está ocupado durante el setup aunque el bloque viva abajo. (L3227-3320)

---

## 8. Tooltip (`.tip`)

`position: fixed`, fondo `#2C2C2A`, texto blanco, padding `10px 14px`, radio 8,
11px / line-height 1.5, z-index 400, `max-width: 320px`, sin eventos. Aparece tras
**800ms** de hover (60ms en ghosts) y sigue al mouse: `left = min(clientX+12,
innerWidth−290)`, `top = clientY+16`. (L60, L3339-3394)

Contenido (actividad normal): título 12px/700 · foto (max 200×140, radio 4, fondo
blanco) · cliente + "- Ped. N" · Urgencia · Maquina · Operario · para auto/semi:
rangos `Manual: HH:MM - HH:MM (XhYm)` / `Maquina sola: …` / `Bloque: …`, y para
auto-24/7 además `Inicio real` / `Fin real (maquina)` con fecha dd/mm/aaaa separados
por línea punteada `rgba(255,255,255,.25)` · `Parte N/M | Total actividad: XhYm` si
multi-parte · `Tipo: manual | semi-automatica | automatica (24/7)`.
Pulmón: `🫁 Pulmón`, inicio/fin, máquina, operario.

---

## 9. Componentes flotantes

### Toast (`.to`)
Fixed bottom 20, centrado, fondo `#2C2C2A`, blanco, padding `10px 24px`, radio 8,
12px, z300, fade `opacity .3s`, visible 3.5s. (L93, L660)

### Stack de alertas (`.alert-*`)
Fixed `bottom:16; right:16`, z350, `flex-direction: column-reverse`, gap 10,
max-height 70vh con scroll. Cards: 300px de ancho, radio 14, padding `14px 16px`,
12px, sombra `0 6px 24px rgba(0,0,0,.25)`, animación de entrada `.3s`
(translateY 20→0 + fade). Colores: gris `#D8D8D8` (informativa), amarillo `#FFEAA0`
(advertencia aceptada), rojo `#FF9B9B` (bloqueada). Botón X: círculo 24px,
`rgba(0,0,0,.25)` (hover .45). Botón "Cerrar todas" (aparece con 2+): fondo
`rgba(0,0,0,.6)`, blanco, radio 10, padding `8px 20px`, 11px/600. (L101-110)

### Modales (`.mo` / `.md`)
Overlay `rgba(0,0,0,.15)`, z200, flex centrado. Modal: blanco, radio 10, padding 20,
`min-width: 380px; max-width: 540px` (variantes 460/520/620/720 inline),
`max-height: 80vh`, scroll, borde `1px solid #C8C6BE`, **`resize: both`**, sombra
`0 8px 30px rgba(0,0,0,.2)`. Título `.md-t` 15px/600, **arrastrable** (cursor move;
MutationObserver aplica drag a todo `.md` nuevo). Botón cerrar `.md-x` 18px
`#888780`. Cards de selección `.ao`: borde `#C8C6BE`, radio 6, padding `8px 10px`,
hover borde `#378ADD` + fondo `#F5FAFF` + sombra azul; deshabilitadas opacity .5 y
fondo `#F5F3EC`. (L61-79, L4787-4843)

Paleta de paneles internos recurrente en modales: aviso amarillo `#FFF8E1`/borde
`#F9A825`/texto `#9B7500`; aviso ámbar `#FFF4D5`/`#F5C842`/`#854F0B`; error
`#FEF0F0`/`#E24B4A`/`#A32D2D`; info azul `#F5FAFF` o `#E6F1FB`/`#B6D4F2` o
`#85B7EB`/`#0C447C`; neutro `#F5F3EC`/`#C8C6BE`; éxito `#D4EDDA`/`#28A745`/`#155724`.

---

## 10. Constantes de comportamiento visibles

| Constante | Valor | Efecto |
|---|---|---|
| `GAP` | 10 min | separación mínima que deja la cascada entre bloques |
| `DAY_MIN_HEIGHT` | 104 px | mitad de la fila (fila = 2×) |
| `MAX_SIMULTANEAS` | 3 | 4+ actividades simultáneas de un operario = bloqueado |
| Ventana horaria | 360–1020 min (06:00–17:00) | escala X de toda la grilla |
| Ventana de días | 2 hábiles atrás + hoy + 7 adelante | 10 filas; sin domingos |
| Delay tooltip | 800 ms (bloques), 60 ms (ghosts) | |
| Duración toast | 3.5 s | |

✅ **DECIDIDO (04/07/2026):** la ventana horaria se lee de la tabla
`configuraciones` (clave `tablero`, default `06:00–17:00`), en UN solo lugar del
código; toda la geometría (`pL`/`pW`, línea de mediodía, gris de sábado, drop) se
deriva de ahí. Con el default, el aspecto es idéntico al original. La UI para
editarla llegará con el módulo Configuraciones.

---

## 11. Interacciones (resumen para replicar sensación)

- **Drag & drop nativo HTML5**: el bloque es draggable (salvo completadas); la celda
  entera es drop target; al soltar, la X del mouse se traduce a minutos y la lógica
  de inserción de 5 casos "snapea" al borde de bloques existentes o al inicio de
  jornada (mitades: si soltás en la primera mitad de un bloque va antes, en la
  segunda va después + GAP).
- **Click en bloque** → modal de edición (pulmón → modal de pulmón). El modal de
  edición NO se cierra con click afuera (decisión deliberada, L3402); sí con
  Escape, X o Cerrar.
- **Doble fila siempre**: manuales arriba, automáticas abajo; el ghost 🔒 arriba
  muestra el setup.
- Mover dentro del MISMO operario saltea el diálogo de conflicto de operario
  (intención explícita de reordenar, L2714-2719).
