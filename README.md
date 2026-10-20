# Monitor de temperatura y humedad para un rack de TI

Un DHT11 dentro del rack mide temperatura y humedad reales. Un **Arduino Uno** lo lee
por el pin 2 y entrega los datos por el **puerto serial USB (9600 baudios)** a un
**gateway** en Python que corre en un portátil Windows. El gateway los publica por
**HTTP (JSON)** en un **servidor Flask** desplegado en una **EC2 de AWS**, donde cada
lectura queda guardada en dos lugares: un **CSV** en el disco de la EC2 y una base
**PostgreSQL** en un **RDS privado**. Un **dashboard web** muestra la gráfica, la
tabla de lecturas recientes y un botón para bajar el CSV.

Es un proyecto académico de IoT con hardware real y despliegue en la nube.

## Arquitectura

![Diagrama de arquitectura](diagrams/arquitectura.png)

El diagrama interactivo (zoom, resaltar rutas, modo oscuro) está en
[`diagrams/arquitectura.html`](diagrams/arquitectura.html). El despliegue vive en la
región `us-east-2` (Ohio), dentro de una VPC propia con dos subredes públicas y dos
privadas: la EC2 vive en la pública; el RDS, en una privada sin ruta a internet.

## Cómo funciona el flujo

1. El DHT11 (pin 2, con 5 V y GND) responde a cada lectura del Arduino.
2. El Arduino escribe por el serial (`COM7` a 9600 en el gateway) el JSON
   `{"t": 24.9, "h": 44.0}`.
3. `gateway.py` recibe esa línea, la convierte en
   `{ "dispositivo": ..., "temperatura": ..., "humedad": ... }` y hace `POST` al
   API en la IP pública de la EC2 (puerto 5000).
4. El servidor valida la lectura contra los rangos del DHT11, calcula el estado
   `NORMAL` o `ALERTA`, pone la fecha y guarda la fila en el CSV y en PostgreSQL
   dentro de un candado (un worker: un solo candado para todo el proceso).
5. El dashboard consulta `GET /api/lecturas?limit=N&desde=ISO` cada 10 segundos,
   dibuja la gráfica y la tabla; el botón **Descargar CSV** hace
   `GET /api/lecturas/csv`.
6. Para mantenimiento el administrador entra por `SSH` al puerto 22 de la EC2
   (restringido a su propia IP). Si el sensor, el serial o la red fallan, el
   gateway avisa por consola, espera y reintenta: el bucle se mantiene vivo.

La única entrada pública del servidor es el puerto 5000. La base de datos queda
protegida dos veces: su subred no tiene salida a internet y el `sg-db` solo acepta
tráfico originado en `sg-web`.

## Umbrales

| Magnitud      | Rango normal | Rango físico del DHT11 |
| ------------- | ------------ | ---------------------- |
| Temperatura   | 18 – 27 °C   | 0 – 50 °C (±2 °C)      |
| Humedad       | 40 – 60 %    | 0 – 100 % (±5 %)       |

Dentro del rango normal el estado es `NORMAL`; fuera de él, `ALERTA` (la lectura
igual se guarda). Fuera del rango físico es imposible para un DHT11 y el servidor
rechaza la lectura con `400`.

## Correr en local (SQLite, gateway simulado)

Sin más configuración el servidor guarda en SQLite (`servidor/datos.db`) y escribe
el CSV. Se necesita solo [uv](https://docs.astral.sh/uv/) y Node para el dashboard.

```bash
# servidor (http://localhost:5000)
cd servidor && uv sync && uv run app.py

# gateway simulado (etiqueta rack-01-simulado, sin sensor real)
uv run --with requests --with pyserial gateway/gateway.py

# dashboard compilado (Flask lo sirve en /)
cd dashboard && npm install && npm run build
```

Prueba rápida del API sin gateway:

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

## Configuración del gateway

`gateway.py` no toca código para cambiarse de modo: todo se define con variables
de entorno:

| Variable            | Default                             | Descripción                                  |
| ------------------- | ----------------------------------- | -------------------------------------------- |
| `SERVIDOR_URL`      | `http://localhost:5000/api/lecturas` | Endpoint completo del API                   |
| `DISPOSITIVO`       | `rack-01`                           | Nombre con el que viaja cada lectura         |
| `INTERVALO_SEGUNDOS`| `5`                                 | Segundos entre envíos                        |
| `MODO`              | `simulado`                          | `serial` = Arduino real; `simulado` = prueba |
| `PUERTO_SERIAL`     | `COM3`                              | Puerto del Arduino (`COM7` en la instalación real) |

El gateway es un solo archivo sin su propio `pyproject.toml`, así que sus
dependencias (`requests` y `pyserial`) se piden en la línea con `uv --with`.

Modo real (con el Arduino conectado por USB):

```bash
MODO=serial PUERTO_SERIAL=COM7 SERVIDOR_URL=http://18.189.203.243:5000/api/lecturas \
  uv run --with requests --with pyserial gateway/gateway.py
```

`MODO=simulado` existe para ensayar la ruta de red sin hardware. Nunca genera
evidencia: el dispositivo viaja etiquetado como `rack-01-simulado` y así se distingue
de las lecturas reales.

## Configuración del servidor

| Variable      | Default                                      | Descripción                                  |
| ------------- | -------------------------------------------- | -------------------------------------------- |
| `DATABASE_URL` | *(sin valor: SQLite)*                       | URL de PostgreSQL para guardar las lecturas  |

`app.py` atiende el puerto 5000 en `0.0.0.0` (desarrollo y gunicorn); no hay variable
para cambiarlo. El CSV (`lecturas.csv`) se escribe igual con SQLite o con PostgreSQL;
su header es `fecha,dispositivo,temperatura,humedad,estado` y nunca contiene filas a
medias (la lectura del archivo y la escritura comparten el mismo candado).

## API

Base: `http://18.189.203.243:5000` (en local, `http://localhost:5000`).

### `POST /api/lecturas`

```json
{ "dispositivo": "rack-01", "temperatura": 24.0, "humedad": 50.0 }
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
- El gateway corre en un portátil Windows: si se apaga, dejan de llegar lecturas
  nuevas (el sistema no inventa datos para tapar el hueco).
- Una sola EC2 sin balanceador: con ese tamaño es suficiente y más simple.

## Reglas del equipo

Las reglas de trabajo están en [`AGENTS.md`](AGENTS.md) y los principios en
[`CONSTITUTION.md`](CONSTITUTION.md).
