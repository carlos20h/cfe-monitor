'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Reading = {
  id: number
  fecha: string
  tomada: number
  inyectada: number
  corte: boolean
  observacion: string | null
}

export default function LecturasPage() {
  const [lecturas, setLecturas] = useState<Reading[]>([])
  const [form, setForm] = useState({
    fecha: '',
    tomada: '',
    inyectada: '',
    corte: false,
    observacion: '',
  })

  const fetchLecturas = async () => {
    const { data, error } = await supabase
      .from('readings')
      .select('*')
      .order('fecha', { ascending: false })

    if (error) console.error(error)
    else setLecturas(data)
  }

  useEffect(() => {
    fetchLecturas()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement

    const { name, value, type, checked } = target


    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? target.checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { fecha, tomada, inyectada, corte, observacion } = form

    const { error } = await supabase.from('readings').insert([
      {
        fecha,
        tomada: parseFloat(tomada),
        inyectada: parseFloat(inyectada),
        corte,
        observacion: observacion || null,
      },
    ])

    if (error) {
      alert('❌ Error al guardar lectura')
      console.error(error)
    } else {
      alert('✅ Lectura guardada correctamente')
      setForm({
        fecha: '',
        tomada: '',
        inyectada: '',
        corte: false,
        observacion: '',
      })
      fetchLecturas()
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Registrar lectura</h1>
      <form onSubmit={handleSubmit} className="space-y-4 border p-4 rounded shadow">
        <div>
          <label className="block font-medium">Fecha</label>
          <input type="date" name="fecha" value={form.fecha} onChange={handleChange} required className="w-full border px-2 py-1 rounded" />
        </div>
        <div>
          <label className="block font-medium">kWh tomados</label>
          <input type="number" name="tomada" value={form.tomada} onChange={handleChange} required className="w-full border px-2 py-1 rounded" />
        </div>
        <div>
          <label className="block font-medium">kWh inyectados</label>
          <input type="number" name="inyectada" value={form.inyectada} onChange={handleChange} required className="w-full border px-2 py-1 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" name="corte" checked={form.corte} onChange={handleChange} />
          <label className="font-medium">¿Es corte?</label>
        </div>
        <div>
          <label className="block font-medium">Observaciones</label>
          <textarea name="observacion" value={form.observacion} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Guardar lectura
        </button>
      </form>

      <h2 className="text-xl font-semibold mt-8 mb-2">Lecturas registradas</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">Fecha</th>
            <th className="border px-2 py-1">Tomada</th>
            <th className="border px-2 py-1">Inyectada</th>
            <th className="border px-2 py-1">Corte</th>
            <th className="border px-2 py-1">Observación</th>
          </tr>
        </thead>
        <tbody>
          {lecturas.map((r) => (
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
    </main>
  )
}
