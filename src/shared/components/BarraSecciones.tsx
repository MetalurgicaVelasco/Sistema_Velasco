// Lista de las 12 secciones del sistema.
// El emoji es provisorio (después se reemplaza por imágenes).
const SECCIONES = [
  { id: 'empresas', emoji: '🏢', titulo: 'Empresas' },
  { id: 'produccion', emoji: '🔧', titulo: 'Producción' },
  { id: 'ventas', emoji: '💰', titulo: 'Ventas' },
  { id: 'compras', emoji: '🛒', titulo: 'Compras' },
  { id: 'inventarios', emoji: '📦', titulo: 'Inventarios' },
  { id: 'rrhh', emoji: '👥', titulo: 'RRHH' },
  { id: 'activos', emoji: '🏭', titulo: 'Activos' },
  { id: 'fondos', emoji: '🏦', titulo: 'Fondos' },
  { id: 'contabilidad', emoji: '📊', titulo: 'Contabilidad' },
  { id: 'configuraciones', emoji: '⚙️', titulo: 'Configuraciones' },
  { id: 'actividades', emoji: '✅', titulo: 'Actividades' },
  { id: 'portal', emoji: '🌐', titulo: 'Portal Clientes' },
]

function BarraSecciones() {
  return (
    <nav className="barra-secciones">
      {SECCIONES.map((seccion) => (
        <button key={seccion.id} className="seccion-boton" type="button">
          <span className="seccion-emoji">{seccion.emoji}</span>
          <span className="seccion-titulo">{seccion.titulo}</span>
        </button>
      ))}
    </nav>
  )
}

export default BarraSecciones
