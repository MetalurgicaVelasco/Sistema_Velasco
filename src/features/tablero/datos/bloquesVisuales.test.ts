import { describe, it, expect } from 'vitest'
import { armarBloquesVisuales, type DatosTablero } from './bloquesVisuales'
import type { ProcesoTablero, PersonalTablero, MaquinaTablero } from '../tipos'

const operario: PersonalTablero = {
  id: 3, nombre: 'Juan', apellido: 'Pérez',
  horarioEntrada: '06:00:00', horarioSalida: '15:00:00',
  horarioSabadoInicio: null, horarioSabadoFin: null,
  colorBorde: null, ordenTablero: 1,
}
const maquina: MaquinaTablero = { id: 5, nombre: 'VF4', color: '#73bbf5' }

function proc(o: Partial<ProcesoTablero>): ProcesoTablero {
  return {
    id: 1, elementoId: 10, orden: 1, tipoProcesoId: 100, procesoOtro: null,
    modo: 'manual', setupMin: 0, operacionMin: 120, margenMin: 0,
    maquinaId: 5, maquinaOtra: null, operarioId: 3, detalleTrabajo: null,
    esRetrabajo: false,
    estado: 'planificado', planFecha: '2026-07-06', planHora: '06:00:00',
    planOperarioId: 3, planMaquinaId: 5, planAceptado: null,
    realFechaInicio: null, realHoraInicio: null, realFechaFin: null, realHoraFin: null,
    procesoEliminado: false, setupSolapable: false, grupoDivisionId: null,
    ...o,
  }
}

function datosCon(procesos: ProcesoTablero[]): DatosTablero {
  return {
    procesos,
    elementos: new Map([
      [10, { descripcion: 'Eje principal', cantidad: 1, fotoUrl: null, proyectoId: 50, parentId: null }],
    ]),
    proyectos: new Map([
      [50, { urgencia: 'alta', pedidoNro: '4130', clienteNombre: 'ACME', fotoUrl: null }],
    ]),
    tiposProceso: new Map([[100, 'Torneado']]),
    maquinas: new Map([[5, maquina]]),
    personal: new Map([[3, operario]]),
    vacaciones: [],
  }
}

describe('armarBloquesVisuales', () => {
  it('cruza los datos de un proceso en un BloqueVisual', () => {
    const bv = armarBloquesVisuales(datosCon([proc({})]))
    expect(bv).toHaveLength(1)
    expect(bv[0]).toMatchObject({
      procesoId: 1, elementoId: 10, operarioId: 3,
      fecha: '2026-07-06', inicioMin: 360, finMin: 480, setupMin: 0, esAuto: false, modo: 'manual', track: 0, parte: 1, totalPartes: 1,
      descripcion: 'Eje principal', cantidad: 1, tipoProceso: 'Torneado',
      cliente: 'ACME', pedidoNro: '4130', operarioNombre: 'Juan Pérez', maquinaNombre: 'VF4',
      urgencia: 'alta', maquinaColor: '#73bbf5', hecho: false,
      esRetrabajo: false, hayDivergencia: false, procesoEliminado: false, fotoUrl: null,
    })
  })

  it('un proceso que cruza días genera un BloqueVisual por día, numerados', () => {
    // 600 min: lunes 06:00–15:00 + martes 06:00–07:00
    const bv = armarBloquesVisuales(datosCon([proc({ operacionMin: 600 })]))
    expect(bv).toHaveLength(2)
    expect(bv.map((b) => [b.fecha, b.parte, b.totalPartes])).toEqual([
      ['2026-07-06', 1, 2],
      ['2026-07-07', 2, 2],
    ])
  })

  it('incluye los eliminados que estaban planificados, marcados con procesoEliminado', () => {
    const bv = armarBloquesVisuales(datosCon([proc({ procesoEliminado: true })]))
    expect(bv).toHaveLength(1)
    expect(bv[0].procesoEliminado).toBe(true)
  })

  it('ignora procesos sin planificar', () => {
    expect(armarBloquesVisuales(datosCon([proc({ planFecha: null })]))).toHaveLength(0)
  })

  it('usa el texto libre cuando el tipo de proceso es "Otro"', () => {
    const bv = armarBloquesVisuales(datosCon([proc({ tipoProcesoId: null, procesoOtro: 'Rebarbado' })]))
    expect(bv[0].tipoProceso).toBe('Rebarbado')
  })
})

describe('armarBloquesVisuales — herencia de la foto', () => {
  // Jerarquía: proyecto 50 → conjunto 30 → subconjunto 20 → elemento 10 (el del proceso).
  function datosConFotos(fotos: {
    elem?: string | null
    sub?: string | null
    conj?: string | null
    proy?: string | null
  }): DatosTablero {
    const d = datosCon([proc({})])
    return {
      ...d,
      elementos: new Map([
        [10, { descripcion: 'Eje principal', cantidad: 1, fotoUrl: fotos.elem ?? null, proyectoId: 50, parentId: 20 }],
        [20, { descripcion: 'Subconjunto', cantidad: 1, fotoUrl: fotos.sub ?? null, proyectoId: 50, parentId: 30 }],
        [30, { descripcion: 'Conjunto', cantidad: 1, fotoUrl: fotos.conj ?? null, proyectoId: 50, parentId: null }],
      ]),
      proyectos: new Map([
        [50, { urgencia: 'alta', pedidoNro: '4130', clienteNombre: 'ACME', fotoUrl: fotos.proy ?? null }],
      ]),
    }
  }

  it('usa la foto propia del elemento si la tiene', () => {
    const bv = armarBloquesVisuales(datosConFotos({ elem: 'propia.png', sub: 'sub.png', proy: 'proy.png' }))
    expect(bv[0].fotoUrl).toBe('propia.png')
  })

  it('sin foto propia, hereda la del padre', () => {
    const bv = armarBloquesVisuales(datosConFotos({ sub: 'sub.png', conj: 'conj.png', proy: 'proy.png' }))
    expect(bv[0].fotoUrl).toBe('sub.png')
  })

  it('sin foto del padre, sigue subiendo hasta el abuelo', () => {
    const bv = armarBloquesVisuales(datosConFotos({ conj: 'conj.png', proy: 'proy.png' }))
    expect(bv[0].fotoUrl).toBe('conj.png')
  })

  it('si ningún ancestro tiene foto, cae en la del proyecto', () => {
    const bv = armarBloquesVisuales(datosConFotos({ proy: 'proy.png' }))
    expect(bv[0].fotoUrl).toBe('proy.png')
  })

  it('sin ninguna foto en la cadena, queda null', () => {
    const bv = armarBloquesVisuales(datosConFotos({}))
    expect(bv[0].fotoUrl).toBeNull()
  })
})
