"""Validación de lecturas entrantes y cálculo del estado.

El servidor no confía en lo que llega por la red: cualquier dato incompleto,
no numérico o físicamente imposible se rechaza con 400 antes de guardarlo.
"""

import math

# Umbrales del caso de uso (CONSTITUTION.md).
# Para cambiar qué es NORMAL/ALERTA basta con editar estas cuatro líneas.
TEMP_MIN_NORMAL = 18.0
TEMP_MAX_NORMAL = 27.0
HUM_MIN_NORMAL = 40.0
HUM_MAX_NORMAL = 60.0

# Rango físico del sensor DHT11: por debajo/encima el dato es basura
# (un termómetro real no marca -50 °C ni 900 °C dentro de un rack).
TEMP_MIN_FISICO = 0.0
TEMP_MAX_FISICO = 50.0
HUM_MIN_FISICO = 0.0
HUM_MAX_FISICO = 100.0

CAMPOS_REQUERIDOS = ("dispositivo", "temperatura", "humedad")


def calcular_estado(temperatura: float, humedad: float) -> str:
    """NORMAL si ambos valores están dentro de los umbrales; si no, ALERTA."""
    dentro = (
        TEMP_MIN_NORMAL <= temperatura <= TEMP_MAX_NORMAL
        and HUM_MIN_NORMAL <= humedad <= HUM_MAX_NORMAL
    )
    return "NORMAL" if dentro else "ALERTA"


def _es_numero(valor) -> bool:
    # En Python bool es subclase de int (True == 1), y un true de JSON
    # no es una lectura: por eso se descarta antes de aceptar el número.
    if isinstance(valor, bool):
        return False
    return isinstance(valor, (int, float)) and math.isfinite(valor)


def validar(datos) -> tuple[dict | None, str | None]:
    """Devuelve (lectura_limpia, None) si es válida; (None, error) si no."""
    if not isinstance(datos, dict):
        return None, "el cuerpo debe ser un objeto JSON"

    faltantes = [campo for campo in CAMPOS_REQUERIDOS if campo not in datos]
    if faltantes:
        return None, f"faltan campos: {', '.join(faltantes)}"

    dispositivo = datos["dispositivo"]
    if not isinstance(dispositivo, str) or not dispositivo.strip():
        return None, "dispositivo debe ser un texto no vacío"

    for campo in ("temperatura", "humedad"):
        if not _es_numero(datos[campo]):
            return None, f"{campo} debe ser un número"

    temperatura = float(datos["temperatura"])
    humedad = float(datos["humedad"])

    if not TEMP_MIN_FISICO <= temperatura <= TEMP_MAX_FISICO:
        return None, (
            f"temperatura fuera del rango fisico "
            f"{TEMP_MIN_FISICO}-{TEMP_MAX_FISICO} C"
        )
    if not HUM_MIN_FISICO <= humedad <= HUM_MAX_FISICO:
        return None, (
            f"humedad fuera del rango fisico "
            f"{HUM_MIN_FISICO}-{HUM_MAX_FISICO} %"
        )

    lectura = {
        "dispositivo": dispositivo.strip(),
        "temperatura": temperatura,
        "humedad": humedad,
    }
    return lectura, None
