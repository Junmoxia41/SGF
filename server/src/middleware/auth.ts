import type { IncomingMessage, ServerResponse } from "node:http";
import { safeVerifyToken } from "../utils/jwt.js";
import { execute, getDbMode, query } from "../models/database.js";
import type { SessionUser } from "../models/types.js";

export interface AuthenticatedRequest extends IncomingMessage {
  currentUser?: SessionUser;
  body?: any;
}

export async function authenticate(req: AuthenticatedRequest, res: ServerResponse): Promise<SessionUser | null> {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) {
    sendJson(res, 401, { success: false, error: "Token no proporcionado." });
    return null;
  }

  const user = safeVerifyToken(token);
  if (!user) {
    sendJson(res, 401, { success: false, error: "Token invalido o expirado." });
    return null;
  }

  try {
    const dbMode = getDbMode();
    const rows = dbMode === "oracle"
      ? await query<any>(
          `SELECT ID FROM SGF_SESIONES
           WHERE SESSION_TOKEN = :t AND ACTIVE = 1 AND EXPIRES_AT > SYSTIMESTAMP`,
          { t: token },
        )
      : await query<any>(
          `SELECT ID FROM SGF_SESIONES
           WHERE TOKEN = :t AND ACTIVO = 1 AND EXPIRA > datetime('now')`,
          { t: token },
        );

    if (rows.length === 0) {
      sendJson(res, 401, { success: false, error: "Sesion expirada o cerrada." });
      return null;
    }

    if (dbMode === "oracle") {
      await execute(`UPDATE SGF_SESIONES SET EXPIRES_AT = SYSTIMESTAMP + INTERVAL '8' HOUR WHERE SESSION_TOKEN = :t`, { t: token });
    } else {
      await execute(`UPDATE SGF_SESIONES SET EXPIRA = datetime('now','+8 hours') WHERE TOKEN = :t`, { t: token });
    }
  } catch (error: any) {
    console.error("[AUTH ERROR]", error.message);
    sendJson(res, 503, { success: false, error: `Error de autenticacion: ${error.message}` });
    return null;
  }

  req.currentUser = user;
  return user;
}

export function requireAdmin(req: AuthenticatedRequest, res: ServerResponse): boolean {
  if (!req.currentUser || req.currentUser.role !== "admin") {
    sendJson(res, 403, { success: false, error: "Se requiere rol de administrador." });
    return false;
  }
  return true;
}

export function sendJson(res: ServerResponse, status: number, payload: unknown) {
  if (res.headersSent) return;
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  });
  res.end(JSON.stringify(payload));
}

export function getRequestIp(req: IncomingMessage): string {
  return (req.socket?.remoteAddress || "desconocida").replace("::ffff:", "");
}

export async function readJsonBody(req: IncomingMessage, maxBytes = 5 * 1024 * 1024): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Cuerpo muy grande."));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("JSON invalido."));
      }
    });

    req.on("error", reject);
  });
}
