import { describe, it, expect } from 'vitest'
import {
  solapesMaquina, solapesOperario, violacionesCorrelatividad, validarInvariantes,
  type BloqueCalculado,
} from './invariantes'
import type { Intervalo } from './solapes'

const iv = (ini: number, fin: number, fecha = '2026-07-06'): Intervalo => ({
  inicio: { fecha, min: ini }, fin: { fecha, min: fin },
})

// Bloque con valores por defecto; se sobreescribe lo necesario en cada test.
function blk(o: Partial<BloqueCalculado> & { id: number }): BloqueCalculado {
  return {
    operarioId: null, maquinaId: null, modo: 'manual', setupSolapable: false,
    intervaloOperario: iv(0, 100), intervaloMaquina: iv(0, 100),
    ...o,
  }
}

describe('solapesMaquina', () => {
  it('misma máquina, intervalos que se pisan → violación', () => {
    const v = solapesMaquina([
      blk({ id: 1, maquinaId: 5, intervaloMaquina: iv(100, 200) }),
      blk({ id: 2, maquinaId: 5, intervaloMaquina: iv(150, 250) }),
    ])
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ tipo: 'solape_maquina', maquinaId: 5 })
  })
  it('misma máquina que se tocan justo → sin violación', () => {
    expect(solapesMaquina([
      blk({ id: 1, maquinaId: 5, intervaloMaquina: iv(100, 200) }),
      blk({ id: 2, maquinaId: 5, intervaloMaquina: iv(200, 300) }),
    ])).toHaveLength(0)
  })
  it('distinta máquina → sin violación', () => {
    expect(solapesMaquina([
      blk({ id: 1, maquinaId: 5, intervaloMaquina: iv(100, 200) }),
      blk({ id: 2, maquinaId: 6, intervaloMaquina: iv(150, 250) }),
    ])).toHaveLength(0)
  })
})

describe('solapesOperario', () => {
  it('mismo operario, dos manuales que se pisan → violación', () => {
    const v = solapesOperario([
      blk({ id: 1, operarioId: 3, modo: 'manual', intervaloOperario: iv(100, 200) }),
      blk({ id: 2, operarioId: 3, modo: 'manual', intervaloOperario: iv(150, 250) }),
    ])
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ tipo: 'solape_operario', operarioId: 3 })
  })
  it('setup_solapable: setup de una automática montado sobre una manual → exento', () => {
    expect(solapesOperario([
      blk({ id: 1, operarioId: 3, modo: 'automatica', setupSolapable: true, intervaloOperario: iv(100, 200) }),
      blk({ id: 2, operarioId: 3, modo: 'manual', intervaloOperario: iv(150, 250) }),
    ])).toHaveLength(0)
  })
  it('dos automáticas solapables que se pisan → SÍ es violación (ninguna es manual)', () => {
    expect(solapesOperario([
      blk({ id: 1, operarioId: 3, modo: 'automatica', setupSolapable: true, intervaloOperario: iv(100, 200) }),
      blk({ id: 2, operarioId: 3, modo: 'automatica', setupSolapable: true, intervaloOperario: iv(150, 250) }),
    ])).toHaveLength(1)
  })
})

describe('violacionesCorrelatividad', () => {
  const corr = [{ predecesorId: 1, sucesorId: 2 }]
  it('pred termina antes del inicio del suc → ok', () => {
    expect(violacionesCorrelatividad([
      blk({ id: 1, intervaloMaquina: iv(0, 200) }),
      blk({ id: 2, intervaloMaquina: iv(300, 400) }),
    ], corr)).toHaveLength(0)
  })
  it('pred termina después del inicio del suc → violación', () => {
    const v = violacionesCorrelatividad([
      blk({ id: 1, intervaloMaquina: iv(0, 300) }),
      blk({ id: 2, intervaloMaquina: iv(200, 400) }),
    ], corr)
    expect(v).toEqual([{ tipo: 'correlatividad', predId: 1, sucId: 2 }])
  })
  it('sucesor planificado con predecesor sin planificar → inconsistencia', () => {
    const v = violacionesCorrelatividad([blk({ id: 2, intervaloMaquina: iv(200, 400) })], corr)
    expect(v).toEqual([{ tipo: 'predecesor_sin_planificar', predId: 1, sucId: 2 }])
  })
  it('sucesor sin planificar → no restringe', () => {
    expect(violacionesCorrelatividad([blk({ id: 1, intervaloMaquina: iv(0, 300) })], corr)).toHaveLength(0)
  })
})

describe('validarInvariantes', () => {
  it('junta solapes de los dos ejes y correlatividades', () => {
    const bloques = [
      blk({ id: 1, operarioId: 3, maquinaId: 5, intervaloOperario: iv(100, 200), intervaloMaquina: iv(100, 200) }),
      blk({ id: 2, operarioId: 3, maquinaId: 5, intervaloOperario: iv(150, 250), intervaloMaquina: iv(150, 250) }),
    ]
    const v = validarInvariantes(bloques, [])
    // Se pisan en máquina Y en operario → dos violaciones.
    expect(v.map((x) => x.tipo).sort()).toEqual(['solape_maquina', 'solape_operario'])
  })
})
