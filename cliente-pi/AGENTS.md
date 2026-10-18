# AGENTS.md (cliente-pi)

Aplica además del AGENTS.md de la raíz y de CONSTITUTION.md.

## Hardware
- Raspberry Pi 3, sensor DHT11 en GPIO4 (pin físico 7), alimentado a 3,3 V.
- Librería: `adafruit-circuitpython-dht`, con `adafruit_dht.DHT11(board.D4)`.

## Reglas
- Este código solo se prueba en la Pi. En el computador no hay GPIO.
- Intervalo de envío configurable, por defecto 10 s (el DHT11 permite como máximo una lectura por segundo).
- Captura `RuntimeError` (lecturas fallidas normales del DHT) y `requests.RequestException` (red). El bucle nunca debe morir.
- Ignora lecturas `None`.
- Lee `SERVIDOR_URL` y `DISPOSITIVO` desde variables de entorno, con valores por defecto claros.
- Al terminar, libera el sensor con `dht.exit()`.
- Envía JSON con `dispositivo`, `temperatura` y `humedad`. La fecha la pone el servidor.
- Para arrancar con la Pi se usa un servicio systemd.
