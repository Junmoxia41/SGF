import initSqlJs, { type Database as SqlJsDb } from "sql.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../../server-data");
const DB_PATH = path.join(DATA_DIR, "sgf-data.db");

type DbMode = "oracle" | "sqlite";

let db: SqlJsDb | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let oraclePool: any = null;
let mode: DbMode = "sqlite";

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function saveDisk() {
  if (!db) return;
  try {
    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
  } catch (error: any) {
    console.error("[SGF] Error guardando SQLite:", error.message);
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
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

type OracleRuntimeConfig = {
  user: string;
  password: string;
  host: string;
  port: string | number;
  service: string;
};

const SQLITE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_cargararch_numero ON PCELULAR_CARGARARCH(NUMERO)`,
  `CREATE INDEX IF NOT EXISTS idx_sesiones_token ON SGF_SESIONES(TOKEN)`,
  `CREATE INDEX IF NOT EXISTS idx_sesiones_user ON SGF_SESIONES(USER_ID)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_creado ON SGF_LOGS(CREADO)`,
  `CREATE INDEX IF NOT EXISTS idx_facturas_no_factura ON SGF_FACTURAS(NO_FACTURA)`,
  `CREATE INDEX IF NOT EXISTS idx_servicios_factura_id ON SGF_SERVICIOS(FACTURA_ID)`,
];

function paramNames(sql: string): string[] {
  const names: string[] = [];
  const re = /:(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) names.push(match[1]);
  return names;
}

function toSqlite(sql: string) {
  let out = sql;
  out = out.replace(/PCELULAR\./gi, "PCELULAR_");
  out = out.replace(/SYSTIMESTAMP/gi, "datetime('now')");
  out = out.replace(/SYSDATE/gi, "datetime('now')");
  out = out.replace(/FROM DUAL/gi, "");
  out = out.replace(/NVL\s*\(/gi, "IFNULL(");
  out = out.replace(/TO_CHAR\s*\(\s*([^,]+?)\s*,\s*'[^']*'\s*\)/gi, "$1");
  out = out.replace(/OFFSET\s*:(\w+)\s+ROWS\s+FETCH\s+NEXT\s*:(\w+)\s+ROWS\s+ONLY/gi, "LIMIT :$2 OFFSET :$1");
  out = out.replace(/INTERVAL\s*'8'\s*HOUR/gi, "'+8 hours'");
  out = out.replace(/:(\w+)/g, "?");
  return out.trim();
}

async function sqliteQuery(sql: string, params: Record<string, any> = {}) {
  if (!db) throw new Error("BD no inicializada");
  const converted = toSqlite(sql);
  const values = paramNames(sql).map((key) => params[key]);
  const stmt = db.prepare(converted);
  stmt.bind(values);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

async function sqliteExecute(sql: string, params: Record<string, any> = {}) {
  if (!db) throw new Error("BD no inicializada");
  const converted = toSqlite(sql);
  const values = paramNames(sql).map((key) => params[key]);
  db.run(converted, values);
  const affected = db.getRowsModified();
  scheduleSave();
  return affected;
}

async function ensureAdmin() {
  const hash = await bcrypt.hash("123", 12);
  const id = randomUUID();

  if (mode === "oracle") {
    const rows = await query<any>("SELECT ID FROM SGF_USUARIOS WHERE USERNAME = :u", { u: "yolexis" });
    if (rows.length > 0) return;
    await execute(
      `INSERT INTO SGF_USUARIOS (ID, USERNAME, NAME, ROLE, PASSWORD_HASH, ACTIVE, CREATED_AT, UPDATED_AT)
       VALUES (:id, :u, :n, :r, :h, 1, SYSTIMESTAMP, SYSTIMESTAMP)`,
      { id, u: "yolexis", n: "Administrador SGF", r: "admin", h: hash },
    );
    console.log("[SGF] Admin Oracle creado: yolexis / 123");
    return;
  }

  const rows = await sqliteQuery("SELECT ID FROM SGF_USUARIOS WHERE USERNAME = :u", { u: "yolexis" });
  if (rows.length > 0) return;
  await sqliteExecute(
    `INSERT INTO SGF_USUARIOS (ID, USERNAME, NOMBRE, ROL, PASSWORD_HASH, ACTIVO, CREADO)
     VALUES (:id, :u, :n, :r, :h, 1, datetime('now'))`,
    { id, u: "yolexis", n: "Administrador SGF", r: "admin", h: hash },
  );
  console.log("[SGF] Admin SQLite creado: yolexis / 123");
}

async function initSqlite() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log("[SGF] SQLite cargado:", DB_PATH);
  } else {
    db = new SQL.Database();
    console.log("[SGF] SQLite creado:", DB_PATH);
  }

  for (const sql of SQLITE_SCHEMA) db.run(sql);
  for (const sql of SQLITE_INDEXES) db.run(sql);
  mode = "sqlite";
  await ensureAdmin();
  saveDisk();
  return { mode: "sqlite" as const, ok: true };
}


async function ensureOracleSchema(pool: any) {
  const conn = await pool.getConnection();
  try {
    for (const sql of ORACLE_SCHEMA_TABLES) {
      try {
        await conn.execute(sql);
      } catch (error: any) {
        if (!String(error?.message || '').includes('ORA-00955')) throw error;
      }
    }
    for (const sql of ORACLE_SCHEMA_INDEXES) {
      try {
        await conn.execute(sql);
      } catch (error: any) {
        if (!String(error?.message || '').includes('ORA-00955')) throw error;
      }
    }
    await conn.commit();
  } finally {
    await conn.close();
  }
}

export async function connectOracleRuntime(config?: Partial<OracleRuntimeConfig>) {
  const driver = await import('oracledb');
  const nextConfig = {
    user: String(config?.user || process.env.ORACLE_USER || 'pcelular'),
    password: String(config?.password || process.env.ORACLE_PASSWORD || 'pcelular'),
    host: String(config?.host || process.env.ORACLE_HOST || '25'),
    port: String(config?.port || process.env.ORACLE_PORT || '1521'),
    service: String(config?.service || process.env.ORACLE_SERVICE || 'PCELULAR'),
  };

  const nextPool = await driver.default.createPool({
    user: nextConfig.user,
    password: nextConfig.password,
    connectString: `${nextConfig.host}:${nextConfig.port}/${nextConfig.service}`,
    poolMin: 2,
    poolMax: 8,
    poolIncrement: 1,
    poolTimeout: 30,
  });

  try {
    const conn = await nextPool.getConnection();
    try {
      await conn.execute('SELECT 1 FROM DUAL');
    } finally {
      await conn.close();
    }
    await ensureOracleSchema(nextPool);
  } catch (error) {
    try { await nextPool.close(5); } catch {}
    throw error;
  }

  if (oraclePool) {
    try { await oraclePool.close(5); } catch {}
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

export async function initDatabase() {
  ensureDir();

  try {
    await connectOracleRuntime();
    console.log("[SGF] Oracle PCELULAR conectado");
    return { mode: "oracle" as const, ok: true };
  } catch (error: any) {
    oraclePool = null;
    console.log("[SGF] Oracle no disponible, usando SQLite local:", error?.message || "sin detalle");
  }

  return initSqlite();
}

export function getDbMode(): DbMode {
  return mode;
}

export async function query<T = any>(sql: string, params: Record<string, any> = {}): Promise<T[]> {
  if (mode === "oracle" && oraclePool) {
    const oracledb = await import("oracledb");
    const conn = await oraclePool.getConnection();
    try {
      const result = await conn.execute(sql, params, { outFormat: oracledb.default.OUT_FORMAT_OBJECT });
      return (result.rows || []) as T[];
    } finally {
      await conn.close();
    }
  }
  return (await sqliteQuery(sql, params)) as T[];
}

export async function execute(sql: string, params: Record<string, any> = {}): Promise<number> {
  if (mode === "oracle" && oraclePool) {
    const conn = await oraclePool.getConnection();
    try {
      const result = await conn.execute(sql, params, { autoCommit: true });
      return result.rowsAffected || 0;
    } finally {
      await conn.close();
    }
  }
  return sqliteExecute(sql, params);
}

export async function transaction<T>(fn: (conn: any) => Promise<T>): Promise<T> {
  if (mode === "oracle" && oraclePool) {
    const conn = await oraclePool.getConnection();
    try {
      const value = await fn(conn);
      await conn.commit();
      return value;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      await conn.close();
    }
  }

  if (!db) throw new Error("BD no inicializada");
  db.run("BEGIN TRANSACTION");
  try {
    const value = await fn(db);
    db.run("COMMIT");
    scheduleSave();
    return value;
  } catch (error) {
    try {
      db.run("ROLLBACK");
    } catch {
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
      } finally {
        await conn.close();
      }
      return { ok: true, msg: "Oracle PCELULAR OK", ms: Date.now() - started };
    } catch (error: any) {
      return { ok: false, msg: error.message, ms: Date.now() - started };
    }
  }

  return { ok: true, msg: `SQLite (${DB_PATH})`, ms: 0 };
}

export async function closeDb() {
  if (oraclePool) {
    try {
      await oraclePool.close(5);
    } catch {
      // ignore
    }
    oraclePool = null;
  }

  if (db) {
    saveDisk();
    db.close();
    db = null;
  }

  if (saveTimer) clearTimeout(saveTimer);
}
