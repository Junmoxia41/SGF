# Análisis del repositorio SGF

## Resumen ejecutivo

- **Nombre:** SGF v4.0 — Sistema de Gestión de Facturas ETECSA
- **Stack:** Node.js/TypeScript (backend) + React/TypeScript/Vite (frontend) + Python/Tk (launcher) + Oracle 19c (BD objetivo, con fallback SQLite)
- **Repo:** `https://github.com/Junmoxia41/SGF` (rama `main`, 2 commits)
- **Rama local:** `main`, working tree limpio
- **API key configurada:** ya quedó guardada en `git remote -v` tras el `git clone`, así que puedo hacer `git push` cuando terminemos los cambios

## Qué hace la aplicación

Es un sistema para que operadores procesen facturas telefónicas de ETECSA (PDFs de líneas corporativas):

1. **Login centralizado** (JWT + sesión en BD), usuario por defecto `yolexis` / `123`
2. **Procesar factura** (`ProcesarTab`): sube un PDF, lo extrae con `pdfjs-dist`, lo parsea con el motor `parseFacturaEtcsa` (cuerpo, cliente, número, código de pago, lista de servicios línea por línea) y la guarda en BD
3. **Historial** (`HistorialTab`): lista paginada con búsqueda y filtros por estado
4. **Servicios** (`ServiciosTab`): búsqueda cruzada por número de servicio
5. **Cola de revisión** (`RevisionQueueTab`): facturas marcadas como dudosas (confianza < 70 % o con errores del parser)
6. **Estadísticas** (`EstadisticasTab`): totales, procesados/pendientes/errores
7. **Usuarios** (`UsuariosTab`, solo admin): CRUD de usuarios
8. **Logs** (`LogsTab`, solo admin): auditoría
9. **Configuración de BD** (`DbConfigPanel`): cambiar host/puerto/service de Oracle en caliente

Como efecto colateral de crear/editar una factura, también sincroniza un registro en `PCELULAR.CARGARARCH` (tabla legacy del sistema principal de ETECSA).

## Arquitectura

```
Cliente (React + Vite, en navegador)
  ↓ HTTP/JSON (Bearer JWT)
Servidor Node (http nativo, 0.0.0.0:3000)
  ├── Sirve client/dist/ como estáticos (SPA fallback)
  ├── REST /api/* (auth, users, facturas, services, logs, dbconfig, upload)
  └── Pool de Oracle (oracledb) → si falla, cae a SQLite (sql.js) local
        ↓
      Oracle "PCELULAR" (host 25:1521)
```

El servidor también compila el frontend y lo entrega estáticamente desde el mismo puerto 3000, así el cliente no necesita Vite ni Node en las máquinas de los usuarios.

Hay un **launcher Python/Tkinter** (`SGF-Panel.bat` + `launcher/sgf-launcher.py`) que detecta Node.js, muestra logs, configura el `.env` y arranca el servidor. Opcionalmente se compila a `sgf-panel.exe` con PyInstaller.

## Hallazgos críticos (cosas que conviene arreglar)

### 🔴 H1 — `.env` commiteado con secretos en texto plano
`server/.env` está en el repo con:
- `ORACLE_USER=pcelular` / `ORACLE_PASSWORD=pcelular`
- `JWT_SECRET=sgf-jwt-secret-cambiar-en-produccion`

**Riesgo:** cualquiera con acceso al repo ve las credenciales. Como el `.env` también es el archivo que `installar-todo.bat` y el launcher leen, está duplicado como template por defecto.

**Acción recomendada:** añadir `.gitignore` para ignorar `server/.env`, commitear un `server/.env.example` con placeholders, y rotar el `JWT_SECRET` por uno fuerte.

### 🔴 H2 — No existe `.gitignore` en el repo
El repo rastrea `client/dist/`, `server/dist/`, `client/node_modules/` (no, ese no), `server/node_modules/`, etc. Esto infla el repo y mete archivos generados. Hay que crear un `.gitignore` raíz.

### 🟠 H3 — CORS abierto a `*` en todas las respuestas
`middleware/auth.ts` pone `Access-Control-Allow-Origin: *` siempre. Para una app que va a correr en LAN interna puede ser aceptable, pero conviene al menos amarrarlo a orígenes conocidos o deshabilitar CORS en navegadores si el frontend se sirve desde el mismo origen (que es el caso en producción).

### 🟠 H4 — `pick()` en `facturas.routes.ts` lee keys en snake, camel y UPPER
La función `pick()` mira `body[key]`, `body[camel]`, `body[pascal]`. Está bien para tolerancia, pero combinado con que el `INSERT` mezcla formatos, hace muy difícil auditar qué se está guardando realmente. Sugerencia: normalizar a snake_case en un solo punto de entrada.

### 🟠 H5 — No hay rate limiting ni protección de fuerza bruta en login
El endpoint `/api/auth/login` no limita intentos. Para una app interna con red LAN el riesgo es bajo, pero un `express-rate-limit` o similar ayudaría contra errores de dedo en bucle.

### 🟡 H6 — Login devuelve `passwordHash` en el objeto `user`
En `auth.routes.ts`, `normalizeUser` mantiene `passwordHash` en el objeto y el login mete `req.currentUser = { ... }` desde ese objeto. Aunque luego `/api/auth/me` no lo devuelve, cualquier log que serialice el usuario entero filtraría el hash. Mejor separar el `normalizeUser` interno del que se devuelve al cliente.

### 🟡 H7 — `pcRequestIp` usa `req.socket.remoteAddress` sin considerar proxies
Si en el futuro se pone Nginx o algún proxy inverso, las IPs en `SGF_LOGS.IP` van a salir todas como `::ffff:127.0.0.1`. Hay que soportar `X-Forwarded-For`.

### 🟡 H8 — El `INFORME-AUDITORIA.md` describe una v4.0 que NO coincide con el código
El informe dice cosas como "se eliminó la persistencia local del cliente" y menciona un `App.tsx` monolítico. El código real **sí** cumple esos puntos (cliente solo UI, sin localStorage de negocio, JWT, etc.), pero el informe usa números de línea que ya no existen. Es un documento histórico, no vigente.

## Cosas que funcionan bien

- Autenticación con JWT y sesión persistida en BD
- CRUD completo de usuarios / facturas / servicios / logs
- Paginación y filtros
- Modo dual Oracle / SQLite con fallback automático
- Parser de facturas ETECSA con detección de formato columnar/filas, validación de totales, descuentos, confianza
- Panel launcher para Windows con detección de Node, instalación de dependencias, gestión de puerto
- Auditoría de operaciones con IP
- Modo "anti-ESET" (cliente precompilado, sin `npm install` en frontend)
- Modo offline con `node_modules` portable

## Cómo se usa

### Servidor
```cmd
instalar-todo.bat        REM una vez
start-servidor.bat       REM arrancar
```
Abre `http://localhost:3000`, login con `yolexis` / `123`.

### Panel gráfico
```cmd
SGF-Panel.bat            REM abre el launcher Python
```

### Compilar el launcher a .exe (opcional)
```cmd
build-exe.bat
```

## Tareas pendientes concretas que me han pedido o que se podrían hacer

Dime cuál(es) quieres que ataque primero:

1. **Higiene de repo**: `.gitignore` + sacar `server/.env` del repo + añadir `.env.example`
2. **Fortalecer login**: rate limit, separar `passwordHash` de la respuesta, validar fortaleza de contraseña
3. **Hacer cumplir HTTPS en producción** (al menos documentar la configuración con Nginx)
4. **Soporte `X-Forwarded-For`** para IP real detrás de proxy
5. **Tests**: el repo ya tiene `test-fixtures/facturas-sinteticas/` y un script `test-parser.ts`, pero no hay runner de tests propiamente. Añadir `vitest` para el cliente y un test runner para el parser
6. **Refinar parser**: hay fixtures con servicios faltantes, OCR ruidoso, layout dañado, etc. — se podrían usar para escribir tests automáticos
7. **Endpoint para descargar la factura original** (campo `ARCHIVO` se guarda pero no se expone)
8. **Soporte para múltiples archivos PDF** en una sola subida (actualmente es 1 a 1)
9. **Exportar historial** a Excel/CSV
10. **Dockerizar** el backend (con `oracledb` es complicado, pero un Dockerfile para la parte Node + el launcher ayudaría en despliegue)

## Estado del repositorio para trabajar

- ✅ Clonado en `/home/user/SGF`
- ✅ Credencial de GitHub ya en el remote (puedo hacer `git push` desde aquí)
- ❌ `git config user.name` / `user.email` están vacíos (lo configuro si vamos a hacer commits)
- ✅ Working tree limpio sobre `main`

## Próximo paso

Dime qué quieres hacer primero y arranco. Si no me dices nada específico, **te recomendaría empezar por la higiene de repo (1)**, porque toca pocas líneas y elimina el riesgo de secretos de inmediato.
