"""Servidor Flask del monitoreo de temperatura y humedad del rack de TI.

Recibe las lecturas que envía la Raspberry Pi por HTTP POST y las guarda
en SQLite (datos.db) y en CSV (lecturas.csv).
"""

from datetime import datetime

from flask import Flask, jsonify, request

import almacenamiento
import validacion

app = Flask(__name__)

# Crea la tabla en SQLite una sola vez, al arrancar.
almacenamiento.inicializar()


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

    lecturas = almacenamiento.obtener_ultimas(limite)
    return jsonify(total=len(lecturas), lecturas=lecturas), 200


if __name__ == "__main__":
    # 0.0.0.0 en vez de 127.0.0.1: solo asi la Pi y el computador pueden
    # alcanzar el servidor por la red (la VM esta en modo puente).
    # threaded=True: atiende peticiones en paralelo (ahí el lock del CSV importa).
    app.run(host="0.0.0.0", port=5000, threaded=True)
