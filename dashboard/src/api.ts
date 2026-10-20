import type { Lectura, RespuestaLecturas } from './tipos'

/**
 * Pide las lecturas de una ventana de tiempo al servidor.
 * desde: fecha ISO local (ej: 2026-10-19T19:00:00).
 * limite: tope de filas que el servidor devuelve.
 */
export async function pedirLecturas(desde: string, limite: number): Promise<Lectura[]> {
  const url = `/api/lecturas?limit=${limite}&desde=${encodeURIComponent(desde)}`
  const respuesta = await fetch(url)
  if (!respuesta.ok) {
    throw new Error(`el servidor respondio HTTP ${respuesta.status}`)
  }
  const datos: RespuestaLecturas = await respuesta.json()
  return datos.lecturas
}
