// features/tablero/calculos/geometria.ts
// -----------------------------------------------------------------------------
// La segunda mitad de la geometría del render:
//   - porcentajeLeft / porcentajeAncho: minuto y duración → % dentro de la celda
//     del día, sobre la ventana horaria (de configuraciones). (pL/pW del viejo.)
//   - asignarTracks: en qué carril va cada fragmento dentro de la columna del
//     operario, para que no se tapen. (Porta assignTracksAcrossDays.)
//
// Todo puro: no toca DB ni DOM.
// -----------------------------------------------------------------------------

import type { FechaISO } from '../../../shared/lib/fechas'

// Posición izquierda (%) de un minuto dentro de la ventana horaria del día.
export function porcentajeLeft(min: number, ventanaInicioMin: number, ventanaTotalMin: number): number {
  return Math.max(0, ((min - ventanaInicioMin) / ventanaTotalMin) * 100)
}

// Ancho (%) de una duración dentro de la ventana horaria.
export function porcentajeAncho(dur: number, ventanaTotalMin: number): number {
  return (dur / ventanaTotalMin) * 100
}

// --- Carriles -----------------------------------------------------------------

// Lo mínimo que necesita un fragmento para que se le asigne carril.
export type FragmentoBase = {
  procesoId: number
  operarioId: number
  esAuto: boolean // auto o semi → carriles ≥ 1; manual → carril 0
  fecha: FechaISO
  inicioMin: number
  finMin: number
}

export type FragmentoConTrack = FragmentoBase & { track: number }

// Asigna a cada fragmento su carril dentro de la columna del operario.
//   - Manuales → carril 0 (arriba).
//   - Auto/semi → primer carril ≥ 1 que esté libre en ese momento.
//   - Persistencia: un proceso multi-día mantiene su carril todos los días.
export function asignarTracks(frags: FragmentoBase[]): FragmentoConTrack[] {
  const res: FragmentoConTrack[] = frags.map((f) => ({ ...f, track: -1 }))

  const porOperario = new Map<number, FragmentoConTrack[]>()
  for (const f of res) {
    const arr = porOperario.get(f.operarioId)
    if (arr) arr.push(f)
    else porOperario.set(f.operarioId, [f])
  }

  for (const [, delOperario] of porOperario) {
    // Carril recordado por proceso (persiste entre días).
    const carrilDeProceso = new Map<number, number>()
    const fechas = [...new Set(delOperario.map((f) => f.fecha))].sort()

    for (const fecha of fechas) {
      const delDia = delOperario
        .filter((f) => f.fecha === fecha)
        .sort((a, b) => a.inicioMin - b.inicioMin || a.procesoId - b.procesoId)

      // finesDeCarril[i] = fin del último fragmento colocado en el carril i ese día.
      const finesDeCarril: number[] = []
      const ocupar = (carril: number, finMin: number) => {
        while (finesDeCarril.length <= carril) finesDeCarril.push(0)
        finesDeCarril[carril] = Math.max(finesDeCarril[carril], finMin)
      }

      // Pass 1: los que ya tienen carril de un día anterior.
      for (const f of delDia) {
        const c = carrilDeProceso.get(f.procesoId)
        if (c !== undefined) {
          f.track = c
          ocupar(c, f.finMin)
        }
      }

      // Pass 2a: manuales → carril 0.
      for (const f of delDia) {
        if (f.track !== -1 || f.esAuto) continue
        f.track = 0
        carrilDeProceso.set(f.procesoId, 0)
        ocupar(0, f.finMin)
      }

      // Pass 2b: auto/semi → primer carril ≥ 1 libre en su horario de inicio.
      const autos = delDia
        .filter((f) => f.track === -1 && f.esAuto)
        .sort((a, b) => a.inicioMin - b.inicioMin || a.procesoId - b.procesoId)
      for (const f of autos) {
        let c = 1
        while (finesDeCarril.length > c && finesDeCarril[c] > f.inicioMin) c++
        f.track = c
        carrilDeProceso.set(f.procesoId, c)
        ocupar(c, f.finMin)
      }

      // Fallback: cualquier fragmento sin carril → el más bajo libre.
      for (const f of delDia) {
        if (f.track !== -1) continue
        let c = 0
        while (c < finesDeCarril.length && finesDeCarril[c] > f.inicioMin) c++
        f.track = c
        carrilDeProceso.set(f.procesoId, c)
        ocupar(c, f.finMin)
      }
    }
  }

  return res
}
