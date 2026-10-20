import type { Lectura } from '../tipos'

/**
 * Tabla de las lecturas más recientes (el servidor ya devuelve de la más
 * reciente a la más vieja). A diferencia de la gráfica, aquí no se agrupa:
 * se muestran las filas tal cual.
 */
const FILAS_TABLA = 20

export default function TablaLecturas({ lecturas }: { lecturas: Lectura[] }) {
  const visibles = lecturas.slice(0, FILAS_TABLA)

  if (visibles.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
        Sin lecturas todavía.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <th className="px-4 py-2 font-medium">Fecha</th>
            <th className="px-4 py-2 font-medium">Dispositivo</th>
            <th className="px-4 py-2 font-medium text-right">Temp. (°C)</th>
            <th className="px-4 py-2 font-medium text-right">Humedad (%)</th>
            <th className="px-4 py-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((lectura) => (
            <tr
              key={lectura.id}
              className="border-b border-slate-100 dark:border-slate-700/50 last:border-0"
            >
              <td className="px-4 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                {lectura.fecha.replace('T', ' ')}
              </td>
              <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                {lectura.dispositivo}
              </td>
              <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">
                {lectura.temperatura.toFixed(1)}
              </td>
              <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">
                {lectura.humedad.toFixed(1)}
              </td>
              <td className="px-4 py-2">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full border font-medium ${
                    lectura.estado === 'NORMAL'
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {lectura.estado}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
