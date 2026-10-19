"""Gateway: toma lecturas (del Arduino por serial, o simuladas) y las envia al servidor."""
import json
import os
import random
import time

import requests

SERVIDOR_URL = os.environ.get("SERVIDOR_URL", "http://localhost:5000/api/lecturas")
DISPOSITIVO = os.environ.get("DISPOSITIVO", "rack-01")
INTERVALO = float(os.environ.get("INTERVALO_SEGUNDOS", "5"))
MODO = os.environ.get("MODO", "simulado")  # simulado | serial
PUERTO = os.environ.get("PUERTO_SERIAL", "COM3")


def lecturas_simuladas():
    """Inventa temperatura y humedad. Solo para probar sin hardware."""
    while True:
        yield round(random.uniform(20, 32), 1), round(random.uniform(35, 75), 1)
        time.sleep(INTERVALO)


def lecturas_serial():
    """Lee las lineas JSON que imprime el Arduino, ej: {"t":24.5,"h":52.0}"""
    import serial  # solo se necesita en modo serial

    with serial.Serial(PUERTO, 9600, timeout=2) as puerto:
        while True:
            linea = puerto.readline().decode(errors="ignore").strip()
            if not linea.startswith("{"):
                continue  # ignora ruido o lineas incompletas
            try:
                datos = json.loads(linea)
                yield float(datos["t"]), float(datos["h"])
            except (ValueError, KeyError):
                print(f"Linea invalida del Arduino: {linea}")


def enviar(dispositivo, temperatura, humedad):
    """POST al servidor. Si falla, avisa y sigue: el gateway no se cae."""
    try:
        r = requests.post(
            SERVIDOR_URL,
            json={"dispositivo": dispositivo, "temperatura": temperatura, "humedad": humedad},
            timeout=5,
        )
        print(f"{dispositivo} T={temperatura} H={humedad} -> {r.status_code} {r.text.strip()}")
    except requests.RequestException as e:
        print(f"No se pudo enviar ({e}). Reintento en la proxima lectura.")


def main():
    if MODO == "simulado":
        dispositivo, fuente = f"{DISPOSITIVO}-simulado", lecturas_simuladas()
    else:
        dispositivo, fuente = DISPOSITIVO, lecturas_serial()
    print(f"Gateway en modo {MODO} -> {SERVIDOR_URL} como '{dispositivo}'")
    for t, h in fuente:
        enviar(dispositivo, t, h)


if __name__ == "__main__":
    main()
