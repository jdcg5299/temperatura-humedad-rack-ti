# Monitor de temperatura y humedad para un rack de TI

Un DHT11 dentro del rack mide temperatura y humedad reales. Una **Raspberry Pi 3** lo
lee por **GPIO4** y envía cada lectura por **HTTP (JSON)** a un **servidor Flask**
desplegado en una **EC2 de AWS**. Cada lectura queda en dos lugares: un **CSV** en el
disco de la EC2 y una base **PostgreSQL** en un **RDS privado**. Un **dashboard web**
muestra la gráfica, la tabla de lecturas recientes y un botón para bajar el CSV.

Es un proyecto académico de IoT con hardware real y despliegue en la nube.

## Arquitectura

![Diagrama de arquitectura](diagrams/arquitectura.png)

El diagrama interactivo (zoom, resaltar rutas, modo oscuro) está en
[`diagrams/arquitectura.html`](diagrams/arquitectura.html). El despliegue vive en la
región `us-east-2` (Ohio), en una VPC propia con dos subredes públicas y dos privadas:
la EC2 vive en la pública; el RDS, en una privada sin ruta a internet.

El servidor no distingue el origen de una lectura: lo único que acepta es un
`POST /api/lecturas` con `dispositivo`, `temperatura` y `humedad`. Quién manda qué
etiqueta queda en el campo `dispositivo`.

## Hardware del dispositivo

| Señal del DHT11 | Pin de la Pi              |
| --------------- | ------------------------- |
| 3,3 V           | pin físico 1              |
| DATA            | GPIO4 (pin físico 7)      |
| GND             | pin físico 9              |

El código abre el sensor como `board.D4` con `use_pulseio=False`: en la Pi, la
librería Blinka mide el DHT11 por bit-banging porque `pulseio` no está soportado.

El DHT11 falla de vez en cuando al medir (es normal en este sensor). El cliente
captura ese error, avisa por consola y reintenta en el siguiente ciclo: el programa
no se cae y solo se registran lecturas completas.

## Cómo funciona el flujo

1. El Pi mide el DHT11 en GPIO4. Si la lectura falla, avisa y reintenta en el
   siguiente ciclo.
2. `cliente-pi/enviar.py` arma el JSON
   `{ "dispositivo": "rack-pi-01", "temperatura": ..., "humedad": ... }` y hace
   `POST` al API en la IP elástica de la EC2 (puerto 5000). La Pi tiene su propia
   conexión de red: manda directo, sin equipo intermedio.
3. El servidor valida la lectura contra los rangos del DHT11, calcula el estado
   `NORMAL` o `ALERTA`, pone la fecha y guarda la fila en el CSV y en PostgreSQL
   dentro de un candado (un worker: un solo candado para todo el proceso).
4. El dashboard consulta `GET /api/lecturas?limit=N&desde=ISO` cada 10 segundos,
   dibuja la gráfica y la tabla; el botón **Descargar CSV** hace
   `GET /api/lecturas/csv`.
5. Para mantenimiento el administrador entra por `SSH` al puerto 22 de la EC2,
   restringido a su propia IP.

La única entrada pública del servidor es el puerto 5000. La base de datos queda
protegida dos veces: su subred no tiene salida a internet y el `sg-db` solo acepta
tráfico originado en `sg-web`.

## Umbrales

| Magnitud    | Rango normal | Rango físico del DHT11 |
| ----------- | ------------ | ---------------------- |
| Temperatura | 18 – 27 °C   | 0 – 50 °C (±2 °C)      |
| Humedad     | 40 – 60 %    | 0 – 100 % (±5 %)       |

Dentro del rango normal el estado es `NORMAL`; fuera de él, `ALERTA` (la lectura
igual se guarda). Fuera del rango físico es imposible para un DHT11 y el servidor
rechaza la lectura con `400`.

## Correr en local (SQLite, cliente simulado)

Sin más configuración el servidor guarda en SQLite (`servidor/datos.db`) y escribe
el CSV. Se necesita [uv](https://docs.astral.sh/uv/) y Node para el dashboard.

```bash
# servidor (http://localhost:5000)
cd servidor && uv sync && uv run app.py

# cliente simulado en el computador (sin GPIO, etiqueta rack-01-simulado)
cd cliente-pi && uv sync && MODO=simulado uv run enviar.py

# dashboard compilado (Flask lo sirve en /)
cd dashboard && npm install && npm run build
```

Prueba rápida del API sin cliente:

```bash
curl -X POST http://localhost:5000/api/lecturas \
  -H "Content-Type: application/json" \
  -d '{"dispositivo":"prueba","temperatura":24,"humedad":50}'
```

Para desarrollo del dashboard con recarga en caliente:

```bash
cd servidor && uv run app.py                     # terminal 1
cd dashboard && npm run dev                      # terminal 2 (proxy /api -> :5000)
```

## Correr en la Pi

En la Pi, desde la carpeta del proyecto:

```bash
SERVIDOR_URL=http://IP_ELASTICA:5000/api/lecturas DISPOSITIVO=rack-pi-01 \
  MODO=sensor INTERVALO_SEGUNDOS=5 \
  uv run --python 3.12 --with RPi.GPIO enviar.py
```

`--with RPi.GPIO` hace falta porque la librería del sensor (Blinka) lo pide y el
entorno que `uv` prepara para este proyecto no lo trae.

Variables que entiende `enviar.py` (todas por entorno; la IP del servidor nunca
vive en el código):

| Variable             | Default                          | Descripción                          |
| -------------------- | -------------------------------- | ------------------------------------ |
| `SERVIDOR_URL`       | `http://127.0.0.1:5000/api/lecturas` | Endpoint completo del API         |
| `DISPOSITIVO`        | `rack-01`                        | Nombre que viaja en cada lectura     |
| `MODO`               | `sensor`                         | `sensor` = DHT11 real; `simulado` = prueba de red |
| `INTERVALO_SEGUNDOS` | `10`                             | Segundos entre intentos (mínimo 1: el DHT11 hasta una lectura por segundo) |

`MODO=simulado` existe para ensayar la ruta de red antes de tener la Pi encendida.
No es evidencia: el dispositivo viaja etiquetado como `rack-01-simulado` y se
distingue de las lecturas reales. Los import de hardware están dentro de la función
que crea el sensor, por eso el modo simulado corre sin GPIO.

## Despliegue en AWS

Resumen de lo que verás en el diagrama (todo `us-east-2`, VPC `10.0.0.0/16`,
dos AZ, dos subredes públicas y dos privadas, **sin NAT Gateway**):

- **EC2 `rack-servidor`** (subred pública): Ubuntu 24.04 en `t3.micro`, disco `gp3`
  de 8 GiB, IP privada `10.0.4.26` e IP elástica `18.189.203.243`. Corre un servicio
  systemd (`rack`) con gunicorn: `uv run gunicorn -w 1 --threads 4 -b 0.0.0.0:5000 app:app`
  y sirve el API más el dashboard compilado en `servidor/static/`.
  El security group `sg-web`: 5000 abierto a internet, 22 solo desde la IP del
  administrador (acceso con par de claves SSH).
- **RDS `rack-iot-db`** (subred privada, grupo `rack-subnets-privadas`): PostgreSQL
  18.3 en `db.t4g.micro`, 20 GiB `gp2`, instancia única en `us-east-2a` (sin
  Multi-AZ), cifrado en reposo, accesible solo desde la VPC, puerto 5432, base
  inicial `rack` con la tabla `lecturas`. El security group `sg-db` solo acepta
  conexiones cuyo origen es `sg-web`.

El servidor encuentra la base de datos con la variable `DATABASE_URL` (formato
`postgresql://usuario:clave@host:5432/nombre`). En la EC2 se define en
`servidor/.env` a partir de [`servidor/.env.example`](servidor/.env.example); esa
clave nunca va al repositorio ni se pega en el código. Si la conexión falla, el
servidor muere al arrancar con un mensaje claro en lugar de perder lecturas.

## Configuración del servidor

| Variable       | Default                                   | Descripción                                 |
| -------------- | ----------------------------------------- | ------------------------------------------- |
| `DATABASE_URL` | *(sin valor: SQLite)*                     | URL de PostgreSQL para guardar las lecturas |

`app.py` atiende el puerto 5000 en `0.0.0.0` (desarrollo y gunicorn); no hay variable
para cambiarlo. El CSV (`lecturas.csv`) se escribe igual con SQLite o con PostgreSQL;
su header es `fecha,dispositivo,temperatura,humedad,estado` y nunca contiene filas a
medias (la lectura del archivo y la escritura comparten el mismo candado).

## API

Base: `http://18.189.203.243:5000` (en local, `http://localhost:5000`).

### `POST /api/lecturas`

```json
{ "dispositivo": "rack-pi-01", "temperatura": 24.0, "humedad": 50.0 }
```

`201` con el id, el estado y la fecha si la lectura se guardó:

```json
{ "id": 42, "estado": "NORMAL", "fecha": "2026-10-19T19:33:04" }
```

`400` con el motivo si no pasa la validación (y no se guarda nada). Motivos reales:
`el cuerpo debe ser JSON valido`, `faltan campos: humedad`,
`temperatura debe ser un numero`, `temperatura fuera del rango fisico 0.0-50.0 C` y
`humedad fuera del rango fisico 0.0-100.0 %`.

### `GET /api/lecturas?limit=N&desde=ISO`

Devuelve `{ "total": N, "lecturas": [...] }` de la más reciente a la más vieja.
`limit` (opcional, sin él: 20) topea la cantidad. `desde` (opcional, ISO 8601)
filtra desde esa fecha hacia adelante; si es inválida responde `400` con el error.
La ventana del dashboard usa este mismo endpoint (`desde` apuntando al inicio de
la ventana); las horas comparan contra el reloj del servidor, que en la EC2 es UTC.

### `GET /api/lecturas/csv`

Descarga el CSV completo tal como está en el disco de la EC2. Con el archivo ya
creado responde `200` con `Content-Type: text/csv` y
`Content-Disposition: attachment; filename=lecturas.csv`; si todavía no hay ninguna
lectura, responde `404` con
`{"error": "aun no existe el archivo lecturas.csv: no hay lecturas"}`.

```bash
curl -OJ http://18.189.203.243:5000/api/lecturas/csv   # -J respeta el nombre del servidor
```

## Limitaciones conocidas

- El tráfico viaja por **HTTP sin TLS ni autenticación**: el endpoint es público por
  diseño del ejercicio. Cualquier conocedor de la IP puede enviar lecturas.
- El CSV vive en el disco de una sola EC2: la fuente de verdad es la base de datos
  en RDS; si la máquina se pierde, el CSV se va con ella.
- La Pi es el único punto de medición: si se apaga o pierde red, no llegan lecturas
  nuevas (el sistema no inventa datos para tapar el hueco).
- Una sola EC2 sin balanceador: con ese tamaño es suficiente y más simple.

## Reglas del equipo

Las reglas de trabajo están en [`AGENTS.md`](AGENTS.md) y los principios en
[`CONSTITUTION.md`](CONSTITUTION.md).
