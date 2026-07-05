# AUDITORÍA — Sistema viejo (proyectos.html + tablero_operarios.html)

> Errores, riesgos y decisiones de diseño problemáticas encontradas en la lectura
> completa del sistema HTML viejo, para **no repetirlas** en la reescritura React.
> Referencia de líneas: versión adjuntada el 04/07/2026.
> Alcance de lectura: `tablero_operarios.html` al 100%; `proyectos.html` mapeado
> completo + lectura profunda de todas las secciones que tocan al tablero.

---

## A. Problemas de arquitectura (la raíz de casi todo lo demás)

### A1. Dos motores de cascada conviven y se pisan
El tablero tiene **dos** implementaciones de la lógica de cascada:

1. **Legacy** (`placeAct` → explicit push + `cascadeOverlapsForOperator` + `globalResolve`):
   escribe en la DB **fila por fila con awaits** mientras itera (líneas 1592-1724).
2. **Motor A** (`simulateChange` → `applyPlan` → RPC `apply_motor_plan`): simula todo
   en memoria y aplica atómico (líneas 5290+).

El problema: varios flujos todavía terminan en el legacy. `showMachineConflictAlert`
→ "Confirmar con cascada" llama a `placeAct` (línea 2663); `showCascadePreview` y
`confirmAffectedAndProceed` llaman a `proceedWithPlacement`/`placeActWithCheck` que
a veces caen en `placeAct`. Resultado: **dos fuentes de verdad de la misma regla**,
con diferencias sutiles (ver A2) y escrituras no atómicas: si el usuario cierra la
pestaña a mitad de un `placeAct`, la DB queda con una cascada aplicada a medias.

**Lección React:** un solo motor, funciones puras sin efectos, y UNA sola vía de
aplicación (atómica) a la DB. Nunca escribir a la DB dentro de un loop de cascada.

### A2. Lógica duplicada con diferencias sutiles (dry-run ≠ real)
`simulateOpCascade` (línea 1461, dry-run) **no aplica** la excepción
`setup_solapable`, pero `cascadeOverlapsForOperator` (línea 1528, real) **sí**
(líneas 1558-1568). El preview puede mostrar movimientos que después no ocurren, o
al revés. Mismo patrón entre `_simCascadeOp` / `simulateOpCascadeOnState` /
`cascadeOverlapsForOperator`: tres versiones de la misma regla.

**Lección:** la simulación y la aplicación deben usar **la misma función**. El estado
simulado se aplica tal cual; no se "re-ejecuta" la lógica.

### A3. Duplicación entre archivos por no poder compartir código
`marcarProcesoHecho`, `_mphGuardar`, `_mostrarModalFinalizarItem`,
`_finalizarItemGuardar`, `escapeHtml`, `_flat`, `_normalizeActNumbers`, `toast`,
etc. están **copiadas** en ambos HTML (el propio código lo admite: tablero línea
6505: "CUANDO MIGREMOS A REACT: estas funciones tienen que vivir en un módulo
compartido"). Cada copia ya divergió levemente. La lista de campos numéricos de
`_normalizeActNumbers` hay que mantenerla sincronizada a mano en dos lugares.

### A4. Contrato implícito entre módulos vía base de datos
Proyectos escribe columnas que el tablero interpreta (`ot_ack_*`,
`proceso_eliminado`, `grupo_division_id`, `estado_proceso`) sin ningún tipo
compartido ni validación. Todo el mecanismo de "divergencias OT" (fases 10/13/17/18)
es una consecuencia de esto: parches sobre parches para mantener dos programas
sincronizados a través de la DB. En React con TypeScript esto se resuelve con tipos
compartidos y lógica compartida en `shared/`.

### A5. Sin transacciones en operaciones multi-tabla
Crear un item importado de matriz = insert item + insert fotos + insert ubicaciones
+ insert N actividades + insert M correlatividades, **secuenciales y sin transacción**
(`_importarProductoCore`, líneas 6146-6377). Si falla en el medio (red, RLS, timeout)
quedan datos huérfanos: item sin procesos, cadenas de correlatividades incompletas.
Ídem `duplicarItem`, `_crearItemDesdeBuffer`, `moveProcesoAPos` (N updates con
`Promise.all` sin transacción → reordenamiento parcial si falla uno). El único punto
atómico de todo el sistema es la RPC `apply_motor_plan`.

**Lección:** toda operación multi-fila va por RPC (función Postgres) o al menos con
manejo de error + rollback lógico. Ya la práctica del motor A validó el patrón.

### A6. Sin realtime ni control de concurrencia (multiusuario roto)
Los datos se cargan una vez en `init()`/`loadAll()`. Dos planificadores con el
tablero abierto se pisan mutuamente: cada update es last-write-wins sobre filas
completas, sin versión ni detección de conflicto, y ninguno ve los cambios del otro
hasta apretar "Recargar". El undo (ver B1) puede además **revertir cambios de otra
persona**.

### A7. loadAll trae la base entera en cada guardado
`loadAll()` (proyectos, línea 976) hace `select('*')` de ~25 tablas completas, y se
llama **después de cada guardado** de cualquier cosa. Hoy funciona porque los datos
son pocos; escala mal y hace que cada acción se sienta más lenta a medida que crece
la base. En React: estado local actualizado quirúrgicamente (o una lib de data
fetching con invalidación selectiva).

### A8. Clave anónima hardcodeada sin Auth ni RLS aparente
`SUPA_KEY` está en el HTML servido públicamente (GitHub Pages, según el comentario
de línea 663 sobre "tomasvalentinsola.github.io"). Cualquiera con la URL puede leer
y escribir toda la base con la anon key. La app nueva ya contempla Supabase Auth +
RLS; es imprescindible antes de exponer nada.

---

## B. Bugs concretos del tablero

### B1. Undo incompleto → genera "divergencias falsas"
`undo()` (línea 2724) restaura `maquina_id/fecha/hora_inicio/estado/operario_id`
pero **no** `estado_proceso` ni los `ot_ack_*` que `placeAct` setea al planificar
por primera vez (líneas 1621-1633). Deshacer una primera planificación deja la
actividad con `estado='sin_planificar'` pero `estado_proceso='Planificado'` y los
ack poblados → exactamente el tipo de desincronización que después obligó a los
parches de la fase 15 ("estado_proceso puede estar desincronizado"). Además
`_cloneActSnapshot` (motor A, línea 2250) tampoco captura `estado_proceso` ni acks.
El uStack vive solo en memoria (se pierde al recargar) y no distingue autor.

### B2. Fin de sucesor calculado lineal (bug que ya arreglaron en otro lado)
`checkCorrelatividadConflict` calcula `newEndTime = startTime + dur` **plano**
(línea 1735), ignorando jornada y multi-día — la misma clase de bug que el propio
código documenta haber arreglado en la fase 17 (comentario en `moveActOp`, líneas
2701-2709). Para actividades largas da falsos positivos/negativos en el chequeo
contra sucesores completados.

### B3. `sS()` llamado sin fecha en varios puntos → sábados mal calculados
`sS(opId, ds)` usa el horario de sábado solo si recibe la fecha. Hay llamadas que la
omiten: `_simEndOp` (línea 5010), `placeAct` push (líneas 1657, 1692, 1695),
`showMachineConflictAlert` (líneas 2558, 2561, 2569), `moveActOp` (línea 2692),
`findAltStart` (línea 2593). En sábado, esos caminos usan la hora de entrada de
semana en vez de `horario_sabado_inicio`. Bug real, sutil, difícil de detectar.

### B4. Bug tipográfico que renderiza "NaN"
`showPulmonDecisionModal`, línea 4236: `... + escapeHtml(mN(p.maquina_id)) + + '</div>'`.
El doble `+` aplica unario a la string → `NaN` concatenado y el `</div>` desaparece.
La lista de pulmones de ese modal se renderiza rota.

### B5. Loops con tope silencioso (`safe < 20/30`)
Todos los walks multi-día cortan a 20-30 iteraciones **sin avisar**. Una actividad
que cruce más de ~20 días hábiles se renderiza/calcula truncada sin error.
`simulatePlacement` devuelve `[]` si no terminó (línea 1232) y el caller lo
interpreta como "horario inválido" — mensaje engañoso para el usuario.

### B6. Geometría hardcodeada a jornada 06:00–17:00
`pL`/`pW` (líneas 466-467), el header "6h -> 17h", la línea de mediodía a 54.55% y
el gris de sábado a 45.45% asumen ventana fija 360-1020 min. Si un operario tiene
jornada distinta, sus bloques se dibujan corridos (start < 06:00 se clampa a 0%) o
se cortan (fin > 17:00 se recorta con `min(pW, 100-pL)`). El drop (`dropMin`, línea
2924) usa la misma escala. La geometría **no está derivada de los datos de jornada**
que el sistema sí tiene (`horario_entrada/salida/sabado_*`).

### B7. Hardcodes de dominio en el código
`MACH_COLORS` mapea por **nombre** de máquina (línea 152); `MCH_LIST` (línea 912) y
`MCH_NAMES` (línea 4303) repiten la lista de máquinas; `VACACIONES` es un array
hardcodeado (línea 174); `OP_ORDER` (línea 149) quedó muerto (el orden real usa
`orden_tablero`). Agregar una máquina = editar código en 3 lugares. Todo esto debe
salir de la DB (color de máquina como columna, vacaciones como tabla).

### B8. Rendimiento del render: O(n²) por frame
`render()` reconstruye TODO el grid con `innerHTML` y por cada bloque visible llama
`_actOverlaps(act.id)` (línea 2970) que recorre **todas** las actividades calculando
`realEnd`/`_simEndMach` (walks multi-día) — más `hasOTDivergence`, `piezaSuffix`
(filtra el array entero) y `_predsSinPlanificar` por bloque. Con pocas decenas de
actividades anda; con cientos se va a arrastrar. En React: memoización, índices
(Map por operario/máquina/grupo) y detección de solapamientos calculada una vez por
render, no por bloque.

### B9. Fechas: mezcla de convenciones con bug de zona horaria
El sistema usa strings `YYYY-MM-DD` + el truco `new Date(ds + 'T12:00:00')` (correcto
para evitar el corrimiento UTC). Pero `marcarProcesoHecho` usa
`new Date().toISOString().slice(0, 10)` (línea 6523) y `_mphGuardar` construye
`fechaFinPre` con `toISOString()` (línea 6538): **eso es UTC**. En Argentina (UTC-3),
entre las 21:00 y las 24:00 devuelve la fecha de mañana. Quien marque un proceso
como hecho a la noche lo registra con fecha del día siguiente.

**Lección React:** un solo módulo de fechas (helpers propios o date-fns) con la
convención documentada; jamás `toISOString()` para fecha local.

### B10. `fecha = '1900-01-01'` como sentinel de "sin planificar"
Valor mágico en lugar de `NULL`, chequeado a mano (`!== '1900-01-01'`) en ~40 lugares
en ambos archivos. Olvidar el chequeo en un filtro nuevo = bug garantizado (y hay
lugares donde solo se chequea `estado` y otros donde solo la fecha). El modelo nuevo
debe usar `NULL` con una única función `estaPlanificada(p)`.

### B11. `estado` vs `estado_proceso`: dos columnas para lo mismo
`estado` (`sin_planificar/pendiente/completada`) y `estado_proceso`
(`Planificación Pendiente/Planificado/Cerrado`) codifican casi la misma información
y el propio código admite que se desincronizan (comentario fase 15, línea 288-292;
manejo defensivo de `checkCorrelatividadConflict`). En el modelo nuevo: **un solo
estado**, o estados derivados por cálculo, nunca dos columnas paralelas.

### B12. Cinco campos de duración + snapshot triplicado
Por actividad conviven: `duracion_estimada_min`, `duracion_operacion_min` (por
pieza), `duracion_operario_min` (setup), `duracion_margen_min`,
`duracion_planificador_min` (total del bloque) **y** los espejos `ot_ack_*` de casi
todos. La mitad de las "fases" del changelog (10, 10h, 13, 17) son parches para
mantener estas copias coherentes (numeric-as-string, acks stale, sincronizar al
planificar, no sincronizar al editar item...). El modelo React tiene que derivar en
vez de copiar: guardar los mínimos campos fuente y calcular el resto.

### B13. Detección de invariantes asimétrica
`_validarInvariantesEnState` (línea 5588) valida solapamiento de **máquina**,
anclas y correlatividades, pero no solapamiento de **operario** (ese solo se detecta
en los residuales de la simulación). Un plan que rompa la regla de operario por otro
camino no se bloquea en el commit.

### B14. Comparaciones de solapamiento inconsistentes con el GAP
`_simPushMach`/`_simCascadeOp` empujan si `bTime < end + GAP`, pero
`paresSolapadosMaquina` (invariantes) y `_actOverlaps` comparan sin GAP. Y
`tryAssignToMachine` mergea intervalos con GAP pero valida el hueco sin reservar GAP
posterior. Tres definiciones de "se pisan". Definir UNA y usarla en todos lados.

### B15. `findMachineConflictsOtherOps` aproxima la entrante como manual
Comentario propio (líneas 1121-1127): usa `simulatePlacement` (jornada) como
aproximación aunque la actividad sea auto 24/7 → puede no detectar conflictos de la
cola de máquina que corre de noche.

### B16. Escapado de HTML inconsistente + onclick con strings interpolados
Muchos lugares interpolan `c.descripcion` sin `escapeHtml` (`showCascadePreview`
línea 1437, `pushAlert` línea 1272, `showOpAlert` líneas 1316/1331). Descripciones
con `<`, `&` o comillas (vienen de pegar texto de TacticaSoft) rompen el layout.
Peor: los `onclick="fn(1,2,'2026-01-01',...)"` armados por concatenación
(`showAffectedActivitiesModal` línea 2476/2515, arrays con `join(',')`) explotan si
un parámetro trae comillas. En React esto desaparece por diseño (JSX + handlers),
pero es la razón #1 para NO generar HTML por strings nunca más.

### B17. `refreshPredsInModal` parsea el onclick con regex
Línea 6916 (proyectos): para saber qué proceso edita el modal, extrae el id del
atributo `onclick` del botón Guardar con una regex. Estado de UI guardado en el DOM.

### B18. Efecto destructivo al cargar la página
`init()` del tablero **borra filas de la DB** (huérfanas `proceso_eliminado` +
`sin_planificar`, líneas 6373-6378) como parte de la carga. Un side-effect de
escritura dentro de una operación de lectura, sin confirmación ni log.

### B19. Correlatividades huérfanas al borrar
`confirmDeleteItem` borra actividades e item pero no las correlatividades que las
referencian (línea 6504-6527); depende de que exista `ON DELETE CASCADE` en la FK.
El tablero enmascara el problema con `if (!pa) continue`. Verificar/definir las FK
con cascade explícito en el esquema nuevo.

### B20. Snapshot de datos del proyecto en cada actividad
`actividades_tablero` copia `cliente_id, pedido_nro, descripcion_proyecto, urgencia,
foto_proyecto_url, cliente_final, fecha_ingreso` del proyecto al crear el proceso.
Si el proyecto cambia (urgencia, pedido_nro), los bloques del tablero muestran el
valor viejo salvo que alguien lo propague a mano. El color de fondo del bloque
(urgencia) sale del snapshot. La foto ya tuvo su parche (`_actFotoActual`, fase 18,
línea 200) que resuelve en runtime — ese es el patrón correcto: **referenciar, no
copiar** (o copiar solo lo que debe congelarse, explícitamente).

### B21. `grupo_division_id` generado con `Date.now()`
Ids tipo `'gd_' + Date.now() + '_' + sufijo`. Colisión improbable pero posible en
inserts del mismo milisegundo. En el esquema nuevo: UUID o secuencia de DB.

### B22. Ventana de días y weekOffset desalineados
`getDays()` arma 2 hábiles atrás + hoy + 7 adelante, y `weekOffset` desplaza **7 días
corridos**: al navegar, la ventana deja de estar centrada en "hoy desplazado una
semana" si hay domingos en el medio de forma no simétrica. Menor, pero confuso.

### B23. Celda de "hoy" no se destaca si cae en fila alterna
CSS: `.cl.ps{...}.cl.td{background:#fff}.cl.ra{background:#F3F2EC}` — misma
especificidad, `.cl.ra` declarada después gana. Una celda con `td` y `ra` a la vez
se pinta beige, no blanca. El "día actual destacado" real es solo el header celeste.
(Documentado también en la spec visual; decidir si en React se replica o se
corrige.)

---

## C. Bugs y riesgos de proyectos.html (zona tablero)

### C1. Propagación parcial al editar item
`saveItem` (línea 4724): si cambia la cantidad, recalcula `duracion_estimada_min` de
las actividades **no divididas**, pero deliberadamente no toca
`duracion_planificador_min` ni acks (para que el planificador acepte desde el
tablero). Correcto como diseño, pero: para actividades **divididas**
(`grupo_division_id`) el cambio de cantidad **no hace nada** — si el item pasa de 4
a 6 piezas, siguen existiendo 4 sub-procesos y nadie avisa. Hueco funcional real.

### C2. `redefinirPredecesoresItem` y edición de correlatividades post-planificación
Editar correlatividades desde Proyectos con sucesores ya planificados genera las
inconsistencias que el tablero muestra con ⛔ (fase 18). Funciona, pero es un flujo
de dos pasos manual sin guía. Para React: al editar correlatividades, avisar en el
momento si se genera una inconsistencia de planificación.

### C3. Fórmulas duplicadas Proyectos ↔ Tablero
`total = setup + cantidad × operación` (+ margen) está implementada en
`_saveProcesoImpl` (proyectos, línea 7773), en `saveEdit` (tablero, línea 3891), en
`_importarProductoCore` (línea 6280) y en `_crearItemDesdeBuffer`. Cuatro copias de
la fórmula sagrada. En React: UNA función en `shared/`.

### C4. `duplicarItem` re-consulta correlatividades a la DB
Línea 6468: pide `correlatividades` de nuevo en vez de usar el estado cargado —
inconsistencia menor de patrón, pero muestra la falta de una capa de datos única.

### C5. Fallback silencioso si faltan tablas
El `try/catch` de `loadAll` (línea 1052) deja ~20 arrays vacíos si **cualquiera** de
las consultas falla, con un `console.warn`. Un error de red intermitente deja la app
"funcionando" con matriz vacía sin que el usuario lo sepa.

---

## D. Síntesis para la reescritura (qué NO repetir)

1. **Un solo motor de planificación**, funciones puras, testeado (portar la idea de
   `window.testMotor()` a Vitest desde el día uno — los 34 tests sintéticos del
   motor A son oro y se migran casi directo).
2. **Simulación = aplicación**: el estado simulado se persiste tal cual, vía RPC
   atómica. Nada de escribir a la DB dentro de loops.
3. **Derivar, no copiar**: mínimos campos fuente; duraciones totales, estados
   visibles y fotos se calculan. Si algo debe congelarse (snapshot), que sea
   explícito y documentado.
4. **`NULL` en vez de sentinels**, un solo campo de estado, una sola definición de
   "solapa", una sola función de jornada (que siempre reciba la fecha).
5. **Geometría derivada de datos**: la ventana horaria del tablero sale de las
   jornadas de los operarios, no de constantes.
6. **Módulo de fechas único** con convención local explícita; prohibido
   `toISOString()` para fechas de calendario.
7. **Colores/orden/vacaciones en la DB**, no en el código.
8. **Índices en memoria** (Map por operario/máquina/item/grupo) y cálculo de
   badges/overlaps una vez por render.
9. **Auth + RLS antes de exponer** cualquier URL.
10. **Realtime o al menos refresco/optimistic-locking** para el tablero, que es el
    módulo más multiusuario del sistema.
