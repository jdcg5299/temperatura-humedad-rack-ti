"""Cliente IoT: lee el sensor DHT11 de la Raspberry Pi y envía la lectura al servidor.

Corre SOLO en la Raspberry Pi (necesita GPIO). En el computador solo se puede
probar con MODO=simulado: una lectura falsa etiquetada que existe únicamente
para verificar la ruta de red antes de tener la Pi encendida.
"""

import os
import time

import requests

# Todo ajuste viene de variables de entorno: la IP del servidor nunca vive en
# el código (CONSTITUTION.md, principio 6).
SERVIDOR_URL = os.environ.get("SERVIDOR_URL", "http://127.0.0.1:5000/api/lecturas")
DISPOSITIVO = os.environ.get("DISPOSITIVO", "rack-01")
MODO = os.environ.get("MODO", "sensor")  # "sensor" (real) o "simulado" (solo pruebas de red)

try:
    INTERVALO_SEGUNDOS = float(os.environ.get("INTERVALO_SEGUNDOS", "10"))
except ValueError:
    raise SystemExit("INTERVALO_SEGUNDOS debe ser un numero, por ejemplo 10")
if INTERVALO_SEGUNDOS < 1:
    raise SystemExit("INTERVALO_SEGUNDOS debe ser 1 o mas: el DHT11 no aguanta mas de una lectura por segundo")

if MODO not in ("sensor", "simulado"):
    raise SystemExit(f'MODO debe ser "sensor" o "simulado", no "{MODO}"')


def crear_sensor():
    # Los imports del hardware van dentro de la funcion: solo existen en la
    # Pi. En el computador "board" no funciona y el modo simulado no lo usa.
    import adafruit_dht
    import board

    # board.D4 = GPIO4 (pin fisico 7), donde esta cableado el DHT11.
    # use_pulseio=False: en la Raspberry Pi, Blinka mide el DHT11 con
    # bit-banging porque pulseio no esta soportado (guia de Adafruit).
    return adafruit_dht.DHT11(board.D4, use_pulseio=False)


def leer_sensor(dht):
    """Devuelve la lectura como dict, o None si el sensor fallo (es normal)."""
    try:
        temperatura = dht.temperature
        humedad = dht.humidity
    except RuntimeError as error:
        # El DHT11 falla algunas veces al medir: no es un error del programa.
        # Se captura y se reintenta en el proximo ciclo (principio 5: fallar
        # sin caerse).
        print(f"[aviso] lectura fallida del DHT11, se reintenta: {error}")
        return None

    # A veces el sensor responde sin datos en vez de lanzar error.
    if temperatura is None or humedad is None:
        return None

    return {
        "dispositivo": DISPOSITIVO,
        "temperatura": temperatura,
        "humedad": humedad,
    }


def leer_simulado():
    """Lectura falsa SOLO para probar la red; nunca vale como evidencia.

    El dispositivo queda etiquetado "-simulado" para que se note en el CSV y
    en la base de datos (CONSTITUTION.md, principio 1: datos reales).
    """
    return {
        "dispositivo": f"{DISPOSITIVO}-simulado",
        "temperatura": 24.0,
        "humedad": 50.0,
    }


def enviar(lectura):
    """POST de la lectura al servidor. Nunca lanza: el bucle sigue aunque falle."""
    try:
        respuesta = requests.post(SERVIDOR_URL, json=lectura, timeout=5)
    except requests.RequestException as error:
        # Sin red o con el servidor caido: se imprime y se reintenta despues.
        print(f"[error] no se pudo enviar al servidor: {error}")
        return

    # 201 = guardada; 400 = rechazada (el cuerpo explica el motivo).
    print(f"[respuesta] HTTP {respuesta.status_code} -> {respuesta.text}")


def main():
    dht = None
    if MODO == "sensor":
        dht = crear_sensor()

    print(f"Modo: {MODO} | Servidor: {SERVIDOR_URL} | Dispositivo: {DISPOSITIVO} | Intervalo: {INTERVALO_SEGUNDOS}s")

    try:
        while True:
            lectura = leer_simulado() if MODO == "simulado" else leer_sensor(dht)
            if lectura is not None:
                enviar(lectura)
            time.sleep(INTERVALO_SEGUNDOS)
    except KeyboardInterrupt:
        print("\nDetenido por el usuario (Ctrl+C).")
    finally:
        # dht.exit() libera el hilo que el DHT11 usa para medir; sin esto el
        # proceso puede quedar colgado al salir.
        if dht is not None:
            dht.exit()
            print("Sensor DHT11 liberado.")


if __name__ == "__main__":
    main()
