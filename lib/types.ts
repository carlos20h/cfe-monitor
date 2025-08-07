export type Bimestre = {
  nombre: string
  inicio: string
  fin: string
  esActual?: boolean
}

export type Reading = {
  id: number
  fecha: string
  tomada: number
  inyectada: number
  corte: boolean
  observacion: string | null
}

export type ResultadoBimestre = {
  nombre: string
  esActual: boolean
  neto: number
  costoEstimado: number
  saldoAplicado: number
  saldoRestante: number
  detalle: string
}
