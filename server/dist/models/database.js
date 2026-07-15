import initSqlJs from "sql.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../../server-data");
const DB_PATH = path.join(DATA_DIR, "sgf-data.db");
let db = null;
let saveTimer = null;
let oraclePool = null;
let mssqlPool = null;
let mssqlDriver = null;
let mode = "sqlite";
function ensureDir() {
    if (!fs.existsSync(DATA_DIR))
        fs.mkdirSync(DATA_DIR, { recursive: true });
}
function saveDisk() {
    if (!db)
        return;
    try {
        fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
    }
    catch (error) {
        console.error("[SGF] Error guardando SQLite:", error.message);
    }
}
function scheduleSave() {
    if (saveTimer)
        clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDisk, 1000);
}
const SQLITE_SCHEMA = [
    `CREATE TABLE IF NOT EXISTS PCELULAR_CARGARARCH (NUMERO TEXT, CUOTA TEXT, CONSUMO TEXT, COMISION TEXT, IMPUESTO TEXT, IMPORTE TEXT, TIRA TEXT, FECHA_PARTE TEXT)`,
    `CREATE TABLE IF NOT EXISTS PCELULAR_PRESUPUESTO (NUMERO INTEGER, FECHA TEXT, CONSUMO REAL, CUOTA REAL, COMISION REAL, IMPUESTO REAL, IMPORTE REAL)`,
    `CREATE TABLE IF NOT EXISTS PCELULAR_LINEA_TELEFONICA (NUMERO INTEGER PRIMARY KEY, FECHAACTUALIZACION TEXT, PIN TEXT, PUK TEXT, ASIGNACIONVOZ INTEGER, ASIGNACIONSMS INTEGER, INTERNET INTEGER, PUBLICO INTEGER, ESTADO INTEGER, MMS INTEGER, IDENTID TEXT, COD_MUNICIPIO TEXT, COD_UNIDAD TEXT, COD_CARGO TEXT)`,
    `CREATE TABLE IF NOT EXISTS PCELULAR_PERSONA (INDENTID TEXT PRIMARY KEY, COD_CARGO TEXT, COD_GRADO TEXT, NOMBRE TEXT, NOMBRE2 TEXT, APELL1 TEXT, APELL2 TEXT, COD_UNIDAD TEXT)`,
    `CREATE TABLE IF NOT EXISTS PCELULAR_PROVINCIA (COD_PROVINCIA TEXT PRIMARY KEY, PROVINCIA_D TEXT)`,
    `CREATE TABLE IF NOT EXISTS PCELULAR_MUNICIPIO (COD_MUNICIPIO TEXT PRIMARY KEY, NOMBRE_M TEXT, COD_PROVINCIA TEXT)`,
    `CREATE TABLE IF NOT EXISTS PCELULAR_ORGANO (COD_ORGANO TEXT PRIMARY KEY, ORGANO TEXT)`,
    `CREATE TABLE IF NOT EXISTS PCELULAR_UNIDAD (COD_UNIDAD TEXT PRIMARY KEY, UNIDAD TEXT, COD_ORGANO TEXT)`,
    `CREATE TABLE IF NOT EXISTS PCELULAR_CARGO (COD_CARGO TEXT PRIMARY KEY, CARGO TEXT, COD_UNIDAD TEXT)`,
    `CREATE TABLE IF NOT EXISTS PCELULAR_GRADO (COD_GRADO TEXT PRIMARY KEY, GRADO_D TEXT)`,
    `CREATE TABLE IF NOT EXISTS PCELULAR_TELEFONO_ASIGNADO (IMEI TEXT, TARGETASD INTEGER, ESTUCHE INTEGER, MARCA TEXT, MODELO TEXT, NUMERO INTEGER PRIMARY KEY)`,
    `CREATE TABLE IF NOT EXISTS SGF_USUARIOS (ID TEXT PRIMARY KEY, USERNAME TEXT UNIQUE, NOMBRE TEXT, ROL TEXT DEFAULT 'usuario', PASSWORD_HASH TEXT, ACTIVO INTEGER DEFAULT 1, CREADO TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS SGF_SESIONES (ID TEXT PRIMARY KEY, USER_ID TEXT, TOKEN TEXT UNIQUE, MAQUINA TEXT, IP TEXT, ACTIVO INTEGER DEFAULT 1, CREADO TEXT DEFAULT (datetime('now')), EXPIRA TEXT)`,
    `CREATE TABLE IF NOT EXISTS SGF_LOGS (ID TEXT PRIMARY KEY, USER_ID TEXT, ACCION TEXT, ENTIDAD TEXT, ENTIDAD_ID TEXT, NIVEL TEXT DEFAULT 'info', DETALLES TEXT, IP TEXT, CREADO TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS SGF_FACTURAS (
      ID TEXT PRIMARY KEY,
      CLIENTE TEXT NOT NULL,
      CUENTA TEXT,
      NUMERO_CLIENTE TEXT,
      NUMERO_CUENTA TEXT,
      NO_FACTURA TEXT,
      FECHA_EMISION TEXT,
      FECHA_VENCIMIENTO TEXT,
      PERIODO_CONSUMO TEXT,
      CODIGO_PAGO TEXT,
      MONEDA TEXT DEFAULT 'CUP',
      NIT TEXT,
      CUOTA REAL DEFAULT 0,
      CONSUMO REAL DEFAULT 0,
      COMISION REAL DEFAULT 0,
      IMPUESTO REAL DEFAULT 0,
      TOTAL REAL DEFAULT 0,
      TOTAL_PAGAR REAL DEFAULT 0,
      ESTADO TEXT DEFAULT 'pendiente',
      PARSER TEXT,
      OCR_CONFIDENCE REAL DEFAULT 0,
      OCR_DURATION INTEGER DEFAULT 0,
      ARCHIVO TEXT,
      TEXTO_OCR TEXT,
      USER_ID TEXT NOT NULL,
      CREATED_AT TEXT DEFAULT (datetime('now')),
      UPDATED_AT TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS SGF_SERVICIOS (
      ID TEXT PRIMARY KEY,
      FACTURA_ID TEXT NOT NULL,
      NUMERO_SERVICIO TEXT NOT NULL,
      CUOTA REAL DEFAULT 0,
      CONSUMO REAL DEFAULT 0,
      COMISION REAL DEFAULT 0,
      IMPUESTO REAL DEFAULT 0,
      IMPORTE REAL DEFAULT 0
    )`,
];
const ORACLE_SCHEMA_TABLES = [
    `CREATE TABLE SGF_USUARIOS (ID VARCHAR2(36) PRIMARY KEY, USERNAME VARCHAR2(50) NOT NULL UNIQUE, NAME VARCHAR2(200) NOT NULL, ROLE VARCHAR2(20) DEFAULT 'usuario' NOT NULL, PASSWORD_HASH VARCHAR2(255) NOT NULL, ACTIVE NUMBER(1) DEFAULT 1 NOT NULL, CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL, UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL)`,
    `CREATE TABLE SGF_FACTURAS (ID VARCHAR2(36) PRIMARY KEY, CLIENTE VARCHAR2(500) NOT NULL, CUENTA VARCHAR2(500), NUMERO_CLIENTE VARCHAR2(50), NUMERO_CUENTA VARCHAR2(50), NO_FACTURA VARCHAR2(50), FECHA_EMISION VARCHAR2(30), FECHA_VENCIMIENTO VARCHAR2(30), PERIODO_CONSUMO VARCHAR2(60), CODIGO_PAGO VARCHAR2(30), MONEDA VARCHAR2(10) DEFAULT 'CUP', NIT VARCHAR2(30), CUOTA NUMBER(18,4) DEFAULT 0, CONSUMO NUMBER(18,4) DEFAULT 0, COMISION NUMBER(18,4) DEFAULT 0, IMPUESTO NUMBER(18,4) DEFAULT 0, TOTAL NUMBER(18,4) DEFAULT 0, TOTAL_PAGAR NUMBER(18,4) DEFAULT 0, ESTADO VARCHAR2(20) DEFAULT 'pendiente', PARSER VARCHAR2(80), OCR_CONFIDENCE NUMBER(5,2) DEFAULT 0, OCR_DURATION NUMBER(10) DEFAULT 0, ARCHIVO VARCHAR2(500), TEXTO_OCR CLOB, USER_ID VARCHAR2(36) NOT NULL, CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL, UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL)`,
    `CREATE TABLE SGF_SERVICIOS (ID VARCHAR2(36) PRIMARY KEY, FACTURA_ID VARCHAR2(36) NOT NULL, NUMERO_SERVICIO VARCHAR2(50) NOT NULL, CUOTA NUMBER(18,4) DEFAULT 0, CONSUMO NUMBER(18,4) DEFAULT 0, COMISION NUMBER(18,4) DEFAULT 0, IMPUESTO NUMBER(18,4) DEFAULT 0, IMPORTE NUMBER(18,4) DEFAULT 0)`,
    `CREATE TABLE SGF_LOGS (ID VARCHAR2(36) PRIMARY KEY, USER_ID VARCHAR2(36), ACCION VARCHAR2(100) NOT NULL, ENTIDAD VARCHAR2(100), ENTIDAD_ID VARCHAR2(36), LEVEL VARCHAR2(10) DEFAULT 'info', DETALLES VARCHAR2(4000), IP_ADDRESS VARCHAR2(50), CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL)`,
    `CREATE TABLE SGF_SESIONES (ID VARCHAR2(36) PRIMARY KEY, USER_ID VARCHAR2(36) NOT NULL, SESSION_TOKEN VARCHAR2(255) NOT NULL UNIQUE, MACHINE_ID VARCHAR2(200), IP_ADDRESS VARCHAR2(50), ACTIVE NUMBER(1) DEFAULT 1, CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL, EXPIRES_AT TIMESTAMP NOT NULL, ENDED_AT TIMESTAMP)`
];
const ORACLE_SCHEMA_INDEXES = [
    `CREATE INDEX IDX_FACTURAS_USER_ID ON SGF_FACTURAS(USER_ID)`,
    `CREATE INDEX IDX_FACTURAS_ESTADO ON SGF_FACTURAS(ESTADO)`,
    `CREATE INDEX IDX_FACTURAS_NO_FACTURA ON SGF_FACTURAS(NO_FACTURA)`,
    `CREATE INDEX IDX_FACTURAS_CREATED_AT ON SGF_FACTURAS(CREATED_AT)`,
    `CREATE INDEX IDX_SERVICIOS_FACTURA_ID ON SGF_SERVICIOS(FACTURA_ID)`,
    `CREATE INDEX IDX_LOGS_USER_ID ON SGF_LOGS(USER_ID)`,
    `CREATE INDEX IDX_LOGS_CREATED_AT ON SGF_LOGS(CREATED_AT)`,
    `CREATE INDEX IDX_SESIONES_USER_ID ON SGF_SESIONES(USER_ID)`,
    `CREATE INDEX IDX_SESIONES_TOKEN ON SGF_SESIONES(SESSION_TOKEN)`
];
const MSSQL_SCHEMA_TABLES = [
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SGF_USUARIOS' AND xtype='U') CREATE TABLE SGF_USUARIOS (ID NVARCHAR(36) PRIMARY KEY, USERNAME NVARCHAR(50) NOT NULL UNIQUE, NAME NVARCHAR(200) NOT NULL, ROLE NVARCHAR(20) NOT NULL DEFAULT 'usuario', PASSWORD_HASH NVARCHAR(255) NOT NULL, ACTIVE BIT NOT NULL DEFAULT 1, CREATED_AT DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), UPDATED_AT DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME())`,
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SGF_FACTURAS' AND xtype='U') CREATE TABLE SGF_FACTURAS (ID NVARCHAR(36) PRIMARY KEY, CLIENTE NVARCHAR(500) NOT NULL, CUENTA NVARCHAR(500) NULL, NUMERO_CLIENTE NVARCHAR(50) NULL, NUMERO_CUENTA NVARCHAR(50) NULL, NO_FACTURA NVARCHAR(50) NULL, FECHA_EMISION NVARCHAR(30) NULL, FECHA_VENCIMIENTO NVARCHAR(30) NULL, PERIODO_CONSUMO NVARCHAR(60) NULL, CODIGO_PAGO NVARCHAR(30) NULL, MONEDA NVARCHAR(10) NOT NULL DEFAULT 'CUP', NIT NVARCHAR(30) NULL, CUOTA DECIMAL(18,4) NOT NULL DEFAULT 0, CONSUMO DECIMAL(18,4) NOT NULL DEFAULT 0, COMISION DECIMAL(18,4) NOT NULL DEFAULT 0, IMPUESTO DECIMAL(18,4) NOT NULL DEFAULT 0, TOTAL DECIMAL(18,4) NOT NULL DEFAULT 0, TOTAL_PAGAR DECIMAL(18,4) NOT NULL DEFAULT 0, ESTADO NVARCHAR(20) NOT NULL DEFAULT 'pendiente', PARSER NVARCHAR(80) NULL, OCR_CONFIDENCE DECIMAL(5,2) NOT NULL DEFAULT 0, OCR_DURATION INT NOT NULL DEFAULT 0, ARCHIVO NVARCHAR(500) NULL, TEXTO_OCR NVARCHAR(MAX) NULL, USER_ID NVARCHAR(36) NOT NULL, CREATED_AT DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), UPDATED_AT DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME())`,
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SGF_SERVICIOS' AND xtype='U') CREATE TABLE SGF_SERVICIOS (ID NVARCHAR(36) PRIMARY KEY, FACTURA_ID NVARCHAR(36) NOT NULL, NUMERO_SERVICIO NVARCHAR(50) NOT NULL, CUOTA DECIMAL(18,4) NOT NULL DEFAULT 0, CONSUMO DECIMAL(18,4) NOT NULL DEFAULT 0, COMISION DECIMAL(18,4) NOT NULL DEFAULT 0, IMPUESTO DECIMAL(18,4) NOT NULL DEFAULT 0, IMPORTE DECIMAL(18,4) NOT NULL DEFAULT 0)`,
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SGF_LOGS' AND xtype='U') CREATE TABLE SGF_LOGS (ID NVARCHAR(36) PRIMARY KEY, USER_ID NVARCHAR(36) NULL, ACCION NVARCHAR(100) NOT NULL, ENTIDAD NVARCHAR(100) NULL, ENTIDAD_ID NVARCHAR(36) NULL, LEVEL NVARCHAR(10) NOT NULL DEFAULT 'info', DETALLES NVARCHAR(MAX) NULL, IP_ADDRESS NVARCHAR(50) NULL, CREATED_AT DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME())`,
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SGF_SESIONES' AND xtype='U') CREATE TABLE SGF_SESIONES (ID NVARCHAR(36) PRIMARY KEY, USER_ID NVARCHAR(36) NOT NULL, SESSION_TOKEN NVARCHAR(255) NOT NULL UNIQUE, MACHINE_ID NVARCHAR(200) NULL, IP_ADDRESS NVARCHAR(50) NULL, ACTIVE BIT NOT NULL DEFAULT 1, CREATED_AT DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), EXPIRES_AT DATETIME2 NOT NULL, ENDED_AT DATETIME2 NULL)`,
];
const MSSQL_SCHEMA_INDEXES = [
    `IF NOT EXISTS (SELECT * FROM sysindexes WHERE name='IDX_FACTURAS_USER_ID') CREATE INDEX IDX_FACTURAS_USER_ID ON SGF_FACTURAS(USER_ID)`,
    `IF NOT EXISTS (SELECT * FROM sysindexes WHERE name='IDX_FACTURAS_ESTADO') CREATE INDEX IDX_FACTURAS_ESTADO ON SGF_FACTURAS(ESTADO)`,
    `IF NOT EXISTS (SELECT * FROM sysindexes WHERE name='IDX_FACTURAS_NO_FACTURA') CREATE INDEX IDX_FACTURAS_NO_FACTURA ON SGF_FACTURAS(NO_FACTURA)`,
    `IF NOT EXISTS (SELECT * FROM sysindexes WHERE name='IDX_FACTURAS_CREATED_AT') CREATE INDEX IDX_FACTURAS_CREATED_AT ON SGF_FACTURAS(CREATED_AT)`,
    `IF NOT EXISTS (SELECT * FROM sysindexes WHERE name='IDX_SERVICIOS_FACTURA_ID') CREATE INDEX IDX_SERVICIOS_FACTURA_ID ON SGF_SERVICIOS(FACTURA_ID)`,
    `IF NOT EXISTS (SELECT * FROM sysindexes WHERE name='IDX_LOGS_USER_ID') CREATE INDEX IDX_LOGS_USER_ID ON SGF_LOGS(USER_ID)`,
    `IF NOT EXISTS (SELECT * FROM sysindexes WHERE name='IDX_LOGS_CREATED_AT') CREATE INDEX IDX_LOGS_CREATED_AT ON SGF_LOGS(CREATED_AT)`,
    `IF NOT EXISTS (SELECT * FROM sysindexes WHERE name='IDX_SESIONES_USER_ID') CREATE INDEX IDX_SESIONES_USER_ID ON SGF_SESIONES(USER_ID)`,
    `IF NOT EXISTS (SELECT * FROM sysindexes WHERE name='IDX_SESIONES_TOKEN') CREATE INDEX IDX_SESIONES_TOKEN ON SGF_SESIONES(SESSION_TOKEN)`,
];
const SQLITE_INDEXES = [
    `CREATE INDEX IF NOT EXISTS idx_cargararch_numero ON PCELULAR_CARGARARCH(NUMERO)`,
    `CREATE INDEX IF NOT EXISTS idx_sesiones_token ON SGF_SESIONES(TOKEN)`,
    `CREATE INDEX IF NOT EXISTS idx_sesiones_user ON SGF_SESIONES(USER_ID)`,
    `CREATE INDEX IF NOT EXISTS idx_logs_creado ON SGF_LOGS(CREADO)`,
    `CREATE INDEX IF NOT EXISTS idx_facturas_no_factura ON SGF_FACTURAS(NO_FACTURA)`,
    `CREATE INDEX IF NOT EXISTS idx_servicios_factura_id ON SGF_SERVICIOS(FACTURA_ID)`,
];
function paramNames(sql) {
    const names = [];
    const re = /:(\w+)/g;
    let match;
    while ((match = re.exec(sql)) !== null)
        names.push(match[1]);
    return names;
}
/**
 * Convierte SQL "abstracto" (con placeholders :name, funciones Oracle como
 * SYSTIMESTAMP o NVL) al dialecto de cada motor. Solo se aplica cuando NO
 * estamos en Oracle.
 */
function toSqlite(sql) {
    let out = sql;
    out = out.replace(/PCELULAR\.CARGARARCH/gi, "PCELULAR_CARGARARCH");
    out = out.replace(/PCELULAR\.LINEA_TELEFONICA/gi, "PCELULAR_LINEA_TELEFONICA");
    out = out.replace(/PCELULAR\.PERSONA/gi, "PCELULAR_PERSONA");
    out = out.replace(/PCELULAR\.UNIDAD/gi, "PCELULAR_UNIDAD");
    out = out.replace(/PCELULAR\.ORGANO/gi, "PCELULAR_ORGANO");
    out = out.replace(/PCELULAR\./gi, "PCELULAR_");
    out = out.replace(/SYSTIMESTAMP/gi, "datetime('now')");
    out = out.replace(/SYSUTCDATETIME\(\)/gi, "datetime('now')");
    out = out.replace(/GETDATE\(\)/gi, "datetime('now')");
    out = out.replace(/GETUTCDATE\(\)/gi, "datetime('now')");
    out = out.replace(/SYSDATE/gi, "datetime('now')");
    out = out.replace(/FROM DUAL/gi, "");
    out = out.replace(/ISNULL\s*\(/gi, "IFNULL(");
    out = out.replace(/NVL\s*\(/gi, "IFNULL(");
    out = out.replace(/TO_CHAR\s*\(\s*([^,]+?)\s*,\s*'[^']*'\s*\)/gi, "$1");
    out = out.replace(/OFFSET\s*:(\w+)\s+ROWS\s+FETCH\s+NEXT\s*:(\w+)\s+ROWS\s+ONLY/gi, "LIMIT :$2 OFFSET :$1");
    out = out.replace(/DATEADD\s*\(\s*HOUR\s*,\s*8\s*,\s*GETDATE\(\)\s*\)/gi, "datetime('now','+8 hours')");
    out = out.replace(/INTERVAL\s*'(\d+)'\s*HOUR/gi, "'+$1 hours'");
    out = out.replace(/:(\w+)/g, "?");
    return out.trim();
}
/**
 * Convierte SQL "abstracto" a T-SQL de SQL Server. Las funciones se
 * sustituyen a sus equivalentes. Los placeholders :name se mantienen
 * porque mssql los acepta directamente (los convierte a @name).
 */
function toMssql(sql) {
    let out = sql;
    out = out.replace(/PCELULAR\.CARGARARCH/gi, "PCELULAR_CARGARARCH");
    out = out.replace(/PCELULAR\.LINEA_TELEFONICA/gi, "PCELULAR_LINEA_TELEFONICA");
    out = out.replace(/PCELULAR\.PERSONA/gi, "PCELULAR_PERSONA");
    out = out.replace(/PCELULAR\.UNIDAD/gi, "PCELULAR_UNIDAD");
    out = out.replace(/PCELULAR\.ORGANO/gi, "PCELULAR_ORGANO");
    out = out.replace(/PCELULAR\./gi, "PCELULAR_");
    out = out.replace(/SYSTIMESTAMP/gi, "SYSUTCDATETIME()");
    out = out.replace(/GETDATE\(\)/gi, "SYSUTCDATETIME()");
    out = out.replace(/SYSDATE/gi, "SYSUTCDATETIME()");
    out = out.replace(/NVL\s*\(/gi, "ISNULL(");
    out = out.replace(/TO_CHAR\s*\(\s*([^,]+?)\s*,\s*'[^']*'\s*\)/gi, "CONVERT(VARCHAR(20), $1, 103)");
    out = out.replace(/INTERVAL\s*'(\d+)'\s*HOUR/gi, "$1 HOUR");
    out = out.replace(/\s+FROM\s+DUAL/gi, "");
    out = out.replace(/LIMIT\s+:(\w+)\s+OFFSET\s+:(\w+)/gi, "OFFSET @$2 ROWS FETCH NEXT @$1 ROWS ONLY");
    out = out.replace(/:(\w+)/g, "@$1");
    return out;
}
async function sqliteQuery(sql, params = {}) {
    if (!db)
        throw new Error("BD no inicializada");
    const converted = toSqlite(sql);
    const values = paramNames(sql).map((key) => params[key]);
    const stmt = db.prepare(converted);
    stmt.bind(values);
    const rows = [];
    while (stmt.step())
        rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}
async function sqliteExecute(sql, params = {}) {
    if (!db)
        throw new Error("BD no inicializada");
    const converted = toSqlite(sql);
    const values = paramNames(sql).map((key) => params[key]);
    db.run(converted, values);
    const affected = db.getRowsModified();
    scheduleSave();
    return affected;
}
/**
 * Ejecuta una query en SQL Server usando mssql. Los placeholders :name
 * se convierten a @name (que es el formato nativo de T-SQL).
 */
async function mssqlQuery(sql, params = {}) {
    if (!mssqlPool)
        throw new Error("Pool SQL Server no inicializado");
    const request = mssqlPool.request();
    for (const [k, v] of Object.entries(params)) {
        if (v === null || v === undefined) {
            request.input(k, null);
        }
        else if (typeof v === "number") {
            request.input(k, mssqlDriver.Decimal(18, 4), v);
        }
        else if (typeof v === "boolean") {
            request.input(k, mssqlDriver.Bit, v);
        }
        else {
            request.input(k, mssqlDriver.NVarChar(mssqlDriver.MAX), String(v));
        }
    }
    const converted = toMssql(sql);
    const result = await request.query(converted);
    return (result.recordset || []);
}
async function mssqlExecute(sql, params = {}) {
    if (!mssqlPool)
        throw new Error("Pool SQL Server no inicializado");
    const request = mssqlPool.request();
    for (const [k, v] of Object.entries(params)) {
        if (v === null || v === undefined) {
            request.input(k, null);
        }
        else if (typeof v === "number") {
            request.input(k, mssqlDriver.Decimal(18, 4), v);
        }
        else if (typeof v === "boolean") {
            request.input(k, mssqlDriver.Bit, v);
        }
        else {
            request.input(k, mssqlDriver.NVarChar(mssqlDriver.MAX), String(v));
        }
    }
    const converted = toMssql(sql);
    const result = await request.query(converted);
    return result.rowsAffected?.[0] ?? 0;
}
/**
 * Helpers de expresiones comunes por motor. Se usan en las rutas
 * para no tener ifs (mode === "oracle") repetidos en cada query.
 */
export function nowExpr() {
    if (mode === "oracle")
        return "SYSTIMESTAMP";
    if (mode === "mssql")
        return "SYSUTCDATETIME()";
    return "datetime('now')";
}
export function expireExpr(horas) {
    if (mode === "oracle")
        return `SYSTIMESTAMP + INTERVAL '${horas}' HOUR`;
    if (mode === "mssql")
        return `DATEADD(HOUR, ${horas}, SYSUTCDATETIME())`;
    return `datetime('now','+${horas} hours')`;
}
export function paginationExpr(offsetAlias, limitAlias) {
    if (mode === "oracle")
        return `OFFSET :${offsetAlias} ROWS FETCH NEXT :${limitAlias} ROWS ONLY`;
    if (mode === "mssql")
        return `OFFSET @${offsetAlias} ROWS FETCH NEXT @${limitAlias} ROWS ONLY`;
    return `LIMIT :${limitAlias} OFFSET :${offsetAlias}`;
}
export function nullableCoalesce(...args) {
    if (mode === "oracle")
        return `NVL(${args.join(", ")})`;
    if (mode === "mssql")
        return `ISNULL(${args.join(", ")})`;
    return `IFNULL(${args.join(", ")})`;
}
async function ensureAdmin() {
    const hash = await bcrypt.hash("123", 12);
    const id = randomUUID();
    if (mode === "oracle") {
        const rows = await query("SELECT ID FROM SGF_USUARIOS WHERE USERNAME = :u", { u: "yolexis" });
        if (rows.length > 0)
            return;
        await execute(`INSERT INTO SGF_USUARIOS (ID, USERNAME, NAME, ROLE, PASSWORD_HASH, ACTIVE, CREATED_AT, UPDATED_AT)
       VALUES (:id, :u, :n, :r, :h, 1, SYSTIMESTAMP, SYSTIMESTAMP)`, { id, u: "yolexis", n: "Administrador SGF", r: "admin", h: hash });
        console.log("[SGF] Admin Oracle creado: yolexis / 123");
        return;
    }
    if (mode === "mssql") {
        const rows = await query("SELECT ID FROM SGF_USUARIOS WHERE USERNAME = :u", { u: "yolexis" });
        if (rows.length > 0)
            return;
        await execute(`INSERT INTO SGF_USUARIOS (ID, USERNAME, NAME, ROLE, PASSWORD_HASH, ACTIVE, CREATED_AT, UPDATED_AT)
       VALUES (:id, :u, :n, :r, :h, 1, SYSUTCDATETIME(), SYSUTCDATETIME())`, { id, u: "yolexis", n: "Administrador SGF", r: "admin", h: hash });
        console.log("[SGF] Admin SQL Server creado: yolexis / 123");
        return;
    }
    const rows = await sqliteQuery("SELECT ID FROM SGF_USUARIOS WHERE USERNAME = :u", { u: "yolexis" });
    if (rows.length > 0)
        return;
    await sqliteExecute(`INSERT INTO SGF_USUARIOS (ID, USERNAME, NOMBRE, ROL, PASSWORD_HASH, ACTIVO, CREADO)
     VALUES (:id, :u, :n, :r, :h, 1, datetime('now'))`, { id, u: "yolexis", n: "Administrador SGF", r: "admin", h: hash });
    console.log("[SGF] Admin SQLite creado: yolexis / 123");
}
async function initSqlite() {
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
        db = new SQL.Database(fs.readFileSync(DB_PATH));
        console.log("[SGF] SQLite cargado:", DB_PATH);
    }
    else {
        db = new SQL.Database();
        console.log("[SGF] SQLite creado:", DB_PATH);
    }
    for (const sql of SQLITE_SCHEMA)
        db.run(sql);
    for (const sql of SQLITE_INDEXES)
        db.run(sql);
    mode = "sqlite";
    await ensureAdmin();
    saveDisk();
    return { mode: "sqlite", ok: true };
}
async function ensureOracleSchema(pool) {
    const conn = await pool.getConnection();
    try {
        for (const sql of ORACLE_SCHEMA_TABLES) {
            try {
                await conn.execute(sql);
            }
            catch (error) {
                if (!String(error?.message || '').includes('ORA-00955'))
                    throw error;
            }
        }
        for (const sql of ORACLE_SCHEMA_INDEXES) {
            try {
                await conn.execute(sql);
            }
            catch (error) {
                if (!String(error?.message || '').includes('ORA-00955'))
                    throw error;
            }
        }
        await conn.commit();
    }
    finally {
        await conn.close();
    }
}
async function ensureMssqlSchema(pool) {
    // sql.js-style: cada sentencia IF NOT EXISTS se ejecuta y solo falla
    // si la condicion no es cierta. Como IF NOT EXISTS usa un SELECT que
    // no devuelve nada cuando es verdadero, no hay filas que consumir.
    for (const sql of MSSQL_SCHEMA_TABLES) {
        await pool.request().query(sql);
    }
    for (const sql of MSSQL_SCHEMA_INDEXES) {
        await pool.request().query(sql);
    }
}
export async function connectOracleRuntime(config) {
    const driver = await import('oracledb');
    const nextConfig = {
        user: String(config?.user || process.env.ORACLE_USER || 'pcelular'),
        password: String(config?.password || process.env.ORACLE_PASSWORD || 'pcelular'),
        host: String(config?.host || process.env.ORACLE_HOST || '25'),
        port: String(config?.port || process.env.ORACLE_PORT || '1521'),
        service: String(config?.service || process.env.ORACLE_SERVICE || 'PCELULAR'),
    };
    const connectTimeoutMs = Number(process.env.ORACLE_CONNECT_TIMEOUT_MS || 5000);
    let nextPool;
    try {
        nextPool = await Promise.race([
            driver.default.createPool({
                user: nextConfig.user,
                password: nextConfig.password,
                connectString: `${nextConfig.host}:${nextConfig.port}/${nextConfig.service}`,
                poolMin: 2,
                poolMax: 8,
                poolIncrement: 1,
                poolTimeout: 30,
                connectTimeout: connectTimeoutMs / 1000,
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout conectando a Oracle despues de ${connectTimeoutMs}ms`)), connectTimeoutMs + 1000)),
        ]);
    }
    catch (error) {
        throw error;
    }
    try {
        const conn = await nextPool.getConnection();
        try {
            await conn.execute('SELECT 1 FROM DUAL');
        }
        finally {
            await conn.close();
        }
        await ensureOracleSchema(nextPool);
    }
    catch (error) {
        try {
            await nextPool.close(5);
        }
        catch { }
        throw error;
    }
    if (oraclePool) {
        try {
            await oraclePool.close(5);
        }
        catch { }
    }
    oraclePool = nextPool;
    process.env.ORACLE_USER = nextConfig.user;
    process.env.ORACLE_PASSWORD = nextConfig.password;
    process.env.ORACLE_HOST = nextConfig.host;
    process.env.ORACLE_PORT = String(nextConfig.port);
    process.env.ORACLE_SERVICE = nextConfig.service;
    mode = 'oracle';
    await ensureAdmin();
    return { ok: true, config: nextConfig };
}
export async function connectMssqlRuntime(config) {
    if (!mssqlDriver) {
        mssqlDriver = (await import('mssql')).default;
    }
    const server = String(config?.server || process.env.MSSQL_SERVER || 'localhost');
    const port = Number(config?.port || process.env.MSSQL_PORT || 1433);
    const database = String(config?.database || process.env.MSSQL_DATABASE || 'sgf');
    const user = String(config?.user || process.env.MSSQL_USER || 'sa');
    const password = String(config?.password || process.env.MSSQL_PASSWORD || '');
    const encrypt = config?.encrypt !== undefined
        ? Boolean(config.encrypt)
        : String(process.env.MSSQL_ENCRYPT || 'false').toLowerCase() === 'true';
    const trustServerCertificate = config?.trustServerCertificate !== undefined
        ? Boolean(config.trustServerCertificate)
        : String(process.env.MSSQL_TRUST_CERT || 'true').toLowerCase() !== 'false';
    const nextConfig = {
        user, password, server, port, database,
        options: { encrypt, trustServerCertificate },
        pool: {
            max: Number(process.env.MSSQL_POOL_MAX || 10),
            min: Number(process.env.MSSQL_POOL_MIN || 0),
            idleTimeoutMillis: Number(process.env.MSSQL_POOL_IDLE_MS || 30000),
        },
    };
    const connectTimeoutMs = Number(process.env.MSSQL_CONNECT_TIMEOUT_MS || 5000);
    let nextPool;
    try {
        nextPool = await Promise.race([
            new mssqlDriver.ConnectionPool(nextConfig).connect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout conectando a SQL Server despues de ${connectTimeoutMs}ms`)), connectTimeoutMs + 1000)),
        ]);
    }
    catch (error) {
        throw error;
    }
    try {
        await ensureMssqlSchema(nextPool);
    }
    catch (error) {
        try {
            await nextPool.close();
        }
        catch { }
        throw error;
    }
    if (mssqlPool) {
        try {
            await mssqlPool.close();
        }
        catch { }
    }
    mssqlPool = nextPool;
    process.env.MSSQL_SERVER = server;
    process.env.MSSQL_PORT = String(port);
    process.env.MSSQL_DATABASE = database;
    process.env.MSSQL_USER = user;
    process.env.MSSQL_PASSWORD = password;
    process.env.MSSQL_ENCRYPT = String(encrypt);
    process.env.MSSQL_TRUST_CERT = String(trustServerCertificate);
    mode = 'mssql';
    await ensureAdmin();
    return { ok: true, config: { server, port, database, user } };
}
export async function initDatabase() {
    ensureDir();
    // Respetar DB_TYPE del .env si esta presente.
    const dbType = String(process.env.DB_TYPE || '').trim().toLowerCase();
    if (dbType === 'mssql') {
        try {
            await connectMssqlRuntime();
            console.log(`[SGF] SQL Server conectado: ${process.env.MSSQL_SERVER}/${process.env.MSSQL_DATABASE}`);
            return { mode: "mssql", ok: true };
        }
        catch (error) {
            console.log("[SGF] SQL Server no disponible:", error?.message || "sin detalle");
            mssqlPool = null;
        }
    }
    else if (dbType === 'oracle') {
        try {
            await connectOracleRuntime();
            console.log(`[SGF] Oracle PCELULAR conectado`);
            return { mode: "oracle", ok: true };
        }
        catch (error) {
            console.log("[SGF] Oracle no disponible:", error?.message || "sin detalle");
            oraclePool = null;
        }
    }
    else if (dbType === 'sqlite') {
        return initSqlite();
    }
    else {
        // Sin DB_TYPE definido: intentar Oracle primero (compatibilidad con
        // despliegues anteriores), despues SQL Server, y por ultimo SQLite
        // como fallback de emergencia.
        try {
            await connectOracleRuntime();
            console.log("[SGF] Oracle PCELULAR conectado");
            return { mode: "oracle", ok: true };
        }
        catch (error) {
            console.log("[SGF] Oracle no disponible:", error?.message || "sin detalle");
            oraclePool = null;
        }
        try {
            await connectMssqlRuntime();
            console.log(`[SGF] SQL Server conectado: ${process.env.MSSQL_SERVER}/${process.env.MSSQL_DATABASE}`);
            return { mode: "mssql", ok: true };
        }
        catch (error) {
            console.log("[SGF] SQL Server no disponible:", error?.message || "sin detalle");
            mssqlPool = null;
        }
    }
    return initSqlite();
}
export function getDbMode() {
    return mode;
}
export function isEnterprise() {
    return mode === "oracle" || mode === "mssql";
}
export function isOracleLegacyTablesAvailable() {
    // Solo intentamos tocar el esquema PCELULAR.* en Oracle, donde sabemos
    // que existe. En SQL Server y en SQLite esas tablas no existen y
    // cualquier intento de INSERT fallaria.
    return mode === "oracle";
}
export async function query(sql, params = {}) {
    if (mode === "oracle" && oraclePool) {
        const oracledb = await import("oracledb");
        const conn = await oraclePool.getConnection();
        try {
            const result = await conn.execute(sql, params, { outFormat: oracledb.default.OUT_FORMAT_OBJECT });
            return (result.rows || []);
        }
        finally {
            await conn.close();
        }
    }
    if (mode === "mssql" && mssqlPool) {
        return (await mssqlQuery(sql, params));
    }
    return (await sqliteQuery(sql, params));
}
export async function execute(sql, params = {}) {
    if (mode === "oracle" && oraclePool) {
        const conn = await oraclePool.getConnection();
        try {
            const result = await conn.execute(sql, params, { autoCommit: true });
            return result.rowsAffected || 0;
        }
        finally {
            await conn.close();
        }
    }
    if (mode === "mssql" && mssqlPool) {
        return mssqlExecute(sql, params);
    }
    return sqliteExecute(sql, params);
}
export async function transaction(fn) {
    if (mode === "oracle" && oraclePool) {
        const conn = await oraclePool.getConnection();
        try {
            const value = await fn(conn);
            await conn.commit();
            return value;
        }
        catch (error) {
            await conn.rollback();
            throw error;
        }
        finally {
            await conn.close();
        }
    }
    if (mode === "mssql" && mssqlPool) {
        if (!mssqlDriver)
            mssqlDriver = (await import('mssql')).default;
        const tx = new mssqlDriver.Transaction(mssqlPool);
        await tx.begin();
        try {
            const value = await fn({
                query: async (sql, params = {}) => {
                    const request = tx.request();
                    for (const [k, v] of Object.entries(params))
                        request.input(k, v);
                    const result = await request.query(toMssql(sql));
                    return result.recordset || [];
                },
            });
            await tx.commit();
            return value;
        }
        catch (error) {
            await tx.rollback();
            throw error;
        }
    }
    if (!db)
        throw new Error("BD no inicializada");
    db.run("BEGIN TRANSACTION");
    try {
        const value = await fn(db);
        db.run("COMMIT");
        scheduleSave();
        return value;
    }
    catch (error) {
        try {
            db.run("ROLLBACK");
        }
        catch {
            // ignore
        }
        throw error;
    }
}
export async function pingDb() {
    if (mode === "oracle" && oraclePool) {
        const started = Date.now();
        try {
            const conn = await oraclePool.getConnection();
            try {
                await conn.execute("SELECT 1 FROM DUAL");
            }
            finally {
                await conn.close();
            }
            return { ok: true, msg: "Oracle PCELULAR OK", ms: Date.now() - started };
        }
        catch (error) {
            return { ok: false, msg: error.message, ms: Date.now() - started };
        }
    }
    if (mode === "mssql" && mssqlPool) {
        const started = Date.now();
        try {
            await mssqlPool.request().query("SELECT 1 AS ok");
            return { ok: true, msg: `SQL Server ${process.env.MSSQL_SERVER || ''} OK`, ms: Date.now() - started };
        }
        catch (error) {
            return { ok: false, msg: error.message, ms: Date.now() - started };
        }
    }
    return { ok: true, msg: `SQLite (${DB_PATH})`, ms: 0 };
}
export async function closeDb() {
    if (oraclePool) {
        try {
            await oraclePool.close(5);
        }
        catch {
            // ignore
        }
        oraclePool = null;
    }
    if (mssqlPool) {
        try {
            await mssqlPool.close();
        }
        catch {
            // ignore
        }
        mssqlPool = null;
    }
    if (db) {
        saveDisk();
        db.close();
        db = null;
    }
    if (saveTimer)
        clearTimeout(saveTimer);
}
// Helpers de traduccion SQL expuestos para tests y para scripts
// externos que quieran validar la conversion a T-SQL o SQLite sin
// inicializar el pool.
export { toMssql, toSqlite };
//# sourceMappingURL=database.js.map