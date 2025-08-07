import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-100 to-sky-200 p-6">
      <h1 className="text-3xl font-bold text-sky-900 mb-10 text-center">CFE Monitor</h1>
      <div className="w-full max-w-xs flex flex-col gap-4">
        <Link
          href="/lecturas"
          className="rounded-xl bg-white shadow-md py-4 text-center text-lg font-semibold text-sky-700 hover:bg-sky-50 transition-colors"
        >
          📖 Lecturas
        </Link>
        <Link
          href="/bimestres"
          className="rounded-xl bg-white shadow-md py-4 text-center text-lg font-semibold text-sky-700 hover:bg-sky-50 transition-colors"
        >
          📅 Bimestres
        </Link>
      </div>
    </main>
  )
}
