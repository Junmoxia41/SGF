# Requisitos Python - SGF

## Instalacion rapida

```bash
pip install -r requirements-python.txt
```

## Dependencias reales del proyecto

### Incluidas en Python (no se instalan por pip)
El archivo `launcher/sgf-launcher.py` usa solo modulos de la libreria estandar:

- `os`
- `sys`
- `subprocess`
- `threading`
- `time`
- `socket`
- `shutil`
- `webbrowser`
- `tkinter`
- `pathlib`
- `datetime`

## Dependencias instalables con pip

### Obligatoria solo si quieres compilar el .exe
- `pyinstaller`

## Notas importantes

### 1. Para ejecutar el launcher `.py`
Si solo quieres abrir el panel con:

```bash
python launcher/sgf-launcher.py
```

normalmente **no necesitas instalar nada por pip**, siempre que Python tenga `tkinter`.

### 2. Si `tkinter` no existe
En Windows:
- reinstala Python y asegúrate de incluir **Tcl/Tk and IDLE**

En Linux:

```bash
sudo apt install python3-tk
```

### 3. Para generar `sgf-panel.exe`
Sí necesitas:

```bash
pip install pyinstaller
```

Luego puedes usar:

```bash
build-exe.bat
```

## Archivo recomendado para pip
Queda en:

- `requirements-python.txt`

Ese es el archivo que debes usar para instalar dependencias Python del proyecto.
