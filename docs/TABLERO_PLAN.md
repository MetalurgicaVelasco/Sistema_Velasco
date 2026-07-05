# TABLERO — Plan de construcción (documento de traspaso)

> **Para la sesión de codificación (Opus / Claude Code).** Este documento cierra el
> Bloque 0 (decisiones) del módulo Tablero de Velasco App 2.0. Fue elaborado tras la
> lectura completa del sistema viejo. Se lee junto con:
> - `docs/AUDITORIA_SISTEMA_VIEJO.md` — 35 hallazgos; restricciones de diseño ("qué no repetir").
> - `docs/TABLERO_SPEC_VISUAL.md` — réplica visual exacta; el render se valida contra ese doc.
> - `docs/ARQUITECTURA.md` y `docs/NEGOCIO.md` — contexto general (ver actualizaciones en `ACTUALIZACIONES_DOCS.md`).
>
> **Reglas para la sesión de codificación:** español; Tomi es nuevo en React/TS —
> explicar brevemente cada concepto nuevo; SQL de a UN statement por bloque de
> código, esperando el resultado cuando un paso depende del anterior; confirmar
> antes de cambios grandes que NO estén ya decididos acá. Lo decidido acá no se
> re-pregunta.

---

## 1. Decisiones tomadas (Bloque 0 — cerrado el 04/07/2026)

### D1 — La planificación vive en la tabla `procesos`, con NULL y un solo estado
Columnas *nullable* en `procesos` (no tabla aparte: la relación es 1:1 y simplifica
queries y futuro realtime):

- `plan_fecha date`, `plan_hora time`, `plan_operario_id` (FK `personal`),
  `plan_maquina_id` (FK `maquinas`, **nullable**: existen procesos sin máquina,
  ej. despacho/control).
- **Un solo `estado`**: enum `proceso_estado` = `'sin_planificar' | 'planificado' | 'hecho'`.
  Muere el par `estado`/`estado_proceso` (auditoría B11) y muere el sentinel
  `'1900-01-01'` (B10): sin planificar = `plan_fecha IS NULL`.
- CHECK: si `estado = 'planificado'` entonces `plan_fecha`, `plan_hora` y
  `plan_operario_id` NOT NULL (la máquina puede ser NULL).
- Tiempos reales para `hecho`: `real_fecha_inicio`, `real_hora_inicio`,
  `real_fecha_fin`, `real_hora_fin` (todos nullable — se puede marcar hecho sin
  conocer los tiempos, como en el sistema viejo).
- Se conservan del contrato viejo, con nombre limpio: `proceso_eliminado boolean
  default false` (soft-delete visible en tablero cuando OT borra un proceso
  planificado; delete físico recién al "Quitar" desde el tablero),
  `setup_solapable boolean default false`, `es_retrabajo boolean default false`,
  `grupo_division_id uuid` (reemplaza el `'gd_'+Date.now()` — B21), `orden int`.

**Prefijo `plan_`** para distinguir de los *sugeridos* por Oficina Técnica
(`maquina_ideal_id`, `operario_ideal_id`, suplentes), que ya existen o se agregan
igual.

### D2 — `plan_aceptado` (jsonb) reemplaza a las 9 columnas `ot_ack_*`
La regla de negocio se conserva: **el bloque del tablero nunca cambia de tamaño ni
de comportamiento por un cambio hecho desde Proyectos hasta que el planificador lo
acepta**. Lo que cambia es el modelado:

- Una sola columna `plan_aceptado jsonb` en `procesos`, con esta forma (tipada en TS):

```ts
interface PlanAceptado {
  setup_min: number;
  operacion_min: number;   // por pieza
  margen_min: number;
  cantidad: number;        // cantidad del elemento al momento de aceptar
  modo: 'manual' | 'semi_automatica' | 'automatica';
}
```

- Se llena al planificar por primera vez (copia de los valores actuales) y se
  actualiza al apretar "Aplicar cambios desde Proyectos", "Ignorar", o al editar
  los tiempos desde el modal del tablero.
- **El ancho del bloque se DERIVA**: `total = setup + cantidad × operación + margen`
  leído de `plan_aceptado`. **No existe más `duracion_planificador_min`** ni
  `duracion_estimada_min` como columnas (auditoría B12): son funciones.
- **Divergencia** = UNA función pura `divergencias(proceso, elemento)` en el motor,
  que compara los valores actuales (columnas fuente + `elementos.cantidad`) contra
  `plan_aceptado`. Comparación numérica sobre numbers (el mapeo de datos convierte
  los numeric de Supabase una sola vez — ver §5).
- Ventaja clave sobre el viejo: un solo lugar, sin 9 columnas espejo, sin
  comparaciones string-vs-number, y el snapshot es atómico (se escribe entero).

### D3 — Tablas de soporte (todo lo hardcodeado pasa a la DB)
- `maquinas.color text` — mata `MACH_COLORS` (B7). Se migran los 9 hex de la spec.
- `personal`: `horario_entrada time`, `horario_salida time`,
  `horario_sabado_inicio time NULL`, `horario_sabado_fin time NULL` (NULL = no
  trabaja sábado), `en_tablero boolean default false`, `orden_tablero int NULL`,
  `color text` (borde en el futuro tablero por máquinas + franjas de vacaciones).
- `personal_vacaciones` (convención de prefijo de módulo): `personal_id`, `desde`,
  `hasta` — mata el array `VACACIONES` hardcodeado.
- `configuraciones` (clave/valor): `clave text PK`, `valor jsonb`. Semilla:
  `('tablero', {"ventana_inicio":"06:00","ventana_fin":"17:00","gap_min":10,"max_simultaneas":3,"dias_atras":2,"dias_adelante":7})`.
  El módulo Configuraciones (UI) llega después; por ahora se lee de acá.
- `correlatividades`: verificar/definir `ON DELETE CASCADE` en ambas FKs (mata B19),
  `UNIQUE (predecesor_id, sucesor_id)` y `CHECK (predecesor_id <> sucesor_id)`.
- `pulmones` como **tabla propia** (`operario_id`, `maquina_id NULL`, `fecha`,
  `hora_inicio`, `duracion_min`): un pulmón no es un proceso de un elemento; en el
  viejo era una fila falsa de actividades con campos inventados. El motor los
  unifica en memoria como "bloques" (ver §4).

### D4 — Drag & drop: **dnd-kit** (confirmado)
Headless, mantenido, accesible, sin estilos impuestos. Entra recién en el Bloque 5;
los bloques 1–4 no lo necesitan. Si al implementarlo aparece fricción con el modelo
de "drop en posición X → minuto" (dnd-kit trabaja por droppables, no por
coordenadas), el fallback aprobado es: dnd-kit para el drag + cálculo manual del
minuto con la X del puntero sobre la celda (igual que el viejo). No volver a
preguntar; decidir en código y documentar.

### D5 — Celda de "hoy": SIEMPRE blanca
Divergencia deliberada respecto del viejo (que la pintaba beige si caía en fila
alterna, por un accidente de cascada CSS). Prioridad: pasado > hoy > alterna > base,
escrita UNA vez. Detalle en `TABLERO_SPEC_VISUAL.md` §3.

### D6 — Dos tableros, roles claros (corrige la confusión de NEGOCIO.md)
- **Tablero por operarios** (este módulo): la herramienta de planificación, con
  edición y drag & drop. Borde del bloque = **color de la máquina**.
- **Tablero por máquinas** (futuro, NO en este roadmap): visor informativo de solo
  lectura para detectar máquinas ociosas/sobrecargadas, sin drag & drop. Borde del
  bloque = **color del operario**. Se construye sobre el mismo motor y los mismos
  componentes de bloque, cambiando la agrupación.

---

## 2. Modelo de datos — SQL

> Entregar a Tomi **de a un statement por bloque**. El paso 0 es diagnóstico:
> esperar su output antes de ajustar los ALTER (los nombres exactos de las columnas
> existentes de `procesos` pueden diferir de lo asumido acá).

**Paso 0 — diagnóstico (esperar resultado):**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('procesos', 'personal', 'maquinas', 'correlatividades')
ORDER BY table_name, ordinal_position;
```

**Paso 1 — enum de estado:**

```sql
CREATE TYPE proceso_estado AS ENUM ('sin_planificar', 'planificado', 'hecho');
```

**Paso 2 — columnas de planificación en `procesos`** (ajustar según diagnóstico;
si alguna ya existe con otro nombre, renombrar en vez de duplicar):

```sql
ALTER TABLE procesos
  ADD COLUMN IF NOT EXISTS estado proceso_estado NOT NULL DEFAULT 'sin_planificar',
  ADD COLUMN IF NOT EXISTS plan_fecha date,
  ADD COLUMN IF NOT EXISTS plan_hora time,
  ADD COLUMN IF NOT EXISTS plan_operario_id bigint REFERENCES personal(id),
  ADD COLUMN IF NOT EXISTS plan_maquina_id bigint REFERENCES maquinas(id),
  ADD COLUMN IF NOT EXISTS plan_aceptado jsonb,
  ADD COLUMN IF NOT EXISTS real_fecha_inicio date,
  ADD COLUMN IF NOT EXISTS real_hora_inicio time,
  ADD COLUMN IF NOT EXISTS real_fecha_fin date,
  ADD COLUMN IF NOT EXISTS real_hora_fin time,
  ADD COLUMN IF NOT EXISTS proceso_eliminado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS setup_solapable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS grupo_division_id uuid;
```

**Paso 3 — integridad del estado:**

```sql
ALTER TABLE procesos ADD CONSTRAINT procesos_planificado_completo
  CHECK (estado <> 'planificado'
         OR (plan_fecha IS NOT NULL AND plan_hora IS NOT NULL AND plan_operario_id IS NOT NULL));
```

**Paso 4 — soporte en `maquinas` y `personal`:**

```sql
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS color text;
```

```sql
ALTER TABLE personal
  ADD COLUMN IF NOT EXISTS horario_entrada time NOT NULL DEFAULT '06:00',
  ADD COLUMN IF NOT EXISTS horario_salida time NOT NULL DEFAULT '15:00',
  ADD COLUMN IF NOT EXISTS horario_sabado_inicio time,
  ADD COLUMN IF NOT EXISTS horario_sabado_fin time,
  ADD COLUMN IF NOT EXISTS en_tablero boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS orden_tablero int,
  ADD COLUMN IF NOT EXISTS color text;
```

**Paso 5 — vacaciones, pulmones, configuraciones:**

```sql
CREATE TABLE personal_vacaciones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  personal_id bigint NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
  desde date NOT NULL,
  hasta date NOT NULL,
  CHECK (hasta >= desde)
);
```

```sql
CREATE TABLE pulmones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  personal_id bigint NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
  maquina_id bigint REFERENCES maquinas(id) ON DELETE SET NULL,
  fecha date NOT NULL,
  hora_inicio time NOT NULL,
  duracion_min int NOT NULL CHECK (duracion_min >= 10)
);
```

```sql
CREATE TABLE configuraciones (
  clave text PRIMARY KEY,
  valor jsonb NOT NULL
);
```

```sql
INSERT INTO configuraciones (clave, valor) VALUES ('tablero',
  '{"ventana_inicio":"06:00","ventana_fin":"17:00","gap_min":10,"max_simultaneas":3,"dias_atras":2,"dias_adelante":7}');
```

**Paso 6 — correlatividades sanas** (ajustar según diagnóstico; si las FK existen
sin cascade, hay que drop + re-add):

```sql
ALTER TABLE correlatividades
  ADD CONSTRAINT correlatividades_unicas UNIQUE (predecesor_id, sucesor_id),
  ADD CONSTRAINT correlatividades_no_self CHECK (predecesor_id <> sucesor_id);
```

**Paso 7 — colores de máquinas** (hex de la spec visual §5):

```sql
UPDATE maquinas SET color = CASE nombre
  WHEN 'ST-30' THEN '#C62828'   WHEN 'TR-1' THEN '#fa6497'
  WHEN 'TC-Alfredo' THEN '#FF9800' WHEN 'AR-3300' THEN '#2E7D32'
  WHEN 'AR-1000' THEN '#6ffc74' WHEN 'VF3-YT' THEN '#1565C0'
  WHEN 'VF4' THEN '#73bbf5'     WHEN 'Perfect-Jet' THEN '#26dad4'
  ELSE '#9E9E9E' END;
```

**Paso 8 — RPC atómica** `aplicar_plan_tablero(plan jsonb)`: recorre un array de
`{tabla: 'procesos'|'pulmones', id, _delete?, ...campos}` y aplica UPDATE/DELETE
dentro de la función (= una transacción). Es la evolución del `apply_motor_plan`
viejo, extendida a pulmones y a los campos nuevos. El cuerpo exacto se escribe en
el Bloque 1 contra el esquema real; regla: **es la ÚNICA vía de escritura del motor**
(auditoría A1/A5 — nada de updates fila-por-fila en loops desde el cliente).

---

## 3. Contrato Proyectos ↔ Tablero (versión nueva)

| Evento en Proyectos | Efecto en el tablero |
|---|---|
| OT edita setup/operación/margen/modo de un proceso planificado | Nada cambia visualmente salvo el ⚠ amarillo. `divergencias()` compara contra `plan_aceptado`. |
| Planificador "Aplica cambios" | El motor simula con el nuevo total; si afecta a otros, modal; al confirmar, `plan_aceptado` se actualiza junto con la cascada, todo en la misma RPC. |
| Planificador "Ignora" | Solo se actualiza `plan_aceptado` (el bloque conserva su comportamiento pero deja de marcar divergencia). |
| Cambia la cantidad del elemento | Divergencia por `cantidad` (está en el snapshot). **Nuevo, cubre el hueco C1:** si el proceso está dividido (`grupo_division_id`) y la cantidad ya no coincide con la cantidad de sub-procesos, se muestra advertencia específica en el item y en los bloques del grupo (resolución manual: agregar/quitar sub-procesos; no automatizar en v1). |
| OT elimina un proceso planificado | `proceso_eliminado = true` → ⛔ en el bloque; "Quitar" desde el tablero hace el DELETE físico. Si está `sin_planificar`, DELETE directo. |
| Edición de correlatividades deja un sucesor planificado con predecesor sin planificar | Badge ⛔ "Inconsistente" (misma regla del viejo, fase 18): el motor NO bloquea movimientos ajenos por esto. |

Estados del elemento/proyecto que habilitan el "+" del tablero: iguales al viejo
(`Pedido/Mantenimiento` para proyecto; `Espera MP … Llegó TT` para item/elemento).

---

## 4. Arquitectura del motor (Bloque 3 — el corazón)

**Principio:** funciones puras TypeScript, cero acceso a DB, cero DOM. La UI arma el
estado, llama al motor, muestra el resultado y aplica el `applyPlan` por RPC.
Simulación y aplicación usan **el mismo código** (mata A1/A2).

```
src/features/tablero/motor/
  tipos.ts        // Bloque, CambioPropuesto, ResultadoSimulacion, PlanAceptado...
  calendario.ts   // walk multi-día ÚNICO, parametrizado (duración total vs operario)
  duraciones.ts   // total(), duracionOperario() (Dop), derivadas de plan_aceptado
  solapes.ts      // UNA definición de "se pisan" (con gap), usada por todos (mata B14)
  simular.ts      // simularCambios(estado, cambios, opciones) → punto fijo con anclas
  invariantes.ts  // máquina + OPERARIO (cubre B13) + anclas + correlatividades
  divergencias.ts // divergencias(proceso, elemento) contra plan_aceptado
  __tests__/motor.test.ts
```

Conceptos que se **portan tal cual** del Motor A viejo (funcionan y están
testeados): anclas (los cambios propuestos no se mueven; el resto cascadea),
excepción `setup_solapable` (auto/semi solapable vs manual no empuja), pulmones
pisar/cascadear, filtro de pasado (corte = último día laboral anterior a hoy; lo
anterior no entra al motor), hechas = anclas duras, detección de residuales
(`conflicto_no_resoluble` si dos anclas se pisan).

Correcciones obligatorias respecto del viejo (referencias a la auditoría):
1. `jornada(operarioId, fecha)` en `shared/lib/jornada.ts` — **siempre recibe la
   fecha**; no existe versión sin fecha (mata B3).
2. Un solo walk multi-día en `calendario.ts` reutilizado por todos (hoy hay ~8
   copias). El tope de iteraciones **lanza error explícito**, no trunca (B5).
3. Fin de sucesor SIEMPRE con el walk, nunca lineal (B2).
4. Excepción `setup_solapable` aplicada en la única implementación (B2/A2).
5. `shared/lib/fechas.ts`: fecha local `YYYY-MM-DD` sin `toISOString()` (B9).
6. Mapeo de datos (capa `datos/`) convierte los numeric de Supabase a `number` UNA
   vez al leer; el motor trabaja solo con numbers tipados.

**Tests (Vitest):** portar los 34 tests sintéticos de `window.testMotor` del viejo
(están en `tablero_operarios.html` líneas 5841–6350; los escenarios se traducen casi
1:1) + tests de regresión nuevos para B2 (sucesor multi-día), B3 (sábado con
`horario_sabado_inicio`), B9 (fecha local a las 22:00), invariante de operario, y
divergencias contra `plan_aceptado`.

> **Vitest, en una línea para Tomi:** es el runner de tests del ecosistema Vite; se
> escriben archivos `*.test.ts` con `expect(resultado).toEqual(esperado)` y se corre
> `npm test`. Es la versión formal del `window.testMotor()` que ya tenía el sistema
> viejo, pero corre sin abrir el navegador y avisa en rojo si un cambio rompe algo.

---

## 5. Estructura de archivos del feature

```
src/features/tablero/
  motor/            (ver §4 — puro, testeado)
  datos/
    consultas.ts    // lecturas Supabase + mapeo numeric→number + tipos de fila
    aplicarPlan.ts  // única escritura: RPC aplicar_plan_tablero
  componentes/
    Tablero.tsx     // grilla, ventana de días, scroll
    CeldaDia.tsx    // celda operario-día (mediodía, gris sábado, "+", drop)
    Bloque.tsx      // bloque + badges + overlay setup + foto
    GhostSetup.tsx
    TooltipBloque.tsx
    ModalEditarBloque.tsx / ModalAfectadas.tsx / SelectorAsignar.tsx / ModalPulmon.tsx
  calculos/
    bloquesVisuales.ts  // computeVB portado (partición multi-día)
    tracks.ts           // assignTracksAcrossDays portado
shared/lib/fechas.ts
shared/lib/jornada.ts
shared/types/…
```

Rendimiento (mata B8): construir UNA vez por render los índices `Map` (procesos por
operario, por máquina, por elemento, por grupo) y calcular solapes/divergencias
sobre los índices, no por bloque. React re-renderiza solo lo que cambia; no hay
`innerHTML` global.

---

## 6. Roadmap con criterios de aceptación

**Bloque 1 — Modelo de datos** (SQL §2, paso a paso con Tomi).
✔ Aceptación: diagnóstico corrido, todos los statements aplicados sin error,
esquema final verificado con el SELECT del paso 0, RPC creada y probada con un
update trivial.

**Bloque 2 — Cimientos compartidos**: `fechas.ts`, `jornada.ts`, tipos, lectura de
`configuraciones`, capa `datos/consultas.ts` con mapeo numeric→number.
✔ Aceptación: `npm test` verde con tests de fechas (incluye "22:00 hora argentina
devuelve la fecha de HOY") y jornada (sábado con y sin horario de sábado).

**Bloque 3 — Motor puro** (§4).
✔ Aceptación: los 34 tests portados + regresiones, todos verdes. Ni un componente
React tocado todavía.

**Bloque 4 — Render estático** (solo lectura, datos reales).
✔ Aceptación: comparación lado a lado con el tablero viejo abierto — grilla,
alturas, colores, tracks (manuales arriba / autos abajo), overlay de setup, ghost,
badges y tooltip idénticos según `TABLERO_SPEC_VISUAL.md`; celda de hoy blanca
(D5); navegación de semanas; leyenda.

**Bloque 5 — Interacción**: dnd-kit (D4), lógica de inserción de 5 casos, modal de
afectadas conectado a `simularCambios`, aplicar por RPC, selector "+" con filtros,
pulmones (crear/editar/pisar/cascadear), modal de edición del bloque con
divergencias y "Aplicar/Ignorar", marcar hecho / desanclar, quitar. **Undo
rediseñado:** cada aplicación guarda el plan inverso completo (todos los campos que
tocó, incluido `estado` y `plan_aceptado`) y deshacer = aplicar el plan inverso por
la misma RPC (mata B1).
✔ Aceptación: reproducir a mano los escenarios de los 34 tests más los flujos de
modales; ningún camino escribe a la DB fuera de la RPC.

**Bloque 6 — Futuro (NO ahora, solo para tener el mapa):** realtime/refresco
multiusuario, tablero por máquinas (visor, D6), reporte imprimible por operario,
UI del módulo Configuraciones, Auth + RLS antes de compartir la URL.

---

## 7. Qué NO hacer (resumen ejecutivo de la auditoría)

Sin excepciones: no escribir a la DB en loops (todo por la RPC) · no duplicar la
lógica de cascada entre "preview" y "aplicar" · no usar sentinels (`NULL` +
funciones) · no copiar datos del proyecto en el proceso (referenciar; snapshot solo
`plan_aceptado`, explícito) · no usar `toISOString()` para fechas locales · no
llamar a la jornada sin fecha · no hardcodear máquinas/colores/vacaciones/ventana ·
no generar HTML por strings (obvio en React, pero tampoco `dangerouslySetInnerHTML`)
· no truncar loops en silencio · no dejar el par estado/estado_proceso renacer con
otros nombres.

---

## 8. Estado de avance (actualizado 05/07/2026)

### Decisiones nuevas (posteriores al Bloque 0, tras leer la fuente de primera mano)
- **Urgencia:** se DERIVA del proyecto (elemento → proyecto → urgencia). No hay
  columna de urgencia en `procesos` ni snapshot por bloque: una sola fuente de
  verdad, el color del bloque siempre refleja la urgencia real. (Reemplaza la
  urgencia editable por bloque del sistema viejo, que quedaba desactualizada.)
- **Pulmones: NO se usan.** En vez de reservar tiempo con pulmones, el planificador
  deja espacios/huecos a mano en el tablero. La infraestructura de pulmones (tabla
  `pulmones`, tipo `Pulmon`, `cargarPulmones`, rama de pulmones en la RPC) queda
  **inerte**: no se removió, pero el motor de cascada NO tiene pasada de pulmones.
  No reintroducir salvo pedido explícito.
- **Semántica de modos (confirmada contra el código viejo):**
  - `automatica`: la máquina corre 24/7 (sigue de noche y fines de semana); el
    operario ocupa solo el setup.
  - `semi_automatica`: la máquina respeta la jornada (se pausa fuera de horario); el
    operario ocupa solo el setup.
  - `manual`: todo respeta la jornada; el operario ocupa todo el bloque.
  - El margen es tiempo de máquina siempre; en manual también ocupa al operario.
  - Reglas centralizadas en `motor/modos.ts` (editables en un solo lugar).
- **Contrato Tablero → Proyectos (ampliado):** al marcar hecho el ÚLTIMO proceso
  pendiente de un elemento, se ofrece actualizar el estado del elemento
  (Terminado/Stockeado/Enviado). El tablero hace avanzar el estado físico del elemento.
- **`plan_aceptado`:** la divergencia compara por ahora 5 campos (setup, operación,
  margen, cantidad, modo). Operario y máquina sugeridos quedan pendientes de sumar al
  snapshot (no afectan el tamaño del bloque).

### Motor puro construido (todo en `features/tablero/motor/`, testeado con Vitest)
- `modos.ts` — reglas por modo (24/7, operario solo setup), centralizadas.
- `duraciones.ts` — ocupación de máquina y operario, derivadas de `plan_aceptado`.
- `calendario.ts` — el "caminar" único (jornada / 24/7); fin de máquina y de operario.
- `solapes.ts` — única definición de "dos intervalos se pisan" (gap parametrizable).
- `invariantes.ts` — reglas duras: solape de máquina, de operario (con excepción
  setup_solapable) y correlatividades. **Corrige el bug del viejo, que no validaba el
  solape de operario.**
- `preparar.ts` — ensamblado proceso planificado → bloque con sus dos intervalos.
- `simular.ts` — la cascada: punto fijo con (a) cascada de operario, (b) push de
  máquina, (c) correlatividades. **Sin pulmones.** Simulación y aplicación usan el
  mismo código (mata el bug de los dos motores del viejo).
- `divergencias.ts` — compara el proceso actual contra `plan_aceptado` (el ⚠).

### Deuda anotada (a saldar en la integración o en refactors)
- Utilidades de tiempo (`minAbs`, `proximoDiaLaboral`, `ajustarAJornada`) duplicadas
  en `simular.ts`; conviene unificarlas en `calendario.ts`.
- **Filtro de pasado** (el motor solo opera sobre presente/futuro; corte = último día
  laboral anterior a hoy): se aplica al ARMAR el estado que entra al motor (integración).
- **Conflicto residual** (dos anclas que se pisan): la cascada lo deja sin mover; falta
  detectarlo con las invariantes al final de `simular` y reportarlo como error.
- Ampliar `plan_aceptado` con operario/máquina sugeridos (para la divergencia completa).

### Roadmap restante
1. **Integración**: armar el estado real desde Supabase (procesos planificados +
   contextos de operarios + correlatividades), aplicar el filtro de pasado, cerrar la
   detección de conflicto residual y la capa de escritura (RPC `aplicar_plan_tablero`).
2. **Render estático** del tablero (solo lectura) contra `TABLERO_SPEC_VISUAL.md`.
3. **Interacción**: dnd-kit, modal de afectadas, edición del bloque, marcar hecho, undo.
