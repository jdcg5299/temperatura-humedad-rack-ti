import type { Lectura } from './tipos'

/** Ventanas de tiempo del dashboard: id, etiqueta, duración y tope de filas. */
export interface Ventana {
  id: string
  label: string
  /** Duración de la ventana en milisegundos. */
  ms: number
  /**
   * Tope de lecturas que se piden al servidor. Sobredimensionado a propósito:
   * es un máximo, no un tamaño esperado. Con el gateway a 1 lectura/5 s,
   * 24 h serían ~17 000 filas; se limita y además la gráfica agrupa por cubetas.
   */
  limite: number
}

export const VENTANAS: Ventana[] = [
  { id: '15m', label: '15 min', ms: 15 * 60 * 1_000, limite: 400 },
  { id: '1h', label: '1 h', ms: 60 * 60 * 1_000, limite: 1_500 },
  { id: '6h', label: '6 h', ms: 6 * 60 * 60 * 1_000, limite: 5_000 },
  { id: '24h', label: '24 h', ms: 24 * 60 * 60 * 1_000, limite: 10_000 },
  { id: '7d', label: '7 d', ms: 7 * 24 * 60 * 60 * 1_000, limite: 10_000 },
]

/** Valor por defecto: 1 hora. */
export const VENTANA_POR_DEFECTO = '1h'

export function buscarVentana(id: string): Ventana {
  return VENTANAS.find((v) => v.id === id) ?? VENTANAS[1]
}

/** Fecha ISO en hora local, con el mismo formato con que el servidor guarda. */
export function fechaIsoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  )
}

/** Fecha ISO de hace `ms` milisegundos (inicio de la ventana). */
export function hace(ms: number): string {
  return fechaIsoLocal(new Date(Date.now() - ms))
}

/** Un punto listo para la gráfica (promedio de su cubeta si hubo que agrupar). */
export interface PuntoGrafica {
  /** Fecha representativa de la cubeta (de la primera lectura que cayó en ella). */
  fecha: string
  etiqueta: string
  temperatura: number
  humedad: number
}

function etiquetaCorta(fecha: string, larga: boolean): string {
  const hhmm = fecha.slice(11, 16)
  // En ventanas de más de un día se incluye el día para que no se repita "19:15".
  return larga ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)} ${hhmm}` : hhmm
}

/**
 * Prepara los puntos de la gráfica. Si hay demasiadas lecturas, agrupa por
 * promedio en cubetas de tiempo (apuntando a ~180 puntos) para que la
 * gráfica no se sature. La tabla usa las filas crudas, no esto.
 */
export function puntosParaGrafica(lecturas: Lectura[], ventanaMs: number): PuntoGrafica[] {
  if (lecturas.length === 0) return []
  const etiquetaLarga = ventanaMs > 24 * 60 * 60 * 1_000
  // El servidor devuelve de la más reciente a la más vieja; la gráfica
  // quiere el tiempo hacia adelante, así que se voltea.
  const ascendente = [...lecturas].reverse()

  const objetivo = 180
  if (ascendente.length <= objetivo) {
    return ascendente.map((l) => ({
      fecha: l.fecha,
      etiqueta: etiquetaCorta(l.fecha, etiquetaLarga),
      temperatura: l.temperatura,
      humedad: l.humedad,
    }))
  }

  // Cada cubeta dura ventanaMs/objetivo (mínimo 1 s). Se promedia lo que cae en ella.
  const msCubeta = Math.max(Math.floor(ventanaMs / objetivo), 1_000)
  interface Acumulador {
    fecha: string
    temperatura: number
    humedad: number
    cantidad: number
  }
  const cubetas = new Map<number, Acumulador>()
  for (const lectura of ascendente) {
    const t = Date.parse(lectura.fecha)
    const numero = Math.floor(t / msCubeta)
    const anterior = cubetas.get(numero)
    if (anterior) {
      anterior.temperatura += lectura.temperatura
      anterior.humedad += lectura.humedad
      anterior.cantidad += 1
    } else {
      cubetas.set(numero, {
        fecha: lectura.fecha,
        temperatura: lectura.temperatura,
        humedad: lectura.humedad,
        cantidad: 1,
      })
    }
  }
  return [...cubetas.values()].map((c) => ({
    fecha: c.fecha,
    etiqueta: etiquetaCorta(c.fecha, etiquetaLarga),
    temperatura: c.temperatura / c.cantidad,
    humedad: c.humedad / c.cantidad,
  }))
}
