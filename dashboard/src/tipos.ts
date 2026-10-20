/** Una lectura tal como la devuelve el API del servidor. */
export interface Lectura {
  id: number
  dispositivo: string
  temperatura: number
  humedad: number
  /** Fecha ISO en hora local del servidor, ej: "2026-10-19T19:15:09". */
  fecha: string
  estado: string
}

/** Respuesta de GET /api/lecturas. */
export interface RespuestaLecturas {
  total: number
  lecturas: Lectura[]
}
