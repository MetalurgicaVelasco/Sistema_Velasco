import { useEffect, useRef, useState } from 'react'
import { cargarPreferencia, guardarPreferencia } from '../lib/preferenciasApi'
import type { ConfigTabla, OrdenTabla } from '../components/TablaConfigurable'

// Config de una tabla (columnas + orden de filas) persistida por usuario.
type Guardado = { columnas: ConfigTabla; orden: OrdenTabla }

// Ata la config de una TablaConfigurable a `preferencias_ui`:
//  - al montar, carga lo guardado (si no hay nada, usa el default);
//  - al cambiar, guarda con un retraso (así el arrastre del ancho no escribe
//    una fila por píxel).
//
// `defecto` se usa tal cual la primera vez. Si más adelante se agregan columnas
// nuevas al módulo, se suman al final de lo guardado (no se pierden).
export function useConfigTabla(clave: string, defecto: ConfigTabla) {
  const [columnas, setColumnas] = useState<ConfigTabla>(defecto)
  const [orden, setOrden] = useState<OrdenTabla>(null)
  const [listo, setListo] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let vivo = true
    cargarPreferencia<Guardado>(clave).then((g) => {
      if (!vivo) return
      if (g?.columnas?.length) {
        // Conciliar con el default: se descartan columnas que ya no existen y
        // se agregan (al final) las nuevas que aún no estaban guardadas.
        const porDefecto = new Map(defecto.map((c) => [c.id, c] as const))
        // Si lo guardado no trae ancho (configs viejas), se toma el del default:
        // con el layout fijo TODAS las columnas necesitan un ancho, salvo la de
        // relleno, que es la que absorbe el sobrante.
        const guardadas = g.columnas
          .filter((c) => porDefecto.has(c.id))
          .map((c) => (c.ancho == null ? { ...c, ancho: porDefecto.get(c.id)?.ancho } : c))
        const idsGuardadas = new Set(guardadas.map((c) => c.id))
        const faltantes = defecto.filter((c) => !idsGuardadas.has(c.id))
        setColumnas([...guardadas, ...faltantes])
        setOrden(g.orden ?? null)
      }
      setListo(true)
    })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  // Guardado diferido (solo después de la carga inicial, para no pisar lo
  // guardado con el default mientras carga).
  useEffect(() => {
    if (!listo) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      guardarPreferencia(clave, { columnas, orden })
    }, 600)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnas, orden, listo, clave])

  return { columnas, setColumnas, orden, setOrden }
}
