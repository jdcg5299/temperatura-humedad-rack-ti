import { useId, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'

/**
 * Barra segmentada de ventana de tiempo (adaptación de la especificación
 * docs/ui/segmented-time-range-bar.md, Variante A con motion).
 *
 * Adaptaciones sobre la referencia: presets propios del sistema
 * (15 min, 1 h, 6 h, 24 h, 7 d), componente controlado (siempre le llega
 * `value` desde el dashboard) y sin los botones "Custom", "Default" y
 * "Filter", que no existen en este sistema: no se dejan botones sin función.
 */

// Medido de la especificación: interacción de toolbar estándar.
const PILL_TRANSITION = {
  type: 'spring',
  stiffness: 400,
  damping: 35,
} as const

export interface PresetItem {
  id: string
  label: string
}

export interface SegmentedTimeRangeBarProps {
  /** Opciones de ventana (se suministran por props, como pide la especificación). */
  presets: PresetItem[]
  /** Preset activo (controlado). */
  value: string
  /** Se dispara al elegir un preset. */
  onChange: (id: string) => void
  /** Clases extra del contenedor. */
  className?: string
}

export default function SegmentedTimeRangeBar({
  presets,
  value,
  onChange,
  className = '',
}: SegmentedTimeRangeBarProps) {
  // layoutId único por instancia: evita que el indicador "salte" entre
  // barras si hubiera varias en la misma página (falla documentada en la spec).
  const layoutGroupId = useId()
  const prefersReducedMotion = useReducedMotion()
  const botones = useRef<(HTMLButtonElement | null)[]>([])

  // Navegación con flechas dentro del radiogroup: mueve el foco y la
  // selección al hermano (comportamiento estándar de un radiogroup).
  const manejarTeclado = (evento: React.KeyboardEvent) => {
    if (evento.key !== 'ArrowRight' && evento.key !== 'ArrowLeft') return
    evento.preventDefault()
    const indice = presets.findIndex((p) => p.id === value)
    const salto = evento.key === 'ArrowRight' ? 1 : -1
    const siguiente = (indice + salto + presets.length) % presets.length
    onChange(presets[siguiente].id)
    botones.current[siguiente]?.focus()
  }

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-0.5 p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm text-xs font-medium text-slate-700 dark:text-slate-300 ${className}`}
      role="radiogroup"
      aria-label="Ventana de tiempo"
      onKeyDown={manejarTeclado}
    >
      {presets.map((preset, indice) => {
        const isSelected = preset.id === value

        return (
          <button
            key={preset.id}
            ref={(nodo) => {
              botones.current[indice] = nodo
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(preset.id)}
            className={`relative px-2.5 py-1.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              isSelected
                ? 'text-slate-900 dark:text-slate-100 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {isSelected && (
              <motion.div
                layoutId={`pill-${layoutGroupId}`}
                className="absolute inset-0 bg-slate-100 dark:bg-slate-700 rounded-md border border-slate-300/60 dark:border-slate-500/60 shadow-xs z-0"
                transition={prefersReducedMotion ? { duration: 0 } : PILL_TRANSITION}
              />
            )}
            {/* El indicador va detrás (z-0) y la etiqueta encima (z-10):
                así el texto nunca queda tapado por la píldora. */}
            <span className="relative z-10 inline-flex items-center gap-1.5 pointer-events-none">
              {preset.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
