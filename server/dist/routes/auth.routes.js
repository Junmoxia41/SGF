import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { execute, getDbMode, query } from "../models/database.js";
import { signToken } from "../utils/jwt.js";
import { sendJson, getRequestIp, readJsonBody } from "../middleware/auth.js";
import { auditLog } from "../middleware/logger.js";
function normalizeUser(row) {
    return {
        id: String(row?.ID ?? row?.id ?? ""),
        username: String(row?.USERNAME ?? row?.username ?? ""),
        name: String(row?.NOMBRE ?? row?.NAME ?? row?.name ?? ""),
        role: (row?.ROL ?? row?.ROLE ?? row?.role ?? "usuario") === "admin" ? "admin" : "usuario",
        active: Number(row?.ACTIVO ?? row?.ACTIVE ?? row?.active ?? 0),
        createdAt: String(row?.CREADO ?? row?.CREATED_AT ?? row?.created_at ?? ""),
        passwordHash: String(row?.PASSWORD_HASH ?? ""),
    };
}
export async function handleLogin(req, res) {
    let body;
    try {
        body = await readJsonBody(req);
    }
    catch {
        return sendJson(res, 400, { success: false, error: "JSON invalido." });
    }
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();
    const machineId = String(body.machineId || "pc").trim();
    if (!username || !password) {
        return sendJson(res, 400, { success: false, error: "Usuario y contrasena requeridos." });
    }
    try {
        const dbMode = getDbMode();
        const sql = dbMode === "oracle"
            ? `SELECT ID, USERNAME, NAME, ROLE, PASSWORD_HASH, ACTIVE, CREATED_AT FROM SGF_USUARIOS WHERE USERNAME = :u`
            : `SELECT ID, USERNAME, NOMBRE, ROL, PASSWORD_HASH, ACTIVO, CREADO FROM SGF_USUARIOS WHERE USERNAME = :u`;
        const rows = await query(sql, { u: username });
        if (rows.length === 0) {
            return sendJson(res, 401, { success: false, error: "Usuario o contrasena incorrectos." });
        }
        const user = normalizeUser(rows[0]);
        if (!user.active) {
            return sendJson(res, 403, { success: false, error: "Usuario inactivo. Contacte al administrador." });
        }
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
            return sendJson(res, 401, { success: false, error: "Usuario o contrasena incorrectos." });
        }
        const token = signToken({
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            active: true,
            createdAt: user.createdAt,
        });
        const sessionId = randomUUID();
        const ip = getRequestIp(req);
        if (dbMode === "oracle") {
            await execute(`UPDATE SGF_SESIONES SET ACTIVE = 0, ENDED_AT = SYSTIMESTAMP WHERE USER_ID = :uid AND ACTIVE = 1`, { uid: user.id });
            await execute(`INSERT INTO SGF_SESIONES (ID, USER_ID, SESSION_TOKEN, MACHINE_ID, IP_ADDRESS, ACTIVE, CREATED_AT, EXPIRES_AT)
         VALUES (:id, :uid, :tok, :m, :ip, 1, SYSTIMESTAMP, SYSTIMESTAMP + INTERVAL '8' HOUR)`, { id: sessionId, uid: user.id, tok: token, m: machineId, ip });
        }
        else {
            await execute(`UPDATE SGF_SESIONES SET ACTIVO = 0 WHERE USER_ID = :uid AND ACTIVO = 1`, { uid: user.id });
            await execute(`INSERT INTO SGF_SESIONES (ID, USER_ID, TOKEN, MAQUINA, IP, ACTIVO, CREADO, EXPIRA)
         VALUES (:id, :uid, :tok, :m, :ip, 1, datetime('now'), datetime('now','+8 hours'))`, { id: sessionId, uid: user.id, tok: token, m: machineId, ip });
        }
        req.currentUser = {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            active: true,
            createdAt: user.createdAt,
        };
        await auditLog(req, "login", "usuario", user.id, "info", `${username} - ${machineId}`);
        return sendJson(res, 200, {
            success: true,
            message: "Sesion iniciada.",
            data: {
                user: req.currentUser,
                token,
                sessionId,
                machineId,
            },
        });
    }
    catch (error) {
        console.error("[LOGIN ERROR]", error.message);
        return sendJson(res, 503, { success: false, error: `Error del servidor: ${error.message}` });
    }
}
export async function handleLogout(req, res) {
    const token = (req.headers.authorization || "").startsWith("Bearer ")
        ? (req.headers.authorization || "").slice(7)
        : "";
    try {
        if (getDbMode() === "oracle") {
            await execute(`UPDATE SGF_SESIONES SET ACTIVE = 0, ENDED_AT = SYSTIMESTAMP WHERE SESSION_TOKEN = :t`, { t: token });
        }
        else {
            await execute(`UPDATE SGF_SESIONES SET ACTIVO = 0 WHERE TOKEN = :t`, { t: token });
        }
        return sendJson(res, 200, { success: true, message: "Sesion cerrada." });
    }
    catch (error) {
        return sendJson(res, 503, { success: false, error: `Error: ${error.message}` });
    }
}
export async function handleMe(req, res) {
    try {
        const sql = getDbMode() === "oracle"
            ? `SELECT ID, USERNAME, NAME, ROLE, ACTIVE, CREATED_AT FROM SGF_USUARIOS WHERE ID = :id`
            : `SELECT ID, USERNAME, NOMBRE, ROL, ACTIVO, CREADO FROM SGF_USUARIOS WHERE ID = :id`;
        const rows = await query(sql, { id: req.currentUser.id });
        if (rows.length === 0) {
            return sendJson(res, 404, { success: false, error: "Usuario no encontrado." });
        }
        const user = normalizeUser(rows[0]);
        return sendJson(res, 200, {
            success: true,
            data: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                active: Boolean(user.active),
                createdAt: user.createdAt,
            },
        });
    }
    catch (error) {
        return sendJson(res, 503, { success: false, error: `Error: ${error.message}` });
    }
}
//# sourceMappingURL=auth.routes.js.map