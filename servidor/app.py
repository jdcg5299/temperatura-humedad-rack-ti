"""Servidor Flask del monitoreo de temperatura y humedad del rack de TI.

Recibe las lecturas que envía la Raspberry Pi por HTTP POST y las guarda
en SQLite (datos.db) y en CSV (lecturas.csv). También sirve el dashboard
construido en servidor/static/ (si existe).
"""

from datetime import datetime
from pathlib import Path

from flask import Flask, Response, jsonify, request, send_from_directory

import almacenamiento
import validacion

app = Flask(__name__)

# Crea la tabla en SQLite una sola vez, al arrancar.
almacenamiento.inicializar()

# El dashboard se construye con `npm run build` (en dashboard/) y el
# resultado cae aquí: es contenido servido, no código fuente editado.
RUTA_STATIC = Path(__file__).with_name("static")


@app.get("/")
def dashboard():
    """Sirve el dashboard si ya se construyó; si no, avisa cómo construirlo."""
    if not (RUTA_STATIC / "index.html").exists():
        return jsonify(
            error="dashboard no construido: ejecute npm run build dentro de dashboard/"
        ), 404
    return send_from_directory(RUTA_STATIC, "index.html")


@app.post("/api/lecturas")
def recibir_lectura():
    # silent=True: si el cuerpo no es JSON, devuelve None en vez de reventar.
    datos = request.get_json(silent=True)
    if datos is None:
        return (
            jsonify(error="el cuerpo debe ser JSON valido"),
            400,
        )

    lectura, error = validacion.validar(datos)
    if lectura is None:
        return jsonify(error=error), 400

    # La fecha la pone el servidor: la Pi no tiene reloj de respaldo
    # y su hora puede estar desincronizada.
    fecha = datetime.now().isoformat(timespec="seconds")
    estado = validacion.calcular_estado(lectura["temperatura"], lectura["humedad"])
    id_ = almacenamiento.guardar(lectura, fecha, estado)

    return jsonify(id=id_, estado=estado, fecha=fecha), 201


@app.get("/api/lecturas")
def listar_lecturas():
    texto = request.args.get("limit", "20")
    try:
        limite = int(texto)
    except ValueError:
        return jsonify(error="limit debe ser un numero entero"), 400
    if limite < 1:
        return jsonify(error="limit debe ser mayor o igual a 1"), 400

    # desde: opcional. Fecha ISO en hora local del servidor (como se
    # guardan). El dashboard lo usa para pedir solo su ventana de tiempo.
    desde_crudo = request.args.get("desde")
    desde = None
    if desde_crudo is not None:
        desde = _normalizar_desde(desde_crudo)
        if desde is None:
            return (
                jsonify(
                    error="desde debe ser una fecha ISO valida, ej: 2026-10-19T19:00:00"
                ),
                400,
            )

    lecturas = almacenamiento.obtener_ultimas(limite, desde)
    return jsonify(total=len(lecturas), lecturas=lecturas), 200


def _normalizar_desde(texto: str) -> str | None:
    """Convierte el texto a fecha ISO local; None si el formato no sirve."""
    try:
        fecha = datetime.fromisoformat(texto)
    except ValueError:
        return None
    # Si viene con zona horaria se pasa a la hora local del servidor,
    # que es como se guardan las fechas (isoformat sin zona).
    if fecha.tzinfo is not None:
        fecha = fecha.astimezone().replace(tzinfo=None)
    return fecha.isoformat(timespec="seconds")


@app.get("/api/lecturas/csv")
def descargar_csv():
    """Descarga el CSV completo de lecturas.

    El CSV es todo el histórico (no depende de la ventana que elija el
    dashboard). Se lee con el lock de escritura, para no entregar una
    fila a medias.
    """
    try:
        contenido = almacenamiento.leer_csv()
    except FileNotFoundError:
        return (
            jsonify(error="aun no existe el archivo lecturas.csv: no hay lecturas"),
            404,
        )
    return Response(
        contenido,
        # content_type (no mimetype) para que la cabecera sea exactamente
        # "text/csv", sin agregarle charset.
        content_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=lecturas.csv"},
    )


if __name__ == "__main__":
    # 0.0.0.0 en vez de 127.0.0.1: solo asi la Pi y el computador pueden
    # alcanzar el servidor por la red (la VM esta en modo puente).
    # threaded=True: atiende peticiones en paralelo (ahí el lock del CSV importa).
    app.run(host="0.0.0.0", port=5000, threaded=True)
