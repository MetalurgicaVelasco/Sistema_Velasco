import type { Seleccion } from '../components/BarraSecciones'

// Filtro que viaja al saltar de un módulo a otro por un concepto enlazado
// (ej: click en el nombre de una empresa desde Proyectos → Empresas filtrado).
export type NavFiltro = { tipo: 'empresa'; empresaId: number }

// Función de navegación cross-módulo que App le pasa a los módulos: cambia de
// sección/módulo y deja un filtro entrante para que el destino lo aplique.
export type Navegar = (seleccion: Seleccion, filtro: NavFiltro) => void
