import type { Reading, Bimestre, ResultadoBimestre } from '@/lib/types'

export function calcularSaldosPorBimestre(
  bimestres: Bimestre[],
  lecturas: Reading[]
): ResultadoBimestre[] {
  let saldoAcumulado = 0
  const resultados: ResultadoBimestre[] = []

  for (const bimestre of bimestres) {
    const inicio = new Date(bimestre.inicio)
    const fin = new Date(bimestre.fin)

    const lecturasBimestre = lecturas.filter(l => {
      const fecha = new Date(l.fecha)
      return fecha >= inicio && fecha <= fin
    })

    // Si hay menos de 2 lecturas, no se puede calcular neto
    if (lecturasBimestre.length < 2) continue

    const lecturaInicial = lecturasBimestre[0]
    const lecturaFinal = lecturasBimestre.at(-1)!

    const tomada = lecturaFinal.tomada - lecturaInicial.tomada
    const inyectada = lecturaFinal.inyectada - lecturaInicial.inyectada
    const neto = tomada - inyectada

    // Cálculo de costo con tabla real de CFE
    let costo = 0
    let detalle = ''

    if (neto <= 0) {
      costo = 127 * 1.16 // Cargo fijo + IVA
      detalle = 'Cargo fijo $127 + IVA'
    } else {
      const tramo1 = Math.min(neto, 150)
      const tramo2 = Math.min(Math.max(neto - 150, 0), 200)
      const tramo3 = Math.max(neto - 350, 0)

      const subtotal =
        tramo1 * 1.01 +
        tramo2 * 1.23 +
        tramo3 * 3.62

      costo = subtotal * 1.16
      detalle = `Tramo1: ${tramo1}×$1.01, Tramo2: ${tramo2}×$1.23, Tramo3: ${tramo3}×$3.62 + IVA`
    }

    let saldoAplicado = 0

    if (!bimestre.esActual) {
      // Aplicar saldo solo si el bimestre ya está cerrado
      if (neto > 0 && saldoAcumulado > 0) {
        saldoAplicado = Math.min(saldoAcumulado, costo)
        saldoAcumulado -= saldoAplicado
      } else if (neto <= 0) {
        // Acumular saldo a favor si no se consumió más de lo generado
        saldoAcumulado += costo
      }
    }

    const saldoRestante = saldoAcumulado

    resultados.push({
      nombre: bimestre.nombre,
      neto,
      costoEstimado: costo,
      saldoAplicado,
      saldoRestante,
      esActual: !!bimestre.esActual,
      detalle,
    })
  }

  return resultados
}

