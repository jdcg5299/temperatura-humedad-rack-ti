import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import SegmentedTimeRangeBar from './components/SegmentedTimeRangeBar'
import ToggleTema, { inicializarTema } from './components/ToggleTema'
import Grafica from './components/Grafica'
import TablaLecturas from './components/TablaLecturas'
import { pedirLecturas } from './api'
import type { Lectura } from './tipos'
import {
  VENTANAS,
  VENTANA_POR_DEFECTO,
  buscarVentana,
  hace,
  puntosParaGrafica,
} from './ventanas'

/** Refresco automático: cada 10 s, como el intervalo de envío del sistema. */
const REFRESCO_MS = 10_000

export default function App() {
  const [ventanaId, setVentanaId] = useState(VENTANA_POR_DEFECTO)
  const [lecturas, setLecturas] = useState<Lectura[]>([])
  const [error, setError] = useState<string | null>(null)
  const [actualizado, setActualizado] = useState<string>('')
  const [oscuro, setOscuro] = useState(inicializarTema)

  const ventana = buscarVentana(ventanaId)

  // Clase .dark en <html> + memoria de la elección del usuario.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', oscuro)
    localStorage.setItem('tema', oscuro ? 'oscuro' : 'claro')
  }, [oscuro])

  // Se pide solo la ventana elegida: el parámetro "desde" del API limita
  // la respuesta a las lecturas dentro de la ventana. La fecha se calcula
  // en cada carga para que la ventana "viaje" con el reloj.
  const cargar = useCallback(async () => {
    try {
      const filas = await pedirLecturas(hace(ventana.ms), ventana.limite)
      setLecturas(filas)
      setError(null)
      setActualizado(new Date().toLocaleTimeString('es-CO'))
    } catch (e) {
      // Fallar sin caerse: se muestra el error y se conservan los datos
      // que ya estaban en pantalla hasta el próximo reintento.
      setError(e instanceof Error ? e.message : 'error inesperado')
    }
  }, [ventana])

  // Carga inmediata al cambiar de ventana y auto-refresco periódico.
  useEffect(() => {
    cargar()
    const temporizador = setInterval(cargar, REFRESCO_MS)
    return () => clearInterval(temporizador)
  }, [cargar])

  // La gráfica agrupa por promedio si la ventana trae demasiadas filas.
  const puntos = useMemo(
    () => puntosParaGrafica(lecturas, ventana.ms),
    [lecturas, ventana],
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100">
      <main className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Rack TI · Temperatura y humedad
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Lecturas reales del sensor, servidas por Flask. Normal: 18–27 °C y 40–60 %.
            </p>
          </div>
          <ToggleTema oscuro={oscuro} onCambiar={setOscuro} />
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedTimeRangeBar
            presets={VENTANAS}
            value={ventanaId}
            onChange={setVentanaId}
          />
          {/* El CSV es completo: no depende de la ventana seleccionada. */}
          <a
            href="/api/lecturas/csv"
            download="lecturas.csv"
            title="Descarga el CSV completo (todas las lecturas)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Descargar CSV
          </a>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300"
          >
            No se pudo actualizar ({error}). Se reintenta solo.
          </div>
        )}

        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Evolución en la ventana</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {ventana.label} · {puntos.length} puntos
            </span>
          </div>
          <div className="px-2 pb-4">
            <Grafica puntos={puntos} oscuro={oscuro} />
          </div>
        </section>

        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Lecturas recientes</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              máx. 20 filas
            </span>
          </div>
          <TablaLecturas lecturas={lecturas} />
        </section>

        <footer className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          {error
            ? 'Última carga fallida, reintentando…'
            : actualizado
              ? `Actualizado a las ${actualizado}`
              : 'Cargando…'}
        </footer>
      </main>
    </div>
  )
}
