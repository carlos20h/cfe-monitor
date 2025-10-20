'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Reading } from '@/lib/types'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

type Bimestre = {
  nombre: string
  inicio: string
  fin: string
  index: number
}

export default function BimestresPage() {
  const [lecturas, setLecturas] = useState<Reading[]>([])
  const [bimestres, setBimestres] = useState<Bimestre[]>([])
  const [bimestreActivo, setBimestreActivo] = useState<Bimestre | null>(null)

  const fetchLecturas = async () => {
    const { data, error } = await supabase
      .from('readings')
      .select('*')
      .order('fecha', { ascending: true })

    if (error) {
      console.error(error)
    } else if (data) {
      setLecturas(data)
      calcularBimestres(data)
    }
  }

  const calcularBimestres = (data: Reading[]) => {
    const cortes = data.filter(r => r.corte).map(r => r.fecha)
    const lista: Bimestre[] = []
    const hoy = new Date()
    for (let i = 0; i < cortes.length - 1; i++) {
      lista.push({
        nombre: `Bimestre ${i + 1} (${cortes[i]} - ${cortes[i + 1]})`,
        inicio: cortes[i],
        fin: cortes[i + 1],
        index: i
      })
    }
    const ultimoCorte = cortes.at(-1)
    if (ultimoCorte && hoy > new Date(ultimoCorte)) {
      lista.push({
        nombre: `Bimestre actual (${ultimoCorte} - hoy)`,
        inicio: ultimoCorte,
        fin: hoy.toISOString().split('T')[0],
        index: lista.length
      })
    }

    setBimestres(lista)

    const actual = lista.find(b => {
      const dInicio = new Date(b.inicio)
      const dFin = new Date(b.fin)
      return hoy >= dInicio && hoy <= dFin
    })

    setBimestreActivo(actual ?? lista.at(-1) ?? null)
  }

  useEffect(() => {
    fetchLecturas()
  }, [])

  const lecturasFiltradas = bimestreActivo
    ? lecturas.filter(r => {
        const f = new Date(r.fecha)
        return f >= new Date(bimestreActivo.inicio) && f <= new Date(bimestreActivo.fin)
      })
    : []

  const chartData = () => {
    if (lecturasFiltradas.length < 2) return []

    const data: { fecha: string; consumoNeto?: number; proyeccion?: number }[] = []
    let acumulado = 0
    let total = 0
    for (let i = 1; i < lecturasFiltradas.length; i++) {
      const prev = lecturasFiltradas[i - 1]
      const actual = lecturasFiltradas[i]

      const fecha = actual.fecha
      const consumoDia = (actual.tomada - prev.tomada) - (actual.inyectada - prev.inyectada)
      acumulado += consumoDia
      total += consumoDia
      data.push({ fecha, consumoNeto: acumulado })
    }

    // Si el bimestre está abierto, proyectar hasta día 60
    const hoy = new Date().toISOString().split('T')[0]
    const isBimestreAbierto = bimestreActivo?.fin === hoy
    if (isBimestreAbierto) {
      const dias = data.length
      const promedio = dias ? total / dias : 0
      let proyeccionAcumulada = acumulado
      for (let i = dias + 1; i <= 60; i++) {
        proyeccionAcumulada += promedio
        data.push({
          fecha: `Día ${i}`,
          proyeccion: proyeccionAcumulada
        })
      }
    }

    return data
  }

  const calcularResumen = () => {
    if (!bimestreActivo || lecturas.length < 2) return null

    const lecturasFiltradas = lecturas.filter(r => {
      const f = new Date(r.fecha)
      return f >= new Date(bimestreActivo.inicio) && f <= new Date(bimestreActivo.fin)
    })

    if (lecturasFiltradas.length < 2) return null

    const inicio = lecturasFiltradas[0]
    const fin = lecturasFiltradas.at(-1)!
    const hoy = new Date().toISOString().split('T')[0]
    const bimestreEnCurso = bimestreActivo.fin === hoy

    const tomada = fin.tomada - inicio.tomada
    const inyectada = fin.inyectada - inicio.inyectada
    const neto = tomada - inyectada

    let saldoKWh = 0
    let saldoPesos = 0

    const calcularCosto = (
      consumoObjetivo: number,
      saldoDisponible: number,
      mensajeNegativo: string
    ) => {
      if (consumoObjetivo <= 0) {
        const subtotal = 127
        const iva = subtotal * 0.16
        return {
          detalle: mensajeNegativo,
          subtotal,
          iva,
          total: subtotal + iva,
          saldoRestante: saldoDisponible + Math.abs(consumoObjetivo)
        }
      }

      if (saldoDisponible >= consumoObjetivo) {
        const subtotal = 127
        const iva = subtotal * 0.16
        return {
          detalle: 'Consumo cubierto con saldo a favor',
          subtotal,
          iva,
          total: subtotal + iva,
          saldoRestante: saldoDisponible - consumoObjetivo
        }
      }

      const saldoAplicado = Math.min(saldoDisponible, consumoObjetivo)
      const restante = consumoObjetivo - saldoAplicado
      const tramo1 = Math.min(restante, 150)
      const tramo2 = Math.min(Math.max(restante - 150, 0), 200)
      const tramo3 = Math.max(restante - 350, 0)

      const costo1 = tramo1 * 1.01
      const costo2 = tramo2 * 1.23
      const costo3 = tramo3 * 3.62

      const subtotal = costo1 + costo2 + costo3
      const iva = subtotal * 0.16

      return {
        detalle: `Saldo aplicado: ${saldoAplicado.toFixed(2)} kWh\nTramo 1 (1–150): $${costo1.toFixed(2)}\nTramo 2 (151–350): $${costo2.toFixed(2)}\nTramo 3 (>350): $${costo3.toFixed(2)}`,
        subtotal,
        iva,
        total: subtotal + iva,
        saldoRestante: saldoDisponible - saldoAplicado
      }
    }

    for (let i = 0; i < bimestreActivo.index; i++) {
      const b = bimestres[i]
      const l = lecturas.filter(r => {
        const f = new Date(r.fecha)
        return f >= new Date(b.inicio) && f <= new Date(b.fin)
      })
      if (l.length < 2) continue

      const primera = l[0]
      const ultima = l.at(-1)!
      const netoPrevio = (ultima.tomada - primera.tomada) - (ultima.inyectada - primera.inyectada)

      if (netoPrevio <= 0) {
        saldoKWh += Math.abs(netoPrevio)
        saldoPesos += 147.32
      } else if (saldoKWh >= netoPrevio) {
        saldoKWh -= netoPrevio
        saldoPesos += 147.32
      } else {
        saldoKWh = 0
      }
    }

    if (bimestreEnCurso) {
      const fechaInicio = new Date(inicio.fecha)
      const fechaFin = new Date(fin.fecha)
      const diasTranscurridos = Math.max(
        Math.round((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)),
        1
      )
      const factor = 60 / diasTranscurridos

      const tomadaEstimada = tomada * factor
      const inyectadaEstimada = inyectada * factor
      const netoEstimado = tomadaEstimada - inyectadaEstimada

      // Serie diaria de kWh/día (no por intervalo)
      const consumosPromedio: number[] = []
      for (let i = 1; i < lecturasFiltradas.length; i++) {
        const anterior = lecturasFiltradas[i - 1]
        const actual = lecturasFiltradas[i]
        const netoIntervalo = (actual.tomada - anterior.tomada) - (actual.inyectada - anterior.inyectada)
        const fechaAnterior = new Date(anterior.fecha)
        const fechaActual = new Date(actual.fecha)
        const diasIntervalo = Math.max(
          1,
          Math.round((fechaActual.getTime() - fechaAnterior.getTime()) / (1000 * 60 * 60 * 24))
        )
        const rate = netoIntervalo / diasIntervalo
        // Empuja UN valor por CADA día del intervalo
        for (let d = 0; d < diasIntervalo; d++) {
          consumosPromedio.push(rate)
        }
      }

      const alpha = 1 - Math.pow(0.5, 1 / 9)
      let ewma = consumosPromedio[0] ?? 0
      for (let i = 1; i < consumosPromedio.length; i++) {
        ewma = alpha * consumosPromedio[i] + (1 - alpha) * ewma
      }

      const ultimosTres = consumosPromedio.slice(-3)
      const promedioUltimosTres =
        ultimosTres.length > 0
          ? ultimosTres.reduce((acc, valor) => acc + valor, 0) / ultimosTres.length
          : ewma

      let consumoDiarioHibrido = 0
      if (consumosPromedio.length > 0) {
        const base = ewma
        if (Math.abs(base) < 1e-6) {
          consumoDiarioHibrido = promedioUltimosTres
        } else {
          const cambioRelativo = (promedioUltimosTres - base) / base
          if (Math.abs(cambioRelativo) > 0.3) {
            const cambioCapado = Math.max(Math.min(cambioRelativo, 0.4), -0.4)
            consumoDiarioHibrido = base * (1 + cambioCapado)
          } else {
            consumoDiarioHibrido = base
          }
        }
      }

      const diasRestantes = Math.max(60 - diasTranscurridos, 0)
      const netoProyectado = neto + consumoDiarioHibrido * diasRestantes

      const saldoInicial = saldoKWh
      const costoLineal = calcularCosto(
        netoEstimado,
        saldoInicial,
        'Cargo fijo por consumo estimado negativo'
      )
      saldoKWh = costoLineal.saldoRestante

      const costoHibrido = calcularCosto(
        netoProyectado,
        saldoInicial,
        'Cargo fijo por consumo proyectado (híbrido) negativo'
      )

      return (
        <div className="bg-yellow-50 p-4 rounded border mb-4 text-sm whitespace-pre-line">
          <p className="font-semibold text-yellow-700">📈 Proyección estimada</p>
          <p>🔁 <strong>Consumo neto estimado:</strong> {netoEstimado.toFixed(2)} kWh</p>
          <p>🧮 <strong>Consumo neto proyectado (híbrido):</strong> {netoProyectado.toFixed(2)} kWh</p>
          <p>
            💵 <strong>Total estimado (lineal):</strong> ${costoLineal.total.toFixed(2)}{' '}
            <span className="text-xs text-yellow-700">(IVA ${costoLineal.iva.toFixed(2)})</span>
          </p>
          <p>🧾 <strong>Detalle lineal:</strong><br />{costoLineal.detalle}</p>
          <p>
            💵 <strong>Total estimado (híbrido):</strong> ${costoHibrido.total.toFixed(2)}{' '}
            <span className="text-xs text-yellow-700">(IVA ${costoHibrido.iva.toFixed(2)})</span>
          </p>
          <p>🧾 <strong>Detalle híbrido:</strong><br />{costoHibrido.detalle}</p>
          <p>⚡ <strong>Saldo acumulado tras estimación lineal:</strong> {costoLineal.saldoRestante.toFixed(0)} kWh</p>
          <p>⚡ <strong>Saldo con proyección híbrida:</strong> {costoHibrido.saldoRestante.toFixed(0)} kWh</p>
        </div>
      )
    }

    const costoCerrado = calcularCosto(
      neto,
      saldoKWh,
      'Cargo fijo por consumo neto negativo'
    )
    saldoKWh = costoCerrado.saldoRestante

    return (
      <div className="bg-blue-50 p-4 rounded border mb-4 text-sm whitespace-pre-line">
        <p className="font-semibold text-blue-700">📊 Resumen del bimestre cerrado</p>
        <p>🔁 <strong>Consumo neto:</strong> {neto.toFixed(2)} kWh</p>
        <p>🧾 <strong>Detalle:</strong><br />{costoCerrado.detalle}</p>
        <p>💸 <strong>IVA:</strong> ${costoCerrado.iva.toFixed(2)}</p>
        <p className="font-bold text-lg mt-2">💵 Total estimado: ${costoCerrado.total.toFixed(2)}</p>
        <p>⚡ <strong>Saldo acumulado disponible:</strong> {saldoKWh.toFixed(0)} kWh</p>
      </div>
    )
  }


  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-100 to-sky-200 p-6 flex flex-col items-center">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-md p-6">
        <Link href="/" className="text-sky-700 hover:underline">
          &larr; Inicio
        </Link>
        <h1 className="text-2xl font-bold mb-4 text-sky-900">Lecturas por bimestre</h1>

        {bimestres.length > 0 && (
          <div className="mb-4">
            <label className="font-medium text-sky-900">Seleccionar bimestre:</label>
            <select
              value={bimestreActivo?.nombre}
              onChange={(e) =>
                setBimestreActivo(bimestres.find(b => b.nombre === e.target.value) ?? null)
              }
              className="ml-2 border px-2 py-1 rounded"
            >
              {bimestres.map((b, i) => (
                <option key={i} value={b.nombre}>{b.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Cuadro de resumen */}
        {calcularResumen()}

        {/* Gráfica de consumo neto acumulado */}
        {lecturasFiltradas.length >= 2 && (
          <div className="mt-6 mb-8">
            <h2 className="text-lg font-semibold mb-2 text-sky-900">📉 Consumo neto acumulado</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="consumoNeto" stroke="#004184" name="Consumo neto acumulado" />
                <Line type="monotone" dataKey="proyeccion" stroke="#E8871C" name="Proyección" strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabla de lecturas */}
        <h2 className="text-xl font-semibold mb-2 text-sky-900">
          Lecturas del {bimestreActivo?.inicio} al {bimestreActivo?.fin}
        </h2>

        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-sky-100">
              <th className="border px-2 py-1">Fecha</th>
              <th className="border px-2 py-1">Tomada</th>
              <th className="border px-2 py-1">Inyectada</th>
              <th className="border px-2 py-1">Corte</th>
              <th className="border px-2 py-1">Observación</th>
            </tr>
          </thead>
          <tbody>
            {lecturasFiltradas.map((r) => (
              <tr key={r.id}>
                <td className="border px-2 py-1">{r.fecha}</td>
                <td className="border px-2 py-1">{r.tomada}</td>
                <td className="border px-2 py-1">{r.inyectada}</td>
                <td className="border px-2 py-1">{r.corte ? '✅' : '—'}</td>
                <td className="border px-2 py-1">{r.observacion ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
