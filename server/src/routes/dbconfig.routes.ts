import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ServerResponse } from "node:http";
import { connectOracleRuntime, getDbMode } from "../models/database.js";
import { sendJson, readJsonBody, requireAdmin } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "../../.env");

type OracleConnectPayload = {
  host: string;
  port: string;
  service: string;
  user: string;
  password: string;
};

function currentConfig() {
  return {
    oracleUser: process.env.ORACLE_USER || "pcelular",
    oracleHost: process.env.ORACLE_HOST || "25",
    oraclePort: process.env.ORACLE_PORT || "1521",
    oracleService: process.env.ORACLE_SERVICE || "PCELULAR",
    httpPort: process.env.PORT || "3000",
    dbMode: getDbMode(),
  };
}

function saveEnvConfig(config: OracleConnectPayload) {
  const current = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const lines = current.split(/\r?\n/).filter(Boolean);
  const map = new Map<string, string>();

  for (const line of lines) {
    if (!line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1);
    map.set(key, value);
  }

  map.set("PORT", map.get("PORT") || "3000");
  map.set("HOST", map.get("HOST") || "0.0.0.0");
  map.set("ORACLE_USER", config.user);
  map.set("ORACLE_PASSWORD", config.password);
  map.set("ORACLE_HOST", config.host);
  map.set("ORACLE_PORT", config.port);
  map.set("ORACLE_SERVICE", config.service);
  map.set("ORACLE_POOL_MIN", map.get("ORACLE_POOL_MIN") || "2");
  map.set("ORACLE_POOL_MAX", map.get("ORACLE_POOL_MAX") || "20");
  map.set("ORACLE_POOL_INCREMENT", map.get("ORACLE_POOL_INCREMENT") || "2");
  map.set("ORACLE_POOL_TIMEOUT", map.get("ORACLE_POOL_TIMEOUT") || "60");
  map.set("JWT_SECRET", map.get("JWT_SECRET") || "sgf-jwt-secret-cambiar-en-produccion");
  map.set("JWT_EXPIRES_IN", map.get("JWT_EXPIRES_IN") || "8h");
  map.set("REQUEST_TIMEOUT_MS", map.get("REQUEST_TIMEOUT_MS") || "30000");
  map.set("MAX_FILE_SIZE_MB", map.get("MAX_FILE_SIZE_MB") || "10");

  const orderedKeys = [
    "PORT",
    "HOST",
    "ORACLE_USER",
    "ORACLE_PASSWORD",
    "ORACLE_HOST",
    "ORACLE_PORT",
    "ORACLE_SERVICE",
    "ORACLE_POOL_MIN",
    "ORACLE_POOL_MAX",
    "ORACLE_POOL_INCREMENT",
    "ORACLE_POOL_TIMEOUT",
    "JWT_SECRET",
    "JWT_EXPIRES_IN",
    "REQUEST_TIMEOUT_MS",
    "MAX_FILE_SIZE_MB",
  ];

  const content = orderedKeys.map((key) => `${key}=${map.get(key) || ""}`).join("\n") + "\n";
  fs.writeFileSync(ENV_PATH, content, "utf8");
}

async function testOracleConnection(config: OracleConnectPayload) {
  try {
    const oracledb = await import("oracledb");
    const conn = await oracledb.default.getConnection({
      user: config.user,
      password: config.password,
      connectString: `${config.host}:${config.port}/${config.service}`,
    });

    const tables = await conn.execute(
      `SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = 'PCELULAR' AND TABLE_NAME IN ('CARGARARCH','LINEA_TELEFONICA','PERSONA','PRESUPUESTO','UNIDAD','ORGANO','CARGO','GRADO','PROVINCIA','MUNICIPIO') ORDER BY TABLE_NAME`,
      [],
      { outFormat: oracledb.default.OUT_FORMAT_OBJECT },
    );

    await conn.close();
    return {
      success: true,
      message: "Conexion Oracle valida.",
      data: {
        host: config.host,
        port: config.port,
        service: config.service,
        user: config.user,
        latencyMs: 0,
        tables: (tables.rows || []).map((row: any) => row.TABLE_NAME),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Error de conexion: ${error.message}`,
      data: {
        host: config.host,
        port: config.port,
        service: config.service,
        user: config.user,
        latencyMs: 0,
        tables: [],
      },
    };
  }
}

export async function handleDbConfig(req: AuthenticatedRequest, res: ServerResponse) {
  return sendJson(res, 200, { success: true, data: { config: currentConfig(), mode: getDbMode() } });
}

export async function handleDbTest(req: AuthenticatedRequest, res: ServerResponse) {
  let body: any;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { success: false, error: "JSON invalido." });
  }

  const payload: OracleConnectPayload = {
    host: String(body.host || process.env.ORACLE_HOST || "25").trim(),
    port: String(body.port || process.env.ORACLE_PORT || "1521").trim(),
    service: String(body.service || process.env.ORACLE_SERVICE || "PCELULAR").trim(),
    user: String(body.user || process.env.ORACLE_USER || "pcelular").trim(),
    password: String(body.password || process.env.ORACLE_PASSWORD || "pcelular").trim(),
  };

  const started = Date.now();
  const result = await testOracleConnection(payload);
  result.data.latencyMs = Date.now() - started;
  return sendJson(res, 200, result);
}

export async function handleDbConnect(req: AuthenticatedRequest, res: ServerResponse) {
  if (!requireAdmin(req, res)) return;

  let body: any;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { success: false, error: "JSON invalido." });
  }

  const payload: OracleConnectPayload = {
    host: String(body.host || process.env.ORACLE_HOST || "25").trim(),
    port: String(body.port || process.env.ORACLE_PORT || "1521").trim(),
    service: String(body.service || process.env.ORACLE_SERVICE || "PCELULAR").trim(),
    user: String(body.user || process.env.ORACLE_USER || "pcelular").trim(),
    password: String(body.password || process.env.ORACLE_PASSWORD || "pcelular").trim(),
  };

  try {
    saveEnvConfig(payload);
    await connectOracleRuntime(payload);
    return sendJson(res, 200, {
      success: true,
      message: `Conectado a Oracle en ${payload.host}:${payload.port}/${payload.service}. Debe iniciar sesion nuevamente para continuar.`,
      data: {
        connected: true,
        mode: getDbMode(),
        config: currentConfig(),
      },
    });
  } catch (error: any) {
    return sendJson(res, 500, {
      success: false,
      error: `No se pudo conectar a Oracle: ${error.message}`,
    });
  }
}
