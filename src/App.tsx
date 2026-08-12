import { useState, useEffect, lazy, Suspense } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './shared/lib/supabaseClient'
import BarraSecciones from './shared/components/BarraSecciones'
import type { Seleccion } from './shared/components/BarraSecciones'
import type { NavFiltro } from './shared/types/navegacion'
import Encabezado from './shared/components/Encabezado'
import Login from './shared/components/Login'
import './App.css'

// Cada módulo se descarga recién cuando se entra a él (code splitting). Antes
// todo viajaba en un solo archivo: abrir Proyectos bajaba también el Tablero, la
// Matriz, Empresas, etc. Con esto la primera carga es mucho más liviana.
const Empresas = lazy(() => import('./features/empresas/Empresas'))
const Proyectos = lazy(() => import('./features/produccion/Proyectos'))
const Procesos = lazy(() => import('./features/produccion/Procesos'))
const Matriz = lazy(() => import('./features/produccion/Matriz'))
const Maquinas = lazy(() => import('./features/activos/Maquinas'))
const Personal = lazy(() => import('./features/rrhh/Personal'))
const Tablero = lazy(() => import('./features/tablero/Tablero'))
const MisActividades = lazy(() => import('./features/actividades/MisActividades'))

// Módulos que quedan MONTADOS al salir de ellos: se ocultan en vez de
// desmontarse, así al volver aparecen al instante y con todo como estaba
// (datos, scroll, lo que se estuviera escribiendo).
//
// El Tablero queda afuera a propósito: es el más pesado y el que más trabajo de
// fondo hace, así que se recarga cada vez.
const MODULOS_CON_MEMORIA = new Set([
  'empresas/empresas',
  'produccion/proyectos',
  'produccion/procesos',
  'produccion/matriz',
  'activos/maquinas',
  'rrhh/personal',
  'actividades/actividades-personal',
])

function claveDe(s: Seleccion): string {
  return `${s.seccionId}/${s.moduloId}`
}

function App() {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null)
  // Filtro que se aplica en el módulo destino al saltar por un enlazado.
  const [filtroEntrante, setFiltroEntrante] = useState<NavFiltro | null>(null)
  // Acciones que el módulo activo publica en la barra (a la derecha de los módulos).
  const [accionesBarra, setAccionesBarra] = useState<React.ReactNode>(null)
  // Módulos ya visitados: se mantienen montados (ocultos) para volver sin espera.
  const [montados, setMontados] = useState<string[]>([])

  // Navegación cross-módulo: cambia de módulo y deja el filtro para el destino.
  function navegar(sel: Seleccion, filtro: NavFiltro) {
    setSeleccion(sel)
    setFiltroEntrante(filtro)
  }

  // Al entrar a un módulo con memoria, queda montado de acá en adelante.
  useEffect(() => {
    if (!seleccion) return
    const clave = claveDe(seleccion)
    if (!MODULOS_CON_MEMORIA.has(clave)) return
    setMontados((prev) => (prev.includes(clave) ? prev : [...prev, clave]))
  }, [seleccion])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_evento, nuevaSesion) => {
        setSesion(nuevaSesion)
      },
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  // Qué componente corresponde a cada módulo con memoria.
  function moduloDe(clave: string) {
    switch (clave) {
      case 'empresas/empresas':
        return <Empresas filtroEntrante={filtroEntrante} onNavegar={navegar} />
      case 'produccion/proyectos':
        return <Proyectos onNavegar={navegar} filtroEntrante={filtroEntrante} />
      case 'produccion/procesos':
        return <Procesos />
      case 'produccion/matriz':
        return <Matriz />
      case 'activos/maquinas':
        return <Maquinas />
      case 'rrhh/personal':
        return <Personal />
      case 'actividades/actividades-personal':
        return <MisActividades />
      default:
        return null
    }
  }

  // Lo que se muestra cuando el módulo activo NO tiene memoria: el tablero, la
  // bienvenida o el cartel de "en construcción".
  function contenidoSinMemoria() {
    if (!seleccion) {
      return <div className="bienvenida">Elegí un módulo para empezar</div>
    }
    if (seleccion.seccionId === 'produccion' && seleccion.moduloId === 'tablero') {
      return <Tablero onAcciones={setAccionesBarra} />
    }
    return (
      <div className="contenido">
        <div className="contenido-emoji">🚧</div>
        <div className="contenido-titulo">{seleccion.moduloTitulo}</div>
        <div className="contenido-texto">En construcción</div>
      </div>
    )
  }

  if (cargando) {
    return <div className="app-cargando">Cargando…</div>
  }

  if (!sesion) {
    return <Login />
  }

  return (
    <div className="app">
      <Encabezado email={sesion.user.email} />
      <BarraSecciones
        accionesDerecha={accionesBarra}
        onSeleccion={(s) => {
          setSeleccion(s)
          setFiltroEntrante(null)
          setAccionesBarra(null) // cada módulo publica las suyas al montarse
        }}
      />
      <main className="contenido-area">
        {/* Mientras baja el módulo elegido. Se ve solo la primera vez que se
            entra a cada uno: después queda en la caché del navegador. */}
        <Suspense fallback={<div className="app-cargando">Cargando módulo…</div>}>
          {/* Los módulos ya visitados siguen montados y solo se ocultan: volver
              a ellos es instantáneo y conservan lo que había. */}
          {montados.map((clave) => (
            <div
              key={clave}
              className={
                'modulo-slot' + (seleccion && claveDe(seleccion) === clave ? '' : ' modulo-slot-oculto')
              }
            >
              {moduloDe(clave)}
            </div>
          ))}
          {(!seleccion || !MODULOS_CON_MEMORIA.has(claveDe(seleccion))) && contenidoSinMemoria()}
        </Suspense>
      </main>
    </div>
  )
}

export default App
