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

function App() {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null)
  // Filtro que se aplica en el módulo destino al saltar por un enlazado.
  const [filtroEntrante, setFiltroEntrante] = useState<NavFiltro | null>(null)
  // Acciones que el módulo activo publica en la barra (a la derecha de los módulos).
  const [accionesBarra, setAccionesBarra] = useState<React.ReactNode>(null)

  // Navegación cross-módulo: cambia de módulo y deja el filtro para el destino.
  function navegar(sel: Seleccion, filtro: NavFiltro) {
    setSeleccion(sel)
    setFiltroEntrante(filtro)
  }

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

  function renderContenido() {
    if (!seleccion) {
      return <div className="bienvenida">Elegí un módulo para empezar</div>
    }

    if (seleccion.seccionId === 'empresas' && seleccion.moduloId === 'empresas') {
      return <Empresas filtroEntrante={filtroEntrante} onNavegar={navegar} />
    }

    if (
      seleccion.seccionId === 'produccion' &&
      seleccion.moduloId === 'proyectos'
    ) {
      return <Proyectos onNavegar={navegar} filtroEntrante={filtroEntrante} />
    }

    if (
      seleccion.seccionId === 'produccion' &&
      seleccion.moduloId === 'procesos'
    ) {
      return <Procesos />
    }

    if (seleccion.seccionId === 'produccion' && seleccion.moduloId === 'tablero') {
      return <Tablero onAcciones={setAccionesBarra} />
    }

    if (seleccion.seccionId === 'produccion' && seleccion.moduloId === 'matriz') {
      return <Matriz />
    }

    if (
      seleccion.seccionId === 'activos' &&
      seleccion.moduloId === 'maquinas'
    ) {
      return <Maquinas />
    }

    if (
      seleccion.seccionId === 'rrhh' &&
      seleccion.moduloId === 'personal'
    ) {
      return <Personal />
    }

    if (
      seleccion.seccionId === 'actividades' &&
      seleccion.moduloId === 'actividades-personal'
    ) {
      return <MisActividades />
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
          {renderContenido()}
        </Suspense>
      </main>
    </div>
  )
}

export default App
