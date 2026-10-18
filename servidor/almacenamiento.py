"""Doble almacenamiento obligatorio: SQLite + CSV (principio 3 de la constitución).

- datos.db: para consultar el histórico (lo usa el GET).
- lecturas.csv: evidencia fácil de abrir y mostrar.

Las dos escrituras comparten un lock porque el CSV no se protege solo:
dos peticiones simultáneas podrían intercalar medio renglón y corromperlo.
"""

import csv
import sqlite3
import threading
from pathlib import Path

# Los archivos viven al lado de este código (en la VM: /vagrant/servidor/).
RUTA_DB = Path(__file__).with_name("datos.db")
RUTA_CSV = Path(__file__).with_name("lecturas.csv")

ENCABEZADOS_CSV = ("fecha", "dispositivo", "temperatura", "humedad", "estado")

_lock = threading.Lock()


def inicializar() -> None:
    """Crea la tabla si no existe. Se llama una vez al arrancar el servidor."""
    con = sqlite3.connect(RUTA_DB)
    try:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS lecturas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                dispositivo TEXT NOT NULL,
                temperatura REAL NOT NULL,
                humedad REAL NOT NULL,
                fecha TEXT NOT NULL,
                estado TEXT NOT NULL
            )
            """
        )
        con.commit()
    finally:
        con.close()


def guardar(lectura: dict, fecha: str, estado: str) -> int:
    """Guarda la lectura en SQLite y en el CSV. Devuelve el id de SQLite."""
    with _lock:
        id_ = _insertar_sqlite(lectura, fecha, estado)
        _insertar_csv(lectura, fecha, estado)
    return id_


def obtener_ultimas(limite: int) -> list[dict]:
    """Las últimas lecturas, de la más reciente a la más vieja."""
    con = sqlite3.connect(RUTA_DB)
    try:
        con.row_factory = sqlite3.Row
        filas = con.execute(
            """
            SELECT id, dispositivo, temperatura, humedad, fecha, estado
            FROM lecturas
            ORDER BY id DESC
            LIMIT ?
            """,
            (limite,),
        ).fetchall()
        return [dict(fila) for fila in filas]
    finally:
        con.close()


def _insertar_sqlite(lectura: dict, fecha: str, estado: str) -> int:
    con = sqlite3.connect(RUTA_DB)
    try:
        cursor = con.execute(
            """
            INSERT INTO lecturas (dispositivo, temperatura, humedad, fecha, estado)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                lectura["dispositivo"],
                lectura["temperatura"],
                lectura["humedad"],
                fecha,
                estado,
            ),
        )
        con.commit()
        return cursor.lastrowid
    finally:
        con.close()


def _insertar_csv(lectura: dict, fecha: str, estado: str) -> None:
    # Se añade el encabezado solo la primera vez (archivo nuevo o vacío).
    vacio = not RUTA_CSV.exists() or RUTA_CSV.stat().st_size == 0
    # newline="" es lo que pide el módulo csv para no duplicar saltos de línea.
    with RUTA_CSV.open("a", newline="", encoding="utf-8") as archivo:
        escritor = csv.writer(archivo)
        if vacio:
            escritor.writerow(ENCABEZADOS_CSV)
        escritor.writerow(
            (
                fecha,
                lectura["dispositivo"],
                lectura["temperatura"],
                lectura["humedad"],
                estado,
            )
        )
