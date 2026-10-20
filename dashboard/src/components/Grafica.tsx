import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PuntoGrafica } from '../ventanas'

/**
 * Gráfica de temperatura y humedad en el tiempo (Recharts).
 * Eje izquierdo: temperatura (°C). Eje derecho: humedad (%).
 * Los colores se ajustan al tema para que las líneas no se pierdan
 * en el fondo oscuro.
 */
export default function Grafica({
  puntos,
  oscuro,
}: {
  puntos: PuntoGrafica[]
  oscuro: boolean
}) {
  if (puntos.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
        Sin lecturas en esta ventana todavía.
      </div>
    )
  }

  const colorTemperatura = '#4f46e5' // indigo-600: el acento del sistema
  const colorHumedad = '#0891b2' // cyan-600: se distingue del indigo
  const colorEje = oscuro ? '#94a3b8' : '#64748b' // slate-400 / slate-500
  const colorLinea = oscuro ? '#334155' : '#e2e8f0' // líneas de la cuadrícula
  const fondoTooltip = oscuro ? '#1e293b' : '#ffffff'
  const textoTooltip = oscuro ? '#e2e8f0' : '#0f172a'

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={puntos} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={colorLinea} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="etiqueta"
            tick={{ fontSize: 11, fill: colorEje }}
            tickLine={false}
            axisLine={{ stroke: colorLinea }}
            minTickGap={28}
          />
          <YAxis
            yAxisId="temp"
            tick={{ fontSize: 11, fill: colorEje }}
            tickLine={false}
            axisLine={false}
            width={36}
            label={{
              value: '°C',
              position: 'insideTopLeft',
              fontSize: 11,
              fill: colorEje,
              dy: -4,
            }}
            domain={['auto', 'auto']}
          />
          <YAxis
            yAxisId="hum"
            orientation="right"
            tick={{ fontSize: 11, fill: colorEje }}
            tickLine={false}
            axisLine={false}
            width={36}
            label={{
              value: '%',
              position: 'insideTopRight',
              fontSize: 11,
              fill: colorEje,
              dy: -4,
            }}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              background: fondoTooltip,
              border: `1px solid ${colorLinea}`,
              borderRadius: 8,
              fontSize: 12,
              color: textoTooltip,
            }}
            labelStyle={{ color: textoTooltip }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temperatura"
            name="Temperatura (°C)"
            stroke={colorTemperatura}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="hum"
            type="monotone"
            dataKey="humedad"
            name="Humedad (%)"
            stroke={colorHumedad}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
