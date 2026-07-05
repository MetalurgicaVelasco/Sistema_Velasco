import { useState } from 'react'

// Tipos de los datos de navegación.
type Modulo = { id: string; emoji: string; titulo: string; disponible: boolean }
type Seccion = { id: string; emoji: string; titulo: string; modulos: Modulo[] }

// Lo que BarraSecciones le "avisa" a App cuando se elige un módulo.
export type Seleccion = {
  seccionId: string
  moduloId: string
  moduloTitulo: string
}

// `disponible: true`  -> módulo clickeable.
// `disponible: false` -> módulo en gris, no clickeable.
const SECCIONES: Seccion[] = [
  {
    id: 'empresas',
    emoji: '🏢',
    titulo: 'Empresas',
    modulos: [
      { id: 'empresas', emoji: '🏢', titulo: 'Empresas', disponible: true },
      { id: 'sectores-equipos', emoji: '🗂️', titulo: 'Sectores/Equipos', disponible: true },
      { id: 'contactos', emoji: '📇', titulo: 'Contactos', disponible: true },
      { id: 'transportes', emoji: '🚚', titulo: 'Transportes', disponible: true },
      { id: 'dashboard', emoji: '📈', titulo: 'Dashboard', disponible: true },
    ],
  },
  {
    id: 'produccion',
    emoji: '🔧',
    titulo: 'Producción',
    modulos: [
      { id: 'proyectos', emoji: '📋', titulo: 'Proyectos', disponible: true },
      { id: 'tablero', emoji: '📅', titulo: 'Tablero', disponible: true },
      { id: 'productos', emoji: '🔩', titulo: 'Productos', disponible: true },
      { id: 'procesos', emoji: '⚙️', titulo: 'Procesos', disponible: true },
      { id: 'matriz', emoji: '🧩', titulo: 'Matriz de Productos', disponible: true },
      { id: 'mantenimientos', emoji: '🔧', titulo: 'Mantenimientos', disponible: true },
      { id: 'dashboard', emoji: '📈', titulo: 'Dashboard', disponible: true },
    ],
  },
  {
    id: 'ventas',
    emoji: '🤝',
    titulo: 'Ventas',
    modulos: [
      { id: 'solicitudes', emoji: '📝', titulo: 'Solicitudes', disponible: false },
      { id: 'presupuestos', emoji: '📄', titulo: 'Presupuestos', disponible: false },
      { id: 'pedidos', emoji: '📋', titulo: 'Pedidos', disponible: false },
      { id: 'facturas', emoji: '🧾', titulo: 'Facturas', disponible: false },
      { id: 'remitos', emoji: '📦', titulo: 'Remitos', disponible: false },
      { id: 'recibos', emoji: '💳', titulo: 'Recibos', disponible: false },
      { id: 'dashboard', emoji: '📈', titulo: 'Dashboard', disponible: false },
    ],
  },
  {
    id: 'compras',
    emoji: '🛒',
    titulo: 'Compras',
    modulos: [
      { id: 'ordenes-compra', emoji: '📝', titulo: 'Órdenes de Compra', disponible: false },
      { id: 'compras', emoji: '🛒', titulo: 'Compras', disponible: false },
      { id: 'pagos', emoji: '💳', titulo: 'Pagos', disponible: false },
      { id: 'recepcion', emoji: '📥', titulo: 'Recepción', disponible: false },
      { id: 'recibos-proveedor', emoji: '🧾', titulo: 'Recibos Proveedor', disponible: false },
      { id: 'dashboard', emoji: '📈', titulo: 'Dashboard', disponible: false },
    ],
  },
  {
    id: 'inventarios',
    emoji: '📦',
    titulo: 'Inventarios',
    modulos: [
      { id: 'matriz', emoji: '🧩', titulo: 'Matriz de Productos', disponible: true },
      { id: 'stock', emoji: '📦', titulo: 'Stock', disponible: true },
      { id: 'depositos', emoji: '🏬', titulo: 'Depósitos', disponible: true },
      { id: 'movimientos', emoji: '🔄', titulo: 'Movimientos', disponible: true },
      { id: 'reservas', emoji: '🔖', titulo: 'Reservas', disponible: true },
      { id: 'materiales', emoji: '🧱', titulo: 'Materiales', disponible: true },
      { id: 'dashboard', emoji: '📈', titulo: 'Dashboard', disponible: true },
    ],
  },
  {
    id: 'rrhh',
    emoji: '👷',
    titulo: 'RRHH',
    modulos: [
      { id: 'personal', emoji: '👤', titulo: 'Personal', disponible: true },
      { id: 'vacaciones', emoji: '🏖️', titulo: 'Vacaciones', disponible: true },
      { id: 'asistencia', emoji: '🕐', titulo: 'Asistencia', disponible: true },
      { id: 'liquidaciones', emoji: '💵', titulo: 'Liquidaciones', disponible: true },
      { id: 'dashboard', emoji: '📈', titulo: 'Dashboard', disponible: true },
    ],
  },
  {
    id: 'activos',
    emoji: '🏭',
    titulo: 'Activos',
    modulos: [
      { id: 'propiedades', emoji: '🏠', titulo: 'Propiedades', disponible: false },
      { id: 'maquinas', emoji: '🛠️', titulo: 'Máquinas', disponible: true },
      { id: 'mantenimientos', emoji: '🔧', titulo: 'Mantenimientos', disponible: true },
      { id: 'dashboard', emoji: '📈', titulo: 'Dashboard', disponible: true },
    ],
  },
  {
    id: 'fondos',
    emoji: '💰',
    titulo: 'Fondos',
    modulos: [
      { id: 'cuentas', emoji: '🏦', titulo: 'Cuentas', disponible: false },
      { id: 'movimientos', emoji: '🔄', titulo: 'Movimientos', disponible: false },
    ],
  },
  {
    id: 'contabilidad',
    emoji: '📊',
    titulo: 'Contabilidad',
    modulos: [
      { id: 'plan-cuentas', emoji: '📒', titulo: 'Plan de Cuentas', disponible: false },
      { id: 'asientos', emoji: '✍️', titulo: 'Asientos', disponible: false },
      { id: 'libros', emoji: '📚', titulo: 'Libros', disponible: false },
      { id: 'balances', emoji: '⚖️', titulo: 'Balances', disponible: false },
    ],
  },
  {
    id: 'configuraciones',
    emoji: '⚙️',
    titulo: 'Configuraciones',
    modulos: [
      { id: 'monedas', emoji: '💱', titulo: 'Monedas', disponible: true },
      { id: 'talonarios', emoji: '🎫', titulo: 'Talonarios', disponible: false },
      { id: 'usuarios', emoji: '👤', titulo: 'Usuarios', disponible: true },
      { id: 'roles', emoji: '🔑', titulo: 'Roles', disponible: true },
    ],
  },
  {
    id: 'actividades',
    emoji: '✅',
    titulo: 'Actividades',
    modulos: [
      { id: 'registro-operarios', emoji: '📝', titulo: 'Registro de Operarios', disponible: true },
      { id: 'actividades-personal', emoji: '✅', titulo: 'Actividades Personal', disponible: true },
      { id: 'logistica', emoji: '🚚', titulo: 'Logística', disponible: true },
      { id: 'tablero', emoji: '📅', titulo: 'Tablero', disponible: true },
    ],
  },
  {
    id: 'portal',
    emoji: '🌐',
    titulo: 'Portal Clientes',
    modulos: [
      { id: 'solicitudes', emoji: '📝', titulo: 'Solicitudes', disponible: false },
      { id: 'presupuestos', emoji: '📄', titulo: 'Presupuestos', disponible: false },
      { id: 'pedidos', emoji: '📋', titulo: 'Pedidos', disponible: false },
      { id: 'facturas', emoji: '🧾', titulo: 'Facturas', disponible: false },
      { id: 'remitos', emoji: '📦', titulo: 'Remitos', disponible: false },
      { id: 'recibos', emoji: '💳', titulo: 'Recibos', disponible: false },
    ],
  },
]

// `onSeleccion` es la función que nos pasa App: la llamamos para avisarle
// qué se eligió (o null cuando se cambia de sección y todavía no hay módulo).
function BarraSecciones({
  onSeleccion,
}: {
  onSeleccion: (seleccion: Seleccion | null) => void
}) {
  const [seccionActivaId, setSeccionActivaId] = useState<string | null>(null)
  const [moduloActivoId, setModuloActivoId] = useState<string | null>(null)

  const seccionActiva = SECCIONES.find((s) => s.id === seccionActivaId)

  function elegirSeccion(id: string) {
    setSeccionActivaId(id)
    setModuloActivoId(null)
    onSeleccion(null) // cambiar de sección limpia el contenido -> bienvenida
  }

  function elegirModulo(modulo: Modulo) {
    if (!seccionActiva) return
    setModuloActivoId(modulo.id)
    onSeleccion({
      seccionId: seccionActiva.id,
      moduloId: modulo.id,
      moduloTitulo: modulo.titulo,
    })
  }

  return (
    <div className="navegacion">
      {/* Fila 1: secciones */}
      <nav className="barra-secciones">
        {SECCIONES.map((seccion) => (
          <button
            key={seccion.id}
            type="button"
            className={
              'seccion-boton' + (seccion.id === seccionActivaId ? ' activa' : '')
            }
            onClick={() => elegirSeccion(seccion.id)}
          >
            <span className="seccion-emoji">{seccion.emoji}</span>
            <span className="seccion-titulo">{seccion.titulo}</span>
          </button>
        ))}
      </nav>

      {/* Fila 2: módulos de la sección activa */}
      {seccionActiva && (
        <nav className="barra-modulos">
          {seccionActiva.modulos.map((modulo) => (
            <button
              key={modulo.id}
              type="button"
              className={
                'modulo-boton' + (modulo.id === moduloActivoId ? ' activo' : '')
              }
              disabled={!modulo.disponible}
              onClick={() => elegirModulo(modulo)}
            >
              <span className="modulo-emoji">{modulo.emoji}</span>
              <span className="modulo-titulo">{modulo.titulo}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}

export default BarraSecciones
