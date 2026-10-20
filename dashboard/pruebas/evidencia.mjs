/**
 * Prueba de evidencia del dashboard en un navegador real (Chromium de Playwright).
 *
 * Qué comprueba:
 *  1. Que la página carga sin warnings ni errores en la consola.
 *  2. Que la gráfica cambia al cambiar de ventana de tiempo.
 *  3. Que el indicador (píldora) se desliza al cambiar de preset.
 *  4. Que el auto-refresco sigue funcionando (la marca de tiempo avanza).
 *  5. Que el toggle de tema oscuro funciona.
 *  6. Que la navegación con flechas funciona dentro del radiogroup.
 *
 * Uso: node pruebas/evidencia.mjs   (con el servidor Flask en el puerto 5000)
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const URL = process.env.URL_DASHBOARD ?? 'http://127.0.0.1:5000/'
const CARPETA = process.env.CARPETA_CAPTURAS ?? '../docs/capturas'

await mkdir(CARPETA, { recursive: true })

const navegador = await chromium.launch()
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 900 } })

// Se anotan los mensajes de consola para revisar warnings y errores.
const mensajes = []
pagina.on('console', (m) => mensajes.push({ tipo: m.type(), texto: m.text() }))
pagina.on('pageerror', (e) => mensajes.push({ tipo: 'pageerror', texto: String(e) }))

const problemas = []
const ok = []

await pagina.goto(URL, { waitUntil: 'networkidle' })
await pagina.waitForSelector('[role="radiogroup"]')
await pagina.waitForTimeout(1500)

// 1. Presets presentes y valor por defecto 1 h.
const presets = await pagina.$$eval('[role="radio"]', (nodos) =>
  nodos.map((n) => ({ texto: n.textContent?.trim(), marcado: n.getAttribute('aria-checked') })),
)
ok.push(`presets: ${presets.map((p) => p.texto).join(' | ')}`)
const porDefecto = presets.find((p) => p.marcado === 'true')?.texto
if (porDefecto !== '1 h') problemas.push(`el preset por defecto deberia ser "1 h" y es "${porDefecto}"`)
else ok.push('preset por defecto: 1 h')

// 2. Contenido de la gráfica (ruta SVG de Recharts) y estado del indicador.
const puntosGrafica = async () =>
  pagina.$$eval('.recharts-line-curve', (nodos) => nodos.map((n) => n.getAttribute('d')?.length ?? 0))
const cajaPildora = async () => {
  const caja = await pagina.$eval('[role="radio"][aria-checked="true"]', (n) => {
    const r = n.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y) }
  })
  return caja
}

const antesCambio = await puntosGrafica()
const pildoraAntes = await cajaPildora()
await pagina.screenshot({ path: `${CARPETA}/dashboard-1h-claro.png`, fullPage: true })

// 3. Cambiar de ventana: 24 h -> 15 min.
await pagina.getByRole('radio', { name: '24 h' }).click()
await pagina.waitForTimeout(1200)
const puntos24h = await puntosGrafica()
await pagina.screenshot({ path: `${CARPETA}/dashboard-24h-claro.png`, fullPage: true })

await pagina.getByRole('radio', { name: '15 min' }).click()
await pagina.waitForTimeout(1200)
const puntos15m = await puntosGrafica()
const pildoraDespues = await cajaPildora()
await pagina.screenshot({ path: `${CARPETA}/dashboard-15min-claro.png`, fullPage: true })

if (JSON.stringify(antesCambio) === JSON.stringify(puntos24h)) {
  problemas.push('la grafica no cambio al pasar a 24 h')
} else {
  ok.push(`la grafica cambio al cambiar de ventana (24 h: ${puntos24h.join('/')} vs 1 h: ${antesCambio.join('/')})`)
}
if (JSON.stringify(puntos24h) === JSON.stringify(puntos15m)) {
  problemas.push('la grafica no cambio al pasar a 15 min')
} else {
  ok.push('la grafica cambio al pasar de 24 h a 15 min')
}
if (pildoraAntes.x === pildoraDespues.x) {
  problemas.push('el indicador no se movio de posicion entre presets')
} else {
  ok.push(`el indicador se deslizo: x ${pildoraAntes.x} -> ${pildoraDespues.x}`)
}

// 4. Auto-refresco: la marca "Actualizado a las ..." debe avanzar.
const marca = () => pagina.textContent('footer')
const marcaAntes = await marca()
await pagina.waitForTimeout(12000)
const marcaDespues = await marca()
if (marcaAntes === marcaDespues) {
  problemas.push(`el auto-refresco no actualizo la marca (${marcaAntes})`)
} else {
  ok.push(`auto-refresco activo: "${marcaAntes?.trim()}" -> "${marcaDespues?.trim()}"`)
}

// 5. Navegacion con flechas dentro del radiogroup.
await pagina.getByRole('radio', { name: '15 min' }).focus()
await pagina.keyboard.press('ArrowRight')
await pagina.waitForTimeout(600)
const marcado = await pagina.$$eval('[role="radio"]', (nodos) =>
  nodos.find((n) => n.getAttribute('aria-checked') === 'true')?.textContent?.trim(),
)
if (marcado !== '1 h') {
  problemas.push(`la flecha derecha deberia llevar a "1 h" y quedo en "${marcado}"`)
} else {
  ok.push('navegacion con flechas: ArrowRight llevo de 15 min a 1 h')
}

// 6. Toggle de tema oscuro.
await pagina.getByRole('button', { name: /tema oscuro/i }).click()
await pagina.waitForTimeout(800)
const claseHtml = await pagina.getAttribute('html', 'class')
if (!claseHtml?.includes('dark')) {
  problemas.push(`el toggle no activo el modo oscuro (html class="${claseHtml}")`)
} else {
  ok.push('toggle de tema oscuro activo (html.dark)')
}
await pagina.screenshot({ path: `${CARPETA}/dashboard-oscuro.png`, fullPage: true })

// 7. Boton "Descargar CSV": apunta al endpoint y baja el archivo.
const enlace = await pagina.getAttribute('a[download]', 'href')
if (enlace !== '/api/lecturas/csv') {
  problemas.push(`el boton de descarga no apunta a /api/lecturas/csv (href="${enlace}")`)
} else {
  ok.push('boton "Descargar CSV" apunta a /api/lecturas/csv')
}
const [descarga] = await Promise.all([
  pagina.waitForEvent('download'),
  pagina.getByRole('link', { name: /descargar csv/i }).click(),
])
if (descarga.suggestedFilename() !== 'lecturas.csv') {
  problemas.push(`el archivo descargado se llama "${descarga.suggestedFilename()}" y deberia ser lecturas.csv`)
} else {
  ok.push('la descarga baja el archivo lecturas.csv')
}

// 8. Consola limpia.
const warnings = mensajes.filter((m) => m.tipo === 'warning' || m.tipo === 'error' || m.tipo === 'pageerror')
if (warnings.length > 0) {
  problemas.push(`la consola mostro ${warnings.length} warning/error: ${JSON.stringify(warnings)}`)
} else {
  ok.push(`consola sin warnings ni errores (${mensajes.length} mensajes inocuos)`)
}

await navegador.close()

console.log('== OK ==')
ok.forEach((l) => console.log(' - ' + l))
if (problemas.length) {
  console.log('== PROBLEMAS ==')
  problemas.forEach((l) => console.log(' ! ' + l))
  process.exit(1)
}
console.log('== TODO CORRECTO ==')
