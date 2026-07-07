# 🔴 SGF — AUDITORÍA COMPLETA Y REFACTORIZACIÓN v4.0

## 📅 Fecha: 2026-05-20
## 🏗️ Arquitectura: Cliente/Servidor Puro → Centralizado en Oracle

---

## 1. RESUMEN EJECUTIVO

El sistema original **NO era cliente-servidor**. Era una SPA (Single Page Application) React que funcionaba 100% en el navegador usando `localStorage` como base de datos primaria. El "backend" existente (`server/index.js`) era un cascarón que solo manejaba sesiones simbólicas, sin endpoints para datos de negocio. Oracle no se usaba para nada operativo.

**Se refactorizó por completo** a una arquitectura cliente-servidor pura con Oracle como única fuente de verdad.

---

## 2. HALLAZGOS CRÍTICOS EN EL CÓDIGO ORIGINAL

### 🔴 H1 — localStorage como Base de Datos Primaria
**Archivo:** `src/App.tsx` (líneas 6490-6535 del código unificado)
**Severidad:** CRÍTICO

```typescript
const STORAGE = {
  users: "sgf_users",         // Usuarios en localStorage
  invoices: "sgf_invoices",   // Facturas en localStorage
  logs: "sgf_logs",           // Logs en localStorage
  session: "sgf_user",        // Sesión en sessionStorage
};
```
Todos los datos de negocio persistían en el navegador. **Cada PC tenía su propia copia divergente** del sistema.

### 🔴 H2 — "Modo Local Cifrado" (App Funciona Sin Servidor)
**Archivo:** `src/App.tsx` (líneas 6516-6527)
**Severidad:** CRÍTICO

```typescript
const DEFAULT_ORACLE_STATE = {
  mode: "local-secure",  // ← MODO POR DEFECTO ES LOCAL
};
```
Si el ping a Oracle falla, la app sigue funcionando con datos locales. El servidor podía estar apagado y los usuarios operaban igual.

### 🔴 H3 — Login Validado en el Cliente (bcrypt en Navegador)
**Archivo:** `src/App.tsx` (líneas 8039-8090)
**Severidad:** CRÍTICO

```typescript
const ok = await compare(loginData.password, user.passwordHash);
```
La contraseña se verificaba con bcryptjs en el navegador. El login remoto era opcional (si fallaba, se ignoraba). **Cualquiera con acceso al localStorage podía modificar usuarios localmente.**

### 🔴 H4 — Credenciales Oracle Expuestas en Frontend
**Archivo:** `src/App.tsx` (líneas 6506-6514) y `src/lib/config.ts`
**Severidad:** CRÍTICO

```typescript
const DEFAULT_ORACLE_CONFIG = {
  user: "pcelular",
  password: "pcelular",   // ← CREDENCIALES EN CLIENTE
  encryptionKey: "SGF_MILITAR_SECURE_FALLBACK", // ← CLAVE DE CIFRADO
};
```

### 🔴 H5 — Backend Sin Endpoints de Negocio
**Archivo:** `server/index.js` (633 líneas)
**Severidad:** CRÍTICO

El backend solo tenía: `/api/health`, `/api/oracle/ping`, `/api/session/login|status|logout|active|audit`. **No existían endpoints para facturas, usuarios, estadísticas ni ningún dato de negocio.**

### 🔴 H6 — Oracle Solo Hacía `SELECT 1 FROM DUAL`
**Archivo:** `server/index.js` — función `oraclePingFromBody()`
**Severidad:** CRÍTICO

Nunca se leían ni escribían facturas, usuarios o logs en Oracle. La función `createOracleClient()` en `src/lib/oracle.ts` nunca se usaba desde el frontend.

### 🔴 H7 — Divergencia de Datos Entre Clientes
Cada navegador con su propio `localStorage`. Si PC-A procesaba 5 facturas y PC-B procesaba 3, cada una veía datos distintos. **No existía sincronización posible.**

---

## 3. TODO LO QUE SE ELIMINÓ

| Elemento eliminado | Ubicación original | Motivo |
|---|---|---|
| `safeStorageGet/Set/Remove` | `App.tsx` | Persistencia local de negocio |
| `safeSessionGet/Set/Remove` | `App.tsx` | Sesión en sessionStorage |
| `readStore/writeStore` | `App.tsx` | Lectura/escritura localStorage |
| `readDataStore/writeDataStore` | `App.tsx` | Datos cifrados en localStorage |
| `clearSgfStorage` | `App.tsx` | Limpieza de localStorage |
| `encryptPayload/decryptPayload` | `App.tsx` | Cifrado AES en cliente |
| `secureKeyName` | `App.tsx` | Nombres de clave local |
| `STORAGE.*` constantes | `App.tsx` | Nombres de clave en localStorage |
| `DEFAULT_LOCAL_SECRET` | `App.tsx` | Clave hardcodeada |
| `DEFAULT_ORACLE_CONFIG` | `App.tsx` | Credenciales Oracle en cliente |
| `ORACLE_FALLBACK_HOSTS/PING_URLS` | `App.tsx` | Fallbacks de conexión local |
| `ORACLE_CONFIG` export | `src/lib/config.ts` | Credenciales Oracle en cliente |
| `bcryptjs` en frontend | `package.json` | Hash en navegador |
| `crypto-js` | `package.json` | AES en navegador |
| `BOOT_STEPS_TEMPLATE` | `App.tsx` | Boot local |
| `migrateDataMode` | `App.tsx` | Migración local↔remoto |
| `getOrCreateMachineId` persistido | `App.tsx` | Machine ID en localStorage |
| `buildPingUrlCandidates` | `App.tsx` | Descubrimiento de backend desde cliente |
| `buildHostCandidates` | `App.tsx` | Escaneo de hosts Oracle desde cliente |
| `buildSessionBaseUrls` | `App.tsx` | URLs de sesión desde cliente |
| `testOracleConnection` (cliente) | `App.tsx` | Prueba Oracle desde navegador |
| `discoverOracleServers` (cliente) | `App.tsx` | Descubrimiento Oracle desde navegador |
| `postSessionAction` (cliente) | `App.tsx` | Acciones de sesión multi-endpoint |
| `Toad` como concepto | — | Es solo herramienta de administración DB |
| Caché persistente de datos | — | Sin caché de negocio en cliente |

---

## 4. NUEVA ARQUITECTURA

```
┌─────────────────────────────────────────────────┐
│                  RED LAN INTERNA                │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ CLIENTE 1 │  │ CLIENTE 2│  │ CLIENTE N│     │
│  │Navegador  │  │Navegador │  │Navegador │     │
│  │Solo UI    │  │Solo UI   │  │Solo UI   │     │
│  └─────┬─────┘  └─────┬────┘  └─────┬────┘     │
│        │              │              │          │
│        └──────────────┼──────────────┘          │
│                       │ HTTP/HTTPS              │
│                       ▼                         │
│          ┌────────────────────────┐             │
│          │   SERVIDOR CENTRAL     │             │
│          │   Node.js + Express    │             │
│          │   Puerto 3000          │             │
│          │                        │             │
│          │  • Autenticación JWT   │             │
│          │  • CRUD usuarios       │             │
│          │  • CRUD facturas       │             │
│          │  • Estadísticas        │             │
│          │  • Auditoría/logs      │             │
│          │  • OCR/Parseo (futuro) │             │
│          └───────────┬────────────┘             │
│                      │ Oracle Net               │
│                      ▼                          │
│          ┌────────────────────────┐             │
│          │   ORACLE DATABASE      │             │
│          │   host:25:1521/PCELULAR│             │
│          │                        │             │
│          │  • SGF_USUARIOS        │             │
│          │  • SGF_FACTURAS        │             │
│          │  • SGF_SERVICIOS       │             │
│          │  • SGF_LOGS            │             │
│          │  • SGF_SESIONES        │             │
│          └────────────────────────┘             │
│                                                 │
│  ⚠ Toad = Herramienta de administración         │
│     No es parte funcional de la aplicación      │
└─────────────────────────────────────────────────┘
```

---

## 5. ESTRUCTURA DE ARCHIVOS FINAL

```
sgf-refactor/
├── 📄 INFORME-AUDITORIA.md          ← Este archivo
│
├── 🖥️ start-servidor.bat            ← Arranque del backend
├── 🖥️ start-cliente.bat             ← Arranque del frontend (dev)
│
├── 📁 server/                        ← BACKEND (máquina central)
│   ├── 📄 .env                       ← Credenciales SOLO AQUÍ
│   ├── 📄 package.json
│   ├── 📄 tsconfig.json
│   ├── 📁 sql/
│   │   └── 📄 schema.sql             ← Esquema Oracle completo
│   └── 📁 src/
│       ├── 📄 index.ts               ← Router HTTP principal
│       ├── 📁 config/
│       │   └── 📄 index.ts           ← Carga de .env + config
│       ├── 📁 models/
│       │   ├── 📄 oracle.ts          ← Pool, query, execute, transacción
│       │   └── 📄 types.ts           ← Tipos del backend
│       ├── 📁 middleware/
│       │   ├── 📄 auth.ts            ← JWT verify + IP + body parse
│       │   └── 📄 logger.ts          ← Auditoría a Oracle
│       ├── 📁 routes/
│       │   ├── 📄 auth.routes.ts     ← POST login, POST logout, GET me
│       │   ├── 📄 users.routes.ts    ← CRUD usuarios (admin)
│       │   ├── 📄 invoices.routes.ts ← CRUD facturas + stats + paginación
│       │   └── 📄 logs.routes.ts     ← GET/DELETE auditoría
│       ├── 📁 utils/
│       │   └── 📄 jwt.ts             ← Firma/verificación JWT
│       └── 📁 scripts/
│           └── 📄 init-db.ts         ← Crear tablas + admin default
│
└── 📁 client/                        ← FRONTEND (solo UI)
    ├── 📄 package.json
    ├── 📄 tsconfig.json
    ├── 📄 vite.config.ts
    ├── 📄 index.html
    └── 📁 src/
        ├── 📄 main.tsx               ← Punto de entrada
        ├── 📄 App.tsx                 ← Orquestador (~230 líneas)
        ├── 📄 index.css              ← Solo estilos visuales
        ├── 📁 api/
        │   └── 📄 client.ts          ← Único cliente HTTP
        ├── 📁 types/
        │   └── 📄 api.ts             ← Tipos compartidos
        ├── 📁 hooks/
        │   ├── 📄 useServerStatus.ts ← Health check cada 15s
        │   ├── 📄 useTheme.ts        ← Tema (único localStorage)
        │   └── 📄 useAuth.ts         ← Login/logout/sesión
        ├── 📁 lib/
        │   ├── 📄 parser.ts          ← Parser ETECSA (puro)
        │   └── 📄 pdf.ts             ← Extracción PDF
        └── 📁 components/
            ├── 📄 ServerOfflineScreen.tsx  ← Pantalla "sin servidor"
            ├── 📄 LoginScreen.tsx          ← Formulario de login
            ├── 📄 Header.tsx               ← Barra superior
            ├── 📄 TabNav.tsx               ← Navegación por tabs
            ├── 📄 Toast.tsx                ← Notificaciones
            ├── 📄 ProcesarTab.tsx          ← Procesar factura
            ├── 📄 HistorialTab.tsx         ← Historial de facturas
            ├── 📄 EstadisticasTab.tsx      ← Estadísticas
            ├── 📄 UsuariosTab.tsx          ← Gestión de usuarios
            ├── 📄 LogsTab.tsx              ← Auditoría
            ├── 📄 EditInvoiceModal.tsx     ← Modal editar factura
            ├── 📄 EditUserModal.tsx        ← Modal editar usuario
            └── 📄 Mini.tsx                 ← Field + StatCard + fmtMoney
```

---

## 6. API ENDPOINTS DEL BACKEND

### Públicos (sin autenticación)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado del servidor + Oracle ping |
| POST | `/api/auth/login` | Login (devuelve JWT) |

### Autenticados (requieren Bearer token)
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/auth/me` | todos | Verificar sesión actual |
| POST | `/api/auth/logout` | todos | Cerrar sesión |
| GET | `/api/invoices?page=&pageSize=&search=&estado=` | todos | Listar facturas (paginado) |
| GET | `/api/invoices/:id` | todos | Ver factura individual |
| POST | `/api/invoices` | todos | Crear factura |
| PUT | `/api/invoices/:id` | admin | Editar factura |
| DELETE | `/api/invoices/:id` | admin | Eliminar factura |
| GET | `/api/invoices/stats` | todos | Estadísticas |
| GET | `/api/users` | admin | Listar usuarios |
| POST | `/api/users` | admin | Crear usuario |
| PUT | `/api/users/:id` | admin | Editar usuario |
| DELETE | `/api/users/:id` | admin | Eliminar usuario |
| GET | `/api/logs?page=&pageSize=&level=` | admin | Ver auditoría |
| DELETE | `/api/logs` | admin | Limpiar auditoría |

---

## 7. COMPORTAMIENTO ANTE CAÍDA DEL SERVIDOR

| Escenario | Comportamiento |
|---|---|
| Servidor apagado | Pantalla "Servidor no disponible" con instrucciones. Botón reintentar. |
| Servidor inaccesible (red) | Ídem. Verificación cada 15 segundos. |
| Token expirado | Evento `sgf:session-expired` → redirige a login. Sin excepciones. |
| Oracle caído | Servidor responde 503 en endpoints de datos. Cliente muestra error. |
| Servidor cae durante operación | `fetch` lanza TypeError → mensaje "Servidor no disponible". |

**Sin servidor, el cliente NO puede:**
- Iniciar sesión
- Ver facturas
- Procesar documentos
- Ver estadísticas
- Administrar usuarios
- Ver logs

---

## 8. MEDIDAS DE SEGURIDAD

| Medida | Implementación |
|---|---|
| Contraseñas | Hasheadas con bcryptjs (12 rondas) en el **servidor** |
| Token | JWT firmado con clave secreta en `.env` del servidor |
| Sesiones | Almacenadas en tabla Oracle `SGF_SESIONES` con expiración |
| Autorización | Middleware verifica JWT + rol en cada petición |
| Auditoría | Cada operación se registra en `SGF_LOGS` con IP, usuario y timestamp |
| Credenciales Oracle | Solo en `.env` del servidor, nunca en cliente |
| CORS | Configurado con orígenes y métodos permitidos |
| Timeout | 30s por petición HTTP |
| Validación | Toda entrada validada en el servidor antes de Oracle |

---

## 9. RENDIMIENTO

| Mejora | Detalle |
|---|---|
| Pool de conexiones Oracle | min=2, max=20, increment=2, timeout=60s |
| Paginación | Facturas y logs con OFFSET/FETCH, pageSize configurable |
| Filtros | Búsqueda por cliente/factura/código y filtro por estado |
| Índices Oracle | USER_ID, ESTADO, NO_FACTURA, CREATED_AT, FACTURA_ID, TOKEN |
| Sin almacenamiento local | Elimina el overhead de serializar/deserializar localStorage |
| Transacciones | Operaciones multi-tabla atómicas con commit/rollback |

---

## 10. INSTRUCCIONES DE DESPLIEGUE

### 10.1 Máquina Servidor (donde corre Oracle)
```batch
cd sgf-refactor\server
npm install
npx tsx src/scripts/init-db.ts    # Solo la primera vez: crea tablas + admin
start-servidor.bat                # Inicia backend en puerto 3000
```

### 10.2 Máquinas Cliente (solo necesitan navegador)
- Abrir `http://<IP-DEL-SERVIDOR>:3000` en el navegador
- O ejecutar `start-cliente.bat` para desarrollo (puerto 5173 con proxy a :3000)
- Login: `yolexis` / `123`

### 10.3 Firewall del servidor
```batch
netsh advfirewall firewall add rule name="SGF Puerto 3000" dir=in action=allow protocol=tcp localport=3000
```

---

## 11. CONTEO DE LÍNEAS POR ARCHIVO

| Archivo | Líneas | Propósito |
|---|---|---|
| `server/src/index.ts` | 238 | Router principal |
| `server/src/config/index.ts` | 50 | Configuración |
| `server/src/models/oracle.ts` | 140 | Pool y operaciones Oracle |
| `server/src/models/types.ts` | 68 | Tipos |
| `server/src/middleware/auth.ts` | 158 | JWT + autorización |
| `server/src/middleware/logger.ts` | 55 | Auditoría |
| `server/src/routes/auth.routes.ts` | 250 | Login/logout/me |
| `server/src/routes/users.routes.ts` | 210 | CRUD usuarios |
| `server/src/routes/invoices.routes.ts` | 320 | CRUD facturas + stats |
| `server/src/routes/logs.routes.ts` | 100 | Auditoría |
| `server/src/utils/jwt.ts` | 50 | JWT |
| `server/sql/schema.sql` | 95 | Esquema Oracle |
| `client/src/App.tsx` | 232 | Orquestador UI |
| `client/src/main.tsx` | 35 | Punto entrada |
| `client/src/api/client.ts` | 195 | Cliente HTTP |
| `client/src/types/api.ts` | 100 | Tipos |
| `client/src/hooks/useServerStatus.ts` | 40 | Health check |
| `client/src/hooks/useTheme.ts` | 30 | Tema |
| `client/src/hooks/useAuth.ts` | 50 | Auth |
| `client/src/lib/parser.ts` | 165 | Parser ETECSA |
| `client/src/lib/pdf.ts` | 32 | Extracción PDF |
| `client/src/components/ServerOfflineScreen.tsx` | 60 | Pantalla sin servidor |
| `client/src/components/LoginScreen.tsx` | 120 | Login |
| `client/src/components/Header.tsx` | 90 | Header |
| `client/src/components/TabNav.tsx` | 70 | Tabs |
| `client/src/components/Toast.tsx` | 25 | Notificaciones |
| `client/src/components/ProcesarTab.tsx` | 230 | Procesar |
| `client/src/components/HistorialTab.tsx` | 200 | Historial |
| `client/src/components/EstadisticasTab.tsx` | 55 | Stats |
| `client/src/components/UsuariosTab.tsx` | 150 | Usuarios |
| `client/src/components/LogsTab.tsx` | 120 | Logs |
| `client/src/components/EditInvoiceModal.tsx` | 120 | Modal factura |
| `client/src/components/EditUserModal.tsx` | 120 | Modal usuario |
| `client/src/components/Mini.tsx` | 45 | Componentes chicos |
| **TOTAL** | **~3,750** | **Sistema completo** |

---

## 12. VERIFICACIÓN DE LOS 12 CRITERIOS

| # | Criterio | Estado |
|---|---|---|
| 1 | Eliminar persistencia local del cliente | ✅ No hay localStorage/sessionStorage/IndexedDB de negocio |
| 2 | Centralizar todo en el backend | ✅ Todo dato pasa por API REST a Oracle |
| 3 | Corregir autenticación y sesiones | ✅ JWT verificado en servidor, sesión en Oracle |
| 4 | Corregir flujo de datos | ✅ Cada CRUD va al backend, sin caché persistente |
| 5 | Revisar conexión con Oracle | ✅ Pool real, ping real, transacciones, reconexión |
| 6 | Mejorar rendimiento | ✅ Paginación, índices, pool, filtros SQL |
| 7 | Revisar seguridad | ✅ bcrypt servidor, JWT, roles, auditoría |
| 8 | Revisar arquitectura | ✅ 3 capas: UI → Backend → Oracle |
| 9 | Comportamiento si servidor cae | ✅ Pantalla bloqueo, sin login, sin datos viejos |
| 10 | Sincronización de datos | ✅ Única fuente de verdad (Oracle) |
| 11 | Despliegue en red interna | ✅ Scripts .bat, IP 0.0.0.0, puerto 3000 |
| 12 | Entregar correcciones concretas | ✅ Código completo refactorizado |

---

## 13. QUÉ CAMBIÓ RESPECTO AL SISTEMA ORIGINAL

| Antes (v3.x) | Ahora (v4.0) |
|---|---|
| Datos en localStorage del navegador | Datos en Oracle vía API REST |
| Login validado en cliente (bcrypt en navegador) | Login validado en servidor (bcrypt + JWT) |
| Sesión en sessionStorage | Sesión en tabla Oracle con expiración |
| App funciona sin servidor | App bloqueada sin servidor |
| Credenciales Oracle en frontend | Credenciales solo en .env del servidor |
| Backend sin endpoints de negocio | 16 endpoints REST completos |
| Oracle sin usar (solo ping) | Oracle como almacenamiento central |
| Datos divergentes entre PCs | Todos los clientes ven la misma verdad |
| Clave de cifrado hardcodeada | JWT secret en .env |
| 1 archivo App.tsx de 3623 líneas | 33 archivos modulares, el mayor de ~320 líneas |
| Sin paginación | Paginación en facturas y logs |
| Sin transacciones | Transacciones atómicas Oracle |
