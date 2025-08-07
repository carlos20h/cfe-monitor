'use client'

import { useEffect, useState } from 'react'
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
    const diasTranscurridos = (fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)
    const factor = 60 / diasTranscurridos

    const tomadaEstimada = tomada * factor
    const inyectadaEstimada = inyectada * factor
    const netoEstimado = tomadaEstimada - inyectadaEstimada

    let consumoCalculado = netoEstimado
    let detalle = ''
    let subtotal = 0

    if (saldoKWh >= consumoCalculado) {
      detalle = 'Consumo cubierto con saldo a favor'
      subtotal = 127
      consumoCalculado = 0
    } else if (consumoCalculado <= 0) {
      detalle = 'Cargo fijo por consumo estimado negativo'
      subtotal = 127
      saldoKWh += Math.abs(consumoCalculado)
      saldoPesos += 147.32
    } else {
      const restante = consumoCalculado - saldoKWh
      const tramo1 = Math.min(restante, 150)
      const tramo2 = Math.min(Math.max(restante - 150, 0), 200)
      const tramo3 = Math.max(restante - 350, 0)

      const costo1 = tramo1 * 1.01
      const costo2 = tramo2 * 1.23
      const costo3 = tramo3 * 3.62

      subtotal = costo1 + costo2 + costo3
      detalle = `Saldo aplicado: ${saldoKWh.toFixed(2)} kWh\nTramo 1 (1–150): $${costo1.toFixed(2)}\nTramo 2 (151–350): $${costo2.toFixed(2)}\nTramo 3 (>350): $${costo3.toFixed(2)}`
    }

    const iva = subtotal * 0.16
    const total = subtotal + iva

    return (
      <div className="bg-yellow-50 p-4 rounded border mb-4 text-sm whitespace-pre-line">
        <p className="font-semibold text-yellow-700">📈 Proyección estimada</p>
        <p>🔁 <strong>Consumo neto estimado:</strong> {netoEstimado.toFixed(2)} kWh</p>
        <p>🧾 <strong>Detalle:</strong><br />{detalle}</p>
        <p>💸 <strong>IVA:</strong> ${iva.toFixed(2)}</p>
        <p className="font-bold text-lg mt-2">💵 Total estimado: ${total.toFixed(2)}</p>
        <p>⚡ <strong>Saldo acumulado:</strong> {saldoKWh.toFixed(0)} kWh</p>
      </div>
    )
  }

  let consumoCalculado = neto
  let detalle = ''
  let subtotal = 0

  if (saldoKWh >= consumoCalculado) {
    detalle = 'Consumo cubierto con saldo a favor'
    subtotal = 127
    consumoCalculado = 0
    saldoPesos += 147.32
    saldoKWh -= neto
  } else if (consumoCalculado <= 0) {
    subtotal = 127
    detalle = 'Cargo fijo por consumo neto negativo'
    saldoKWh += Math.abs(consumoCalculado)
    saldoPesos += 147.32
  } else {
    const restante = consumoCalculado - saldoKWh
    const tramo1 = Math.min(restante, 150)
    const tramo2 = Math.min(Math.max(restante - 150, 0), 200)
    const tramo3 = Math.max(restante - 350, 0)

    const costo1 = tramo1 * 1.01
    const costo2 = tramo2 * 1.23
    const costo3 = tramo3 * 3.62

    subtotal = costo1 + costo2 + costo3
    detalle = `Saldo aplicado: ${saldoKWh.toFixed(2)} kWh\nTramo 1 (1–150): $${costo1.toFixed(2)}\nTramo 2 (151–350): $${costo2.toFixed(2)}\nTramo 3 (>350): $${costo3.toFixed(2)}`
  }

  const iva = subtotal * 0.16
  const total = subtotal + iva

  return (
    <div className="bg-blue-50 p-4 rounded border mb-4 text-sm whitespace-pre-line">
      <p className="font-semibold text-blue-700">📊 Resumen del bimestre cerrado</p>
      <p>🔁 <strong>Consumo neto:</strong> {neto.toFixed(2)} kWh</p>
      <p>🧾 <strong>Detalle:</strong><br />{detalle}</p>
      <p>💸 <strong>IVA:</strong> ${iva.toFixed(2)}</p>
      <p className="font-bold text-lg mt-2">💵 Total estimado: ${total.toFixed(2)}</p>
      <p>⚡ <strong>Saldo acumulado disponible:</strong> {saldoKWh.toFixed(0)} kWh</p>
    </div>
  )
}


  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-100 to-sky-200 p-6 flex flex-col items-center">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-md p-6">
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
