# Guía de replicación: monitoreo de temperatura y humedad en un rack de TI

Esta guía lleva a otro compañero, paso a paso y desde cero, a tener el sistema
completo funcionando: la Raspberry Pi midiendo con el DHT11, el servidor
guardando en la VM, y la evidencia visible en el computador.

---

## 1. Qué necesitas

### En el computador (Windows, macOS o Linux)

| Requisito | Para qué | Instalación |
|---|---|---|
| [Git](https://git-scm.com/downloads) | Clonar el repositorio | `git --version` para verificar |
| [VirtualBox](https://www.virtualbox.org/wiki/Downloads) | Correr la VM Ubuntu | Instalador oficial |
| [Vagrant](https://developer.hashicorp.com/vagrant/downloads) | Levantar la VM con el `Vagrantfile` | Instalador oficial |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | Dependencias de Python | `curl -LsSf https://astral.sh/uv/install.sh \| sh` (Linux/macOS) o el instalador de Windows |
| [GitHub CLI (gh)](https://cli.github.com/) | Acceso al repositorio privado | `gh auth login` después de instalar |

> Solo sirve **PowerShell** en Windows (no la terminal "Símbolo del sistema"):
> varios comandos de esta guía usan detalles propios de PowerShell.

### Hardware

- Raspberry Pi 3 (con Raspberry Pi OS) + tarjeta SD + alimentación.
- Sensor DHT11 (temperatura ±2 °C, humedad ±5 %; máximo 1 lectura/segundo).
- Cables macho-hembra para el cableado.

---

## 2. Clonar el repositorio (computador)

```powershell
cd C:\Users\TU_USUARIO\Desktop
git clone https://github.com/jdcg5299/temperatura-humedad-rack-ti.git
cd temperatura-humedad-rack-ti
```

El repositorio es **privado**: si `git clone` pide credenciales, entra con tu
cuenta de GitHub (o pide al dueño del repo que te invite como colaborador).

---

## 3. Levantar la VM (computador)

```powershell
vagrant up
```

- **Atención**: Vagrant preguntará `Which interface should the network bridge
  to?` — presiona **Enter** para aceptar la opción por defecto. Eso hace que la
  VM tome una IP de tu red local (modo puente), que es la que usará la Pi.
- La primera vez tarda varios minutos (descarga la caja Ubuntu).

Verifica la IP de la VM:

```powershell
vagrant ssh -c "hostname -I"
```

Anotarás algo como `10.0.2.15 192.168.1.44 ...` — la que te interesa es la de
tu red local (ej: `192.168.1.44`). **Esta IP puede cambiar** si reinicias la
red; siempre revísala con ese comando. A partir de aquí se usa `IP_VM`.

---

## 4. Arrancar el servidor (VM)

```powershell
vagrant ssh
cd /vagrant/servidor
uv sync        # solo la primera vez
uv run app.py
```

Debes ver:

```
* Running on all addresses (0.0.0.0)
* Running on http://127.0.0.1:5000
```

Déjalo corriendo en esa terminal. `0.0.0.0` significa que acepta conexiones
desde la red local (la Pi), no solo desde la propia VM. Para detenerlo:
`Ctrl+C`.

---

## 5. Probar el servidor (computador, otra terminal)

Abre una **segunda** terminal PowerShell (sin cerrar la de la VM) y ejecuta:

```powershell
$IP = "http://IP_VM:5000"   # reemplazar IP_VM, ej: http://192.168.1.44:5000
```

> En Windows hay que usar `curl.exe` (el `curl` de PowerShell es otro comando)
> y hay que escapar las comillas del JSON con `\"`, si no, PowerShell se las
> come y el servidor responde `400 el cuerpo debe ser JSON valido`.

```powershell
# Lectura normal (esperar 201 y "estado":"NORMAL")
curl.exe -i -s -X POST "$IP/api/lecturas" -H "Content-Type: application/json" -d '{\"dispositivo\":\"rack-01\",\"temperatura\":24,\"humedad\":50}'

# Lectura fuera de rango (esperar 201 y "estado":"ALERTA")
curl.exe -i -s -X POST "$IP/api/lecturas" -H "Content-Type: application/json" -d '{\"dispositivo\":\"rack-01\",\"temperatura\":32,\"humedad\":70}'

# Datos incompletos (esperar 400)
curl.exe -i -s -X POST "$IP/api/lecturas" -H "Content-Type: application/json" -d '{\"dispositivo\":\"rack-01\",\"temperatura\":24}'

# Consultar las últimas lecturas (esperar 200)
curl.exe -s "$IP/api/lecturas?limit=2"
```

### Ver la evidencia (computador)

```powershell
notepad servidor\lecturas.csv     # debe tener encabezado + filas
cd servidor
uv run python -c "import sqlite3; print(sqlite3.connect('datos.db').execute('SELECT * FROM lecturas').fetchall())"
```

Cada lectura válida aparece **en los dos lugares**: CSV y base de datos.

---

## 6. Cablear el DHT11 a la Raspberry Pi

Desconecta la Pi antes de cablear.

| Pin del DHT11 | Pin de la Raspberry Pi |
|---|---|
| VCC (o `+`) | 3,3 V — **pin físico 1** |
| DATA (o `S`/`OUT`) | GPIO4 — **pin físico 7** |
| GND (o `-`) | GND — **pin físico 6** |

Notas:

- Si usas un **módulo de 3 pines** (el más común), ese es todo el cableado; los
  módulos ya traen la resistencia de pull-up.
- Si usas el sensor suelto de 4 pines, el pin 3 (NC) no se conecta y hace falta
  una resistencia de 4,7 kΩ entre VCC y DATA.
- El DHT11 se alimenta a **3,3 V**, nunca a 5 V.

---

## 7. Poner el cliente en la Raspberry Pi

### 7.1 Copiar el código desde el computador

En la Pi ejecuta `hostname -I` para saber su IP (`IP_PI`). Luego, desde el
computador:

```powershell
scp -r cliente-pi pi@IP_PI:/home/pi/
```

(También puedes clonar el repo dentro de la Pi si prefieres.)

### 7.2 Preparar la Pi

```bash
# Instalar uv (solo la primera vez)
curl -LsSf https://astral.sh/uv/install.sh | sh
exec $SHELL

# Dependencias del cliente
cd ~/cliente-pi
uv sync

# Archivo de configuración con la IP REAL de la VM (no va al repositorio)
cp rack.env.example rack.env
nano rack.env    # cambiar IP_DE_LA_VM por la IP anotada en el paso 3
```

### 7.3 Prueba manual (con el servidor de la VM corriendo)

```bash
SERVIDOR_URL=http://IP_VM:5000/api/lecturas DISPOSITIVO=rack-01 uv run enviar.py
```

Salida esperada cada 10 segundos:

```
Modo: sensor | Servidor: http://IP_VM:5000/api/lecturas | Dispositivo: rack-01 | Intervalo: 10.0s
[respuesta] HTTP 201 -> {"estado":"NORMAL","fecha":"...","id":1}
```

Con `Ctrl+C` se detiene y libera el sensor. Si el sensor falla verás
`[aviso] lectura fallida del DHT11, se reintenta: ...` — es normal, el DHT11
falla algunas veces y el programa reintenta solo.

Verifica la evidencia otra vez en el computador (paso 5): debe aparecer una
fila con `rack-01` de la hora real.

### 7.4 Arranque automático con systemd

```bash
cd ~/cliente-pi
sudo cp rack.service /etc/systemd/system/rack.service
sudo systemctl daemon-reload
sudo systemctl enable --now rack
```

```bash
systemctl status rack          # estado: active (running)
journalctl -u rack -f          # logs en vivo (Ctrl+C para salir)
```

A partir de ahí, cada vez que la Pi arranque, el cliente empieza a medir y
enviar solo.

---

## 8. Verificación final (todo junto)

1. VM encendida con el servidor (`vagrant ssh` → `cd /vagrant/servidor` → `uv run app.py`).
2. Pi encendida con el servicio (`systemctl status rack` → `active`).
3. En el computador: `servidor\lecturas.csv` crece con una fila nueva cada 10 s.
4. `curl.exe -s "http://IP_VM:5000/api/lecturas?limit=5"` muestra las últimas.

---

## 9. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `vagrant up` se queda preguntando por la interfaz | Prompt de puente | Presionar **Enter** (acepta la opción por defecto) |
| `Vagrant must be running...` | VM apagada | `vagrant up` |
| `another process is already executing an action` | Vagrant quedó colgado de un intento anterior | Cerrar procesos `ruby`/`vagrant` en el Administrador de tareas y repetir |
| `curl` responde `400 el cuerpo debe ser JSON valido` | PowerShell se comió las comillas | Usar `\"` dentro del JSON (ver paso 5) y `curl.exe`, no `curl` |
| `curl: (28) timeout` | La VM está apagada o cambió la IP | Levantar la VM y volver a mirar `hostname -I` |
| El cliente no conecta desde la Pi | La IP de la VM cambió o el servidor está caído | Actualizar `SERVIDOR_URL` en `rack.env` y revisar `uv run app.py` |
| La Pi dice `Permission denied` al importar el sensor | Permisos de GPIO | `sudo usermod -aG gpio $USER`, cerrar y volver a entrar; o correr una vez con `sudo` para confirmar |
| `ImportError` relacionado con `lgpio`/`RPi.GPIO` | Dependencia de Blinka en tu versión de Raspberry Pi OS | Avisar al dueño del repo: se agrega con `uv add` lo que falte |
| `Failed to open environment file` en `systemctl status rack` | Falta `rack.env` | Repetir el paso 7.2 (`cp rack.env.example rack.env` y editar) |
| Filas `-simulado` en el CSV | Prueba del modo simulado | No son evidencia real; se pueden borrar sin problema |

---

## 10. Reglas del proyecto (resumen)

1. Los datos de evidencia **nunca se inventan**: solo lecturas reales del DHT11
   (el modo simulado existe para probar la red y queda etiquetado como tal).
2. El cliente corre **solo en la Pi**; el servidor, **solo en la VM**; el código
   se edita en el computador.
3. Toda lectura válida se guarda **en CSV y en la base de datos**.
4. La IP del servidor vive en variables de entorno (`rack.env`), no en el código.
5. Dependencias siempre con **uv** (`uv sync`), nunca con `pip`.

Ver `CONSTITUTION.md` y `AGENTS.md` para la versión completa.
