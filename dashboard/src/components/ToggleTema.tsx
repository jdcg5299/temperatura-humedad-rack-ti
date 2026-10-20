import { Moon, Sun } from 'lucide-react'

/**
 * Toggle de tema claro/oscuro. El tema claro es el por defecto; el oscuro
 * es opcional. El valor inicial respeta prefers-color-scheme del sistema,
 * y la elección del usuario se recuerda en localStorage.
 */
export function inicializarTema(): boolean {
  const guardado = localStorage.getItem('tema')
  if (guardado === 'oscuro') return true
  if (guardado === 'claro') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export default function ToggleTema({
  oscuro,
  onCambiar,
}: {
  oscuro: boolean
  onCambiar: (oscuro: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onCambiar(!oscuro)}
      aria-label={oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      title={oscuro ? 'Tema claro' : 'Tema oscuro'}
      className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      {oscuro ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}
