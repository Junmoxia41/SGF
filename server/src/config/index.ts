import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const APP_CONFIG = {
  name: "SGF", fullName: "Sistema de Gestion de Facturas",
  version: "4.0.0", description: "Facturas ETECSA - Cliente/Servidor Centralizado",
};

export const SERVER_CONFIG = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || "0.0.0.0",
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS) || 30000,
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB) || 10,
};

export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || "sgf-jwt-secret-cambiar-en-produccion",
  expiresIn: process.env.JWT_EXPIRES_IN || "8h",
};

export const ORACLE_CONFIG = {
  user: process.env.ORACLE_USER || "pcelular",
  password: process.env.ORACLE_PASSWORD || "pcelular",
  host: process.env.ORACLE_HOST || "25",
  port: Number(process.env.ORACLE_PORT) || 1521,
  service: process.env.ORACLE_SERVICE || "PCELULAR",
  get connectString() {
    return `${this.host}:${this.port}/${this.service}`;
  },
  pool: {
    min: Number(process.env.ORACLE_POOL_MIN) || 2,
    max: Number(process.env.ORACLE_POOL_MAX) || 20,
    increment: Number(process.env.ORACLE_POOL_INCREMENT) || 2,
    timeout: Number(process.env.ORACLE_POOL_TIMEOUT) || 60,
  },
};
