# Monitoreo de temperatura y humedad en un rack de TI

Sistema IoT académico que mide la temperatura y la humedad **reales** dentro de
un rack de TI con una Raspberry Pi 3 y un sensor DHT11, y las envía por HTTP a
un servidor web que corre en una máquina virtual Ubuntu local, donde cada
lectura se guarda en **dos** lugares: un archivo CSV (fácil de abrir y mostrar)
y una base de datos SQLite (para consultar el histórico).

> **¿Quieres replicar el proyecto desde cero?** Sigue la guía paso a paso en
> [`REPLICACION.md`](REPLICACION.md).

---

## Por qué existe este proyecto

Un rack de TI con equipos encendidos genera calor. Si la temperatura o la
humedad se salen de rangos seguros, los equipos fallan o envejecen antes. Este
proyecto permite vigilar esas condiciones de forma continua y con evidencia
almacenada (CSV + base de datos), como caso de estudio de IoT con hardware real.

---

## Arquitectura

```
 ┌─────────────────────┐        HTTP POST (JSON) cada 10 s        ┌──────────────────────────────┐
 │  Raspberry Pi 3     │ ───────────────────────────────────────▶ │  VM Ubuntu (Vagrant)         │
 │  Sensor DHT11       │                                          │  Servidor Flask              │
 │  cliente-pi/        │ ◀─────────────────────────────────────── │  servidor/  0.0.0.0:5000     │
 │  enviar.py          │        respuesta 201 / 400               │                              │
 └─────────────────────┘                                          │   ┌──────────┬────────────┐  │
        GPIO4 (pin 7)                                             │   │ lecturas │  datos.db  │  │
                                                                  │   │   .csv   │  (SQLite)  │  │
                                                                  │   └──────────┴────────────┘  │
                                                                  └──────────────────────────────┘
```

- La **Raspberry Pi** solo mide y envía (no guarda nada).
- La **VM** solo recibe y guarda (no lee sensores).
- El **computador** es donde se edita el código; la carpeta del proyecto aparece
  dentro de la VM en `/vagrant`.

---

## Cómo funciona el flujo

1. `cliente-pi/enviar.py` lee el DHT11 (temperatura y humedad) cada 10 segundos.
2. Envía un JSON `{"dispositivo", "temperatura", "humedad"}` por `POST` a
   `/api/lecturas`. **La fecha la pone el servidor**, porque el reloj de la Pi
   puede estar desincronizado.
3. El servidor **valida** la lectura (campos completos, numéricos, dentro del
   rango físico posible del DHT11: 0–50 °C y 0–100 %).
4. Calcula el **estado**: `NORMAL` si está dentro de los umbrales, `ALERTA` si
   no. Luego guarda la lectura en **CSV y SQLite** dentro de un candado
   (`threading.Lock`) para que dos envíos simultáneos no corrompan el CSV.
5. Responde `201` con el id, el estado y la fecha. Si la lectura no pasa la
   validación, responde `400` con el motivo y **no** guarda nada.
6. Si el sensor falla o no hay red, el cliente imprime el error, espera y
   reintenta: **el bucle nunca se cae**.

---

## Umbrales y estados

| Magnitud | Rango NORMAL | Rango físico del DHT11 |
|---|---|---|
| Temperatura | 18 – 27 °C | 0 – 50 °C (±2 °C) |
| Humedad relativa | 40 – 60 % | 0 – 100 % (±5 %) |

Fuera de los umbrales → `estado: "ALERTA"` (se guarda igualmente, solo cambia
el estado). Fuera del rango físico → el servidor **rechaza** la lectura con `400`.

---

## Estructura del repositorio

```
temperatura-humedad-rack-ti/
├── CONSTITUTION.md          # Principios del proyecto (manda sobre todo)
├── AGENTS.md                # Reglas de trabajo del equipo
├── README.md                # Este archivo
├── REPLICACION.md           # Guía paso a paso para replicar el proyecto
├── Vagrantfile              # VM Ubuntu (red en modo puente)
├── cliente-pi/              # Corre SOLO en la Raspberry Pi
│   ├── enviar.py            #   lee el DHT11 y envía al servidor
│   ├── pyproject.toml       #   dependencias (uv)
│   ├── rack.env.example     #   plantilla de configuración (sin IP real)
│   └── rack.service         #   servicio systemd para arranque automático
├── gateway/                 # Gateway: Arduino o simulado -> servidor
│   └── gateway.py           #   envía lecturas al API (modo simulado o serial)
├── dashboard/               # Dashboard web (Vite + React + TypeScript)
│   ├── src/components/      #   barra de ventanas, gráfica, tabla, tema
│   ├── src/App.tsx          #   estado, auto-refresco y layout
│   ├── pruebas/evidencia.mjs#   prueba del dashboard en navegador (Playwright)
│   └── package.json         #   dependencias (npm)
├── docs/ui/                 # Especificaciones de interfaz
│   └── segmented-time-range-bar.md
├── docs/capturas/           # Evidencia en imágenes del dashboard
└── servidor/                # Corre SOLO en la VM Ubuntu
    ├── app.py               #   rutas Flask (POST/GET /api/lecturas) + dashboard
    ├── validacion.py        #   umbrales, validación y cálculo de estado
    ├── almacenamiento.py    #   doble guardado (SQLite/PostgreSQL) + CSV con lock
    ├── pyproject.toml       #   dependencias (uv)
    ├── .env.example         #   plantilla de configuración (sin claves reales)
    └── static/              #   resultado de `npm run build` (se genera, no se versiona)
```

Los archivos `datos.db` y `lecturas.csv` se crean solos en `servidor/` al
recibir la primera lectura y **no** van al repositorio (son datos, no código).
Igual `cliente-pi/rack.env`: contiene la IP real y queda solo en cada equipo.

---

## Documentación de la API

Base: `http://IP_VM:5000`

### `POST /api/lecturas`

Recibe una lectura del sensor.

```json
{ "dispositivo": "rack-01", "temperatura": 24, "humedad": 50 }
```

**Respuesta `201 Created`** (lectura guardada):

```json
{ "id": 1, "estado": "NORMAL", "fecha": "2026-10-18T19:33:04" }
```

**Respuestas `400 Bad Request`** (nada se guarda):

| Cuerpo de la respuesta | Cuándo |
|---|---|
| `{"error": "el cuerpo debe ser JSON valido"}` | El cuerpo no es JSON o la petición no lo trae |
| `{"error": "faltan campos: humedad"}` | Falta algún campo |
| `{"error": "temperatura debe ser un numero"}` | No es número (tampoco `true`/`false`) |
| `{"error": "temperatura fuera del rango fisico 0.0-50.0 C"}` | Imposible para el DHT11 |

### `GET /api/lecturas?limit=N&desde=ISO`

Las últimas `N` lecturas, de la más reciente a la más vieja. `limit` es
opcional: por defecto `20`; debe ser un entero ≥ 1.

`desde` es **opcional**: una fecha ISO en hora local del servidor (el mismo
formato con que se guardan las fechas, `YYYY-MM-DDTHH:MM:SS`). Si viene, solo
se devuelven las lecturas con `fecha >= desde`. Sirve para que el dashboard
pida solo su ventana de tiempo en vez de toda la historia.

| Caso | Resultado |
|---|---|
| `?limit=50` | Últimas 50 lecturas (sin `desde` no cambia nada) |
| `?desde=2026-10-19T19:00:00` | Solo las lecturas desde esa hora |
| `?desde=2026-10-19T19:00:00&limit=10` | Filtro por fecha y tope de filas, combinados |
| `?desde=no-es-una-fecha` | `400` con `{"error": "desde debe ser una fecha ISO valida, ..."}` |

```json
{
  "total": 2,
  "lecturas": [
    { "id": 3, "dispositivo": "rack-01", "temperatura": 32.0, "humedad": 70.0,
      "fecha": "2026-10-18T19:40:10", "estado": "ALERTA" },
    { "id": 2, "dispositivo": "rack-01", "temperatura": 24.0, "humedad": 50.0,
      "fecha": "2026-10-18T19:39:60", "estado": "NORMAL" }
  ]
}
```

### `GET /api/lecturas/csv`

Descarga el **CSV completo** (`servidor/lecturas.csv`), tal como está en el
servidor. No depende de la ventana de tiempo que elija el dashboard.

| Respuesta | Cuándo |
|---|---|
| `200` con `Content-Disposition: attachment; filename=lecturas.csv` y `Content-Type: text/csv` | El archivo existe |
| `404` con `{"error": "aun no existe el archivo lecturas.csv: no hay lecturas"}` | Todavía no se ha recibido ninguna lectura |

La lectura del archivo se hace con el mismo lock que protege la escritura, así
que la descarga nunca entrega una fila a medias.

```bash
curl -OJ http://IP_VM:5000/api/lecturas/csv    # -J usa el nombre del servidor
```

---

## Almacenamiento de la evidencia

**CSV** (`servidor/lecturas.csv`) — se abre con cualquier programa:

```csv
fecha,dispositivo,temperatura,humedad,estado
2026-10-18T19:33:04,rack-01,24.0,50.0,NORMAL
```

**SQLite** (`servidor/datos.db`) — tabla `lecturas`:

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
dispositivo TEXT    temperatura REAL    humedad REAL
fecha TEXT          estado TEXT
```

Consulta rápida desde el computador:

```powershell
cd servidor
uv run python -c "import sqlite3; print(sqlite3.connect('datos.db').execute('SELECT * FROM lecturas').fetchall())"
```

---

## Dashboard

Dashboard web (Vite + React + TypeScript + Tailwind) que muestra la evolución
de temperatura y humedad. **No inventa datos**: todo lo que se ve viene del
API del servidor (`GET /api/lecturas`).

| Pieza | Qué hace |
|---|---|
| Barra de ventanas | Presets `15 min`, `1 h`, `6 h`, `24 h`, `7 d` (por defecto `1 h`). La ventana elegida manda sobre la gráfica y la tabla. |
| Botón "Descargar CSV" | Junto a la barra de ventanas: baja el CSV completo del servidor (`GET /api/lecturas/csv`). |
| Gráfica (Recharts) | Temperatura (eje izquierdo) y humedad (eje derecho). Si la ventana trae muchas lecturas, las agrupa por **promedio** en cubetas de tiempo para que no se sature. |
| Tabla | Las 20 lecturas más recientes, sin agrupar, con su estado (`NORMAL` / `ALERTA`). |
| Auto-refresco | Consulta el API cada 10 s; si falla, avisa y reintenta sin tumbar la página. |
| Tema | Claro por defecto; el toggle activa el oscuro. Si el sistema está en oscuro (`prefers-color-scheme`), arranca en oscuro. |

La barra de ventanas sigue la especificación `docs/ui/segmented-time-range-bar.md`
(Variante A con `motion`): el indicador se desliza entre presets, es un
`role="radiogroup"` que se recorre con flechas y Tab, el foco se ve, y con
`prefers-reduced-motion` no hay animación.

### Construir y servir

El build se guarda en `servidor/static/`, que Flask sirve en `/`:

```bash
cd dashboard
npm install
npm run build          # genera ../servidor/static
cd ../servidor
uv run app.py          # abre http://IP_VM:5000/ en el navegador
```

### Desarrollo (con recarga en caliente)

```bash
# terminal 1: el API
cd servidor && uv run app.py
# terminal 2: el dashboard (proxy /api -> localhost:5000)
cd dashboard && npm run dev
```

### Evidencia

`npm run evidencia` abre el dashboard en un navegador real (Chromium de
Playwright) y comprueba que la gráfica cambia al cambiar de ventana, que el
indicador se desliza, que el auto-refresco sigue vivo, que las flechas
navegan y que **no hay warnings en la consola**. Las capturas quedan en
`docs/capturas/`.

---

## Configuración (variables de entorno)

El cliente se configura **sin tocar código** (la IP nunca vive en el repositorio):

| Variable | Default | Descripción |
|---|---|---|
| `SERVIDOR_URL` | `http://127.0.0.1:5000/api/lecturas` | URL completa del endpoint |
| `DISPOSITIVO` | `rack-01` | Nombre del dispositivo en las lecturas |
| `INTERVALO_SEGUNDOS` | `10` | Frecuencia de envío (mínimo 1: el DHT11 no rinde más) |
| `MODO` | `sensor` | `sensor` = lectura real; `simulado` = prueba de red |

En la Pi estas variables se cargan desde `cliente-pi/rack.env` (creado a partir
de `rack.env.example`) mediante el servicio systemd.

### Base de datos del servidor (SQLite o PostgreSQL)

El servidor también se configura **sin tocar código**. Si existe la variable
de entorno `DATABASE_URL`, las lecturas se guardan en **PostgreSQL** (con
psycopg 3) en vez de SQLite; si no existe, sigue usando `datos.db` (SQLite).
El CSV (`lecturas.csv`) se escribe igual en ambos modos.

| Variable | Default | Descripción |
|---|---|---|
| `DATABASE_URL` | *(sin valor: SQLite)* | `postgresql://usuario:clave@host:5432/nombre` |

Para no poner la clave en el código ni en el repositorio, el servidor lee
`servidor/.env` (creado a partir de `servidor/.env.example`) si existe; las
variables que ya estén definidas en el entorno ganan sobre el archivo. Si
`DATABASE_URL` está definida pero el servidor no logra conectarse, el programa
**falla al arrancar** con un mensaje claro (sin mostrar la clave) en vez de
perder lecturas en silencio.

Ejemplo de arranque con PostgreSQL (en la VM):

```bash
cd /vagrant/servidor
export DATABASE_URL="postgresql://rack:LA_CLAVE@localhost:5432/rack"
uv run app.py
```

### El modo simulado

`MODO=simulado` envía una lectura de ejemplo **únicamente** para comprobar la
ruta de red antes de tener la Pi encendida. Está **apagado por defecto**, es
explícito y las lecturas van etiquetadas como `rack-01-simulado` para que nunca
se confundan con evidencia real.

---

## Dónde corre cada cosa

| Entorno | Qué corre | Comando |
|---|---|---|
| Computador | Edición de código, git, pruebas `curl` | — |
| VM Ubuntu (Vagrant) | Servidor Flask (desarrollo) | `cd /vagrant/servidor && uv run app.py` |
| VM Ubuntu (Vagrant) | Servidor Flask (producción) | ver la sección siguiente |
| VM Ubuntu (Vagrant) | Dashboard (build) | `cd /vagrant/dashboard && npm install && npm run build` |
| Computador | Gateway simulado (para probar sin sensor) | `python3 gateway/gateway.py` (MODO=simulado) |
| Raspberry Pi | Cliente del sensor DHT11 | `uv run enviar.py` o `systemctl status rack` |

---

## Producción con gunicorn

`app.run(...)` es para desarrollo. Para producción se usa **gunicorn**
(dependencia ya declarada con `uv`):

```bash
cd /vagrant/servidor
uv run gunicorn -w 1 --threads 4 -b 0.0.0.0:5000 app:app
```

**Importante: UN SOLO worker (`-w 1`).** El `threading.Lock` que protege la
escritura del CSV vive en la memoria de **un proceso**: con dos o más workers
habría varios candados (uno por proceso) y el CSV podría corromperse. Con un
worker y `--threads 4` se atienden peticiones en paralelo pero sigue habiendo
un único candado.

Si se usa PostgreSQL, no olvides definir `DATABASE_URL` (export o
`servidor/.env`) antes de lanzar gunicorn.

---

## Tecnologías

- **Python 3.11+**, **Flask**, **SQLite** (stdlib) o **PostgreSQL** (psycopg 3),
  **gunicorn** para producción, **requests**.
- **adafruit-circuitpython-dht** + Blinka para hablar con el DHT11 por GPIO.
- **uv** para dependencias reproducibles de Python (`pyproject.toml` + `uv.lock`).
- **Vite + React + TypeScript + Tailwind** para el dashboard, con **Recharts**
  (gráfica), **motion** (animación de la barra de ventanas) y **lucide-react**
  (iconos). Las fuentes van empaquetadas con npm: no se usa ningún CDN.
- **npm** para las dependencias del dashboard (`package.json` + `package-lock.json`).
- **Vagrant + VirtualBox** para la VM Ubuntu local.
- **systemd** para arrancar el cliente con la Pi.

---

## Autor

Julian David Correa Garcia — proyecto académico de especialización en
Inteligencia Artificial (Universidad Autónoma de Occidente).

Reglas completas del equipo en [`AGENTS.md`](AGENTS.md) y principios en
[`CONSTITUTION.md`](CONSTITUTION.md).
