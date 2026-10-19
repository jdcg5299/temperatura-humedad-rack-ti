# Constitución: monitoreo de temperatura y humedad en un rack de TI

## Propósito
Medir temperatura y humedad reales dentro de un rack de TI con una Raspberry Pi 3 y un sensor DHT11, enviarlas a un servidor web en Ubuntu (máquina virtual local) y guardarlas en un archivo CSV y en una base de datos.

## Principios
1. **Datos reales.** Nunca se inventan ni se simulan lecturas. Si existe un modo de simulación, debe ser explícito, estar apagado por defecto y no usarse en la evidencia.
2. **Cada cosa en su lugar.** El cliente (lectura del sensor) corre solo en la Raspberry Pi. El servidor corre solo en la máquina virtual Ubuntu local (Vagrant + VirtualBox). El código se edita en el computador.
3. **Doble almacenamiento obligatorio.** Cada lectura válida se guarda en el CSV y en la base de datos.
4. **Validar siempre.** El servidor rechaza datos incompletos, no numéricos o fuera del rango físico posible.
5. **Fallar sin caerse.** El DHT11 falla a veces: el cliente captura el error, espera y reintenta. Lo mismo con los errores de red.
6. **Sin IPs ni secretos en el código.** La URL del servidor y otros ajustes se leen de variables de entorno.
7. **Reproducible.** Las dependencias se gestionan con uv; `pyproject.toml` y `uv.lock` van en git.
8. **Simple primero.** Flask + SQLite + CSV. No se agregan frameworks ni servicios sin necesidad.
9. **Entendible.** El equipo debe poder explicar cada línea. Los comentarios explican el porqué, no solo el qué.
10. **Evidencia.** Cada prueba importante deja rastro: salida de consola, filas del CSV, consultas a la base de datos.

## Parámetros del caso de uso
- Rango normal: 18–27 °C y 40–60 % de humedad relativa. Fuera de ese rango, el estado es ALERTA.
- Sensor DHT11: precisión aproximada de ±2 °C y ±5 % de humedad; máximo una lectura por segundo. Intervalo de envío: 10 s.
- El servidor escucha en todas las interfaces (`0.0.0.0`), puerto 5000, para que la Raspberry Pi lo alcance desde la red local.

## Gobernanza
Si un AGENTS.md contradice esta constitución, gana la constitución. Los cambios a la constitución se hacen a mano y con commit propio.
