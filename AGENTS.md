# AGENTS.md

Lee primero CONSTITUTION.md. Esa constitución manda.

## Qué es este proyecto
Sistema IoT académico: Raspberry Pi 3 + sensor DHT11 -> HTTP POST (JSON) -> servidor Flask en una VM Ubuntu local -> CSV + SQLite. Caso de uso: monitoreo de temperatura y humedad en un rack de TI.

## Estructura
- `servidor/`: aplicación Flask (corre en la VM Ubuntu)
- `cliente-pi/`: script que lee el DHT11 y envía los datos (corre SOLO en la Raspberry Pi)
- `docs/`: capturas, notas y evidencia
- `Vagrantfile`: define la VM Ubuntu (red en modo puente)

## Dónde corre cada cosa
- Computador: se edita el código; se usan git, uv, OpenCode y Vagrant.
- VM Ubuntu: la carpeta del proyecto aparece en `/vagrant`. El servidor se ejecuta con `cd /vagrant/servidor && uv run app.py`.
- Raspberry Pi: `cd ~/cliente-pi && uv run enviar.py`

## Comandos
- Instalar dependencias: `uv sync` (dentro de cada carpeta)
- Agregar una dependencia: `uv add <paquete>` (nunca pip)
- Levantar la VM: `vagrant up`; entrar: `vagrant ssh`
- Probar el API desde el computador: `curl -X POST http://IP_VM:5000/api/lecturas -H "Content-Type: application/json" -d '{"dispositivo":"prueba","temperatura":24,"humedad":50}'`

## Reglas de trabajo
- Responde en español. Explica el porqué de cada cambio en lenguaje sencillo: la persona es principiante en IoT.
- Primero propón un plan y espera confirmación antes de editar varios archivos.
- Cambios pequeños: un archivo o una función a la vez.
- No ejecutes el cliente en el computador: no hay sensor ni GPIO. El servidor sí se puede probar con curl.
- No inventes lecturas ni datos de ejemplo en el CSV o la base de datos reales.
- Al terminar una tarea, indica qué debe probarse y en qué equipo (computador, VM o Pi).

## Estilo
Python 3.11 o superior, funciones cortas, manejo de errores explícito, comentarios sobre el porqué.
