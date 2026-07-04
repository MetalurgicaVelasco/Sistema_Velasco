# NEGOCIO — Cómo opera Metalúrgica Velasco

> Describe **el dominio que el sistema modela**: cómo funciona el taller en la realidad.
> Complementa `ARQUITECTURA.md` (que describe cómo se construye el sistema). Es la
> referencia del principio fundacional: el sistema modela este negocio, no un ERP.
>
> Documento vivo.

---

## 1. La empresa

- Taller metalúrgico en General Pico, La Pampa. ~18 personas.
- Trabajo **a medida / por proyecto** (no producción en serie): cada trabajo es distinto.
  En la literatura industrial se llama **job shop** (lotes chicos, rutas de proceso
  variables, alta participación de operarios calificados). Por eso los ERPs de
  manufactura tradicionales no encajan: están pensados para producción repetitiva.
- Coordinación general (clientes, trabajos, compras, logística, administración): Tomás.
- Hay una dinámica de **trabajos que se toman por contactos personales**: los clientes
  habituales se comunican directamente con Héctor, Nicolás, Lucas o Tomás. Las consultas
  nuevas entran por recepción (Daniel). Esa entrada distribuida genera ruido (trabajos
  que aparecen cargados sin que el resto del equipo sepa de qué se trata, riesgo de
  cargar el mismo trabajo dos veces, etc.); ordenar ese flujo es uno de los objetivos
  del sistema.

---

## 2. Las tres secciones (capacidades productivas)

1. **Mecanizado Convencional:** tornería pesada, soldadura y armado.
2. **Mecanizado CNC:** 2 máquinas de electroerosión, 1 fresadora CNC, 2 centros de
   mecanizado HAAS (VF3-YT y VF4), torno HAAS ST-30, torno Travis TR-1.
3. **Plegadora:** guillotina, plegadora, roladora, 2 pantógrafos, soldadoras y puente grúa
   de 5 tn. Se usa también para trabajos de gran porte.

---

## 3. Roles y personas

- **Coordinación general (Tomás):** contacto con clientes, coordinación de trabajos,
  compras, logística, procesos administrativos. Referente del sistema interno. Toma
  trabajos directamente. Es el principal responsable de cargar los trabajos confirmados
  a TacticaSoft y de emitir la mayoría de los presupuestos formales.
- **Dirección / dueño (Héctor):** toma trabajos directamente, pero no los carga al
  sistema; le pasa la información a otra persona (recepción o Tomás) para que se cargue.
- **Encargado de CNC (Nicolás, hijo de Héctor):** toma trabajos y trabaja de forma
  ordenada con el sistema.
- **Encargado de Plegadora (Lucas, hijo de Héctor):** toma trabajos en su sector. No los
  carga directamente a TacticaSoft; los hace y después pide que se carguen. Trabaja
  mucho con una planilla de Sheets paralela (cortes, cliente, valor). Hay un plan abierto
  de que use TacticaSoft desde la Plegadora y dejar de usar el Sheets.
- **Administración (Julieta, hija de Héctor):** facturas de venta, facturas de compra,
  liquidaciones de sueldo, etc. No toma trabajos. Estuvo en recepción y está formando a
  Daniel.
- **Recepción (Daniel):** atiende a quienes entran al taller, deriva consultas, hace
  órdenes de compra para el sector convencional (ferretería, bulonería), y a corto/mediano
  plazo va a empezar a cargar facturas de compra y emitir facturas de venta. Es a quien
  Héctor le pasa los trabajos para que se carguen.
- **Operarios** (tabla `personal`): ejecutan los procesos en las máquinas. Los que
  aparecen referenciados explícitamente en el negocio: Román Panero, Ariel Maldez,
  Tomás Carrillo, Alfredo, entre otros. Cada operario tiene una máquina o conjunto de
  máquinas en las que opera habitualmente.
- **Oficina Técnica:** maneja planos y documentos (sube y revisa adjuntos). Es la
  responsable de armar las carpetas de trabajo y enviar el mail estandarizado al
  operario asignado.

> ⚠ A confirmar / expandir: cómo se agrupan formalmente los operarios por sección,
> qué operario opera habitualmente cada máquina (ya hay datos parciales: Alfredo
> trabaja torno convencional; Ariel hace fresado en VF3-YT; Tomás Carrillo hace
> electroerosión en AR-3300; etc.), y dónde encaja Oficina Técnica respecto del resto
> del organigrama.

---

## 4. Conceptos centrales del dominio

> **Vocabulario (definido 03/07/2026):**
> - **Elemento**: cualquier nodo del árbol de un proyecto (raíz o anidado). Es lo que
>   guarda la tabla `elementos`.
> - **Item**: el elemento **raíz** — la "fila" del pedido, la que no cuelga de ningún
>   otro. Un item nunca está anidado. Su tipo puede ser Conjunto o Componente.
> - **Tipo** de un elemento: **Conjunto** (contiene otros), **Subconjunto** (contenedor
>   anidado) o **Componente** (la hoja: pieza o servicio individual e indivisible).
> - **Producto**: categoría de negocio — lo que se cataloga en la **Matriz de Productos**
>   por ser de venta recurrente / stock. Un componente puede estar o no catalogado como
>   producto. "Producto" ya no nombra un nivel del árbol.
> - **Anidado**: subconjunto o componente que cuelga de un contenedor (nunca un item).

El sistema modela el avance en **dos niveles distintos**, y es clave no confundirlos:

- **Estado del proyecto** = estado *comercial / de coordinación* (en qué punto está el
  trabajo de cara al cliente y a la organización).
- **Estado del elemento** = avance *físico* de la pieza dentro del taller.

Conceptos:

- **Empresa:** una entidad que puede ser cliente, proveedor o ambos.
- **Proyecto:** un trabajo para un cliente. Es el mismo registro que avanza por estados;
  no se duplica al pasar de consulta a pedido confirmado. **Estados de proyecto (reales,
  en uso):** `Proyectando, Solicitud, Pedido, Mantenimiento, Cerrado, Anulado, Perdido`.
  - `Cerrado` tiene un sub-estado: `Enviado / Terminado / Stockeado`.
  - `Mantenimiento` es para trabajos internos del taller (cliente "Metalúrgica Velasco").
  - `Perdido` = consultas que no se concretaron.
  - `Anulado` = pedidos cancelados después de confirmarse.
- **Item:** cada "fila" del pedido dentro de un proyecto — un **elemento raíz** (no
  cuelga de ningún otro). Su tipo puede ser directamente un **Componente** (pieza suelta)
  o un **Conjunto** que contiene subconjuntos y componentes **anidados**. Un item, por
  definición, nunca está anidado. Nota sobre el "item" de TacticaSoft: en Táctica el item
  es la fila plana e inmodificable de un presupuesto/pedido/remito/factura; acá un item
  que es Conjunto **se despliega en subconjuntos y componentes anidados** (no en "más
  items"). Ej: la fila "boca de alimentación" de Táctica entra al sistema como un item de
  tipo Conjunto con sus componentes adentro.
- **Elemento:** cualquier nodo del árbol (raíz o anidado). Los items son los elementos
  raíz; lo que cuelga de un conjunto/subconjunto son elementos anidados. En la base, la
  tabla `elementos` guarda todos (con `parent_elemento_id` para la anidación).
- **Componente:** la pieza o servicio individual e indivisible que efectivamente se
  fabrica o se resuelve (la hoja del árbol).
- **Proceso:** cada paso de trabajo de un elemento. Los procesos **pueden colgar de
  cualquier nivel** (conjunto, subconjunto o componente) y se multiplican por la cantidad
  del elemento que los contiene: por ejemplo, la soldadura/control/despacho del conjunto
  armado cuelgan del propio conjunto. Los procesos son lo que se planifica en el
  Tablero. Cada proceso tiene un tipo, una duración estimada, una máquina sugerida y un
  operario sugerido por Oficina Técnica. **Tipos de proceso estándar:** Agujereado, Armado,
  Compra, Control, Corte, Desarme y limpieza, Despacho, Electroerosión, Fresado, Plegado,
  Relevamiento, Soldadura, Torneado, Tratamiento térmico, más "Otro" (texto libre).
- **Correlatividades (predecesores):** los procesos tienen orden; un proceso puede depender
  de que otro se haya completado antes. Se crean automáticamente al agregar procesos
  secuenciales a un item (el nuevo proceso tiene como predecesor al inmediatamente
  anterior) y se pueden modificar a mano. Existen correlatividades **dentro del mismo
  item** (lo normal) y, en menor medida, entre items del mismo proyecto.

---

## 5. Matriz de Productos (catálogo del cliente)

Representa cómo viven las piezas en la planta del cliente. Es información **reutilizable**:
se carga una vez y se usa en muchos proyectos. No se cataloga todo lo que se fabrica: se
cargan los **productos** — lo que se vende con frecuencia o se suele tener en estantería.

`Cliente → Sector → Equipo → Conjunto → Subconjunto → Componente → Procesos`

Cuando un proyecto necesita un producto que ya está en la matriz, se importa: se crea un
item nuevo en el proyecto con todos los procesos, ubicaciones y datos del producto matriz
como punto de partida. Una vez importado, el item del proyecto es **independiente** del
producto matriz: cambios futuros en la matriz no se propagan al item (y viceversa). Queda
guardado el vínculo histórico (`imported_from_matriz_id`) solo a efectos de poder
consultar "todos los proyectos que tienen el producto X de matriz", aun si el item local
fue modificado.

Los productos de matriz también tienen **notas** (documentación reutilizable: criterios
de aceptación, observaciones técnicas, etc.) que se copian al item al importar.

(Detalle del modelo y la navegación en `ARQUITECTURA.md`, sección 8.)

---

## 6. El Tablero (planificación)

El tablero muestra los **procesos planificados** como bloques. Cada bloque es un proceso de
un item de un proyecto, y tiene tres atributos a la vez: **fecha, máquina y operario**. Por
eso las distintas vistas del tablero no son sistemas distintos: son **agrupaciones del
mismo dato**.

### Dos vistas del mismo dato

- **Vista por operarios (vigente, de planificación):** operarios en columnas, días en
  filas. Es la que se usa en el día a día y donde se **edita**: se arrastran bloques, se
  asigna y se reprograma. La planificación real se hace acá.
- **Vista por máquinas (complementaria, de revisión):** sirve para **detectar máquinas
  ociosas** (paradas sin trabajo) o sobrecargadas — algo que no se ve planificando por
  operario. Es principalmente de lectura. Existió una versión vieja (días × máquina) que
  quedó en desuso y puede tener bugs; en React se rehace como **visor** sobre el mismo
  modelo, más simple que el editor de operarios.

Cada celda representa la jornada de ese operario (o máquina) ese día; los bloques se ubican
dentro con drag and drop. Si un item tiene tres procesos (ej. torneado, fresado,
electroerosión), son tres bloques, posiblemente en máquinas y operarios distintos, con
correlatividad entre ellos.

### Reglas de planificación

- **Sin solapamientos (restricciones duras):** dos procesos no pueden ocupar la misma
  **máquina** al mismo tiempo, ni el mismo **operario** al mismo tiempo. Las dos son
  imposibles físicos que el sistema debe impedir.
- **Excepción CNC (proceso automático):** en un proceso automático, el operario solo está
  ocupado durante el **setup**; una vez que la máquina arranca sola, el operario queda
  libre para atender otra máquina, pero **la máquina sigue ocupada** hasta que el proceso
  termina. En la práctica un operario maneja 2 máquinas en simultáneo (a veces 3, raro 4).
- **Correlatividades:** un proceso sucesor no puede arrancar antes de que termine su
  predecesor. Si la correlatividad se rompe (se planificó el sucesor antes de que el
  predecesor tuviera fecha), el bloque del sucesor muestra un badge ⛔ rojo de
  "Inconsistente" para resolver a mano.
- **Cascadeo al mover/extender un bloque:** cuando un bloque se mueve a un horario donde
  pisa otros, o se le aumenta la duración, el motor calcula qué procesos posteriores quedan
  afectados y muestra un modal con la lista; el usuario acepta o cancela.
- **Marcar como hecho:** los bloques completados se muestran desaturados (grayscale + leve
  opacidad), conservando el color base de urgencia.

### Visualización

- Filas alternas en beige sutil.
- Día actual destacado.
- Días pasados con fondo gris.
- Sábados con la zona post-12:00 en gris (jornada parcial). Los domingos no se muestran.
- Color de **fondo del bloque** = urgencia del proyecto (rojo, amarillo, gris/verde).
- Color del **borde del bloque** = operario asignado.
- Ancho del bloque proporcional a la duración del proceso.
- Procesos automáticos largos pueden cruzar varios días; el sistema los parte
  visualmente respetando la jornada laboral.

> ⚠ A confirmar / expandir: definición operativa de la jornada laboral (horarios por
> operario, sábados especiales), reglas precisas para procesos que cruzan días, y
> reglas del modal "elegir punto de inserción" cuando no hay hueco que contenga el
> proceso completo.

---

## 7. Documentos del trabajo

- Planos (PDF), sólidos de SolidWorks, archivos de AutoCAD.
- Se versionan por **revisión** (Rev A, B, C...); la vigente manda, las viejas quedan como
  históricas. (Detalle en `ARQUITECTURA.md`, sección 10.)
- Para cada item que va a producción, Oficina Técnica genera una **carpeta de trabajo**
  física: una portada con los datos del proyecto (cliente, pieza, pedido, cantidad,
  material, fechas, foto representativa), una tabla de procesos con responsable y casillero
  para tildar el realizado, y una **Orden de Trabajo (OT)** por cada proceso, que es la
  hoja que va con la pieza por el taller.
- En paralelo a la carpeta, Oficina Técnica envía un **mail estandarizado** con la
  información general del trabajo, número de pedido, fecha de entrega, procesos
  aproximados, fotos y adjuntos.

---

## 8. Salidas y comprobantes operativos

- **Remitos:** se generan en TacticaSoft. En el sistema solo se **registra** que un item
  ya se envió y con qué número de remito, para trazabilidad.
- **Notas de envío:** son un documento propio del taller que TacticaSoft no contempla.
  Históricamente se hacían en Word manualmente y se guardaban en Drive; el sistema
  unificó esa generación con numeración automática y vínculo al proyecto. Existen además
  **notas de envío externas**, que son notas hechas a mano antes de tener el sistema y se
  cargan retroactivamente con su número impreso original.
- **Facturación:** hoy se hace en TacticaSoft (futuro en `ARQUITECTURA.md`, sección 11).

---

## 9. Sistemas que conviven hoy

- **TacticaSoft:** sistema administrativo / comercial / fiscal actual. Facturación,
  pedidos, cotizaciones formales, etc. El sistema interno **no reemplaza** a TacticaSoft
  en ese ámbito; lo complementa.
- **Velasco App 1:** PWA hecha con Apps Script + Google Sheets, para tracking de
  actividades de CNC. Sigue en uso.
- **Sheets de Lucas (Plegadora):** planilla paralela donde el encargado de Plegadora
  registra sus cortes. Plan abierto de reemplazarlo con uso directo de TacticaSoft.
- **Velasco App 2.0 (HTML):** el sistema operativo actual, en uso. Es el que se está
  reescribiendo en React. Queda como referencia funcional.

---

## 10. Para completar

- [ ] Reglas detalladas de jornada laboral (horarios por operario incluyendo sábado).
- [ ] Asignación habitual operario ↔ máquina (qué operario opera cada máquina por defecto).
- [ ] Cómo se manejan las **compras** asociadas a un proyecto (existe el proceso tipo
      "Compra" y existen órdenes de compra para ferretería, pero falta un flujo claro de
      "esta materia prima la pidió Daniel a este proveedor para este proyecto").
- [ ] Cómo se manejan los **materiales** propios del proyecto (entrada de materia prima,
      estados de item `Espera MP / Llegó MP`).
- [ ] Logística de entrega: cómo se coordina el despacho real (transporte, retiro por el
      cliente, etc.) más allá del documento de la nota de envío.
- [ ] **Tratamiento térmico** externo: los estados de item incluyen `Enviar a TT, TT,
      Llegó TT`, lo que indica que es un flujo importante. Documentar cómo se maneja
      (proveedor externo, plazos típicos, etc.).
- [ ] Roles que aún no están claros: dónde encaja formalmente Oficina Técnica en el
      organigrama y quiénes la componen.
