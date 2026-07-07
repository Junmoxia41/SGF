import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import { query, execute, transaction } from "../models/database.js";
import { sendJson, readJsonBody, requireAdmin } from "../middleware/auth.js";
import { auditLog } from "../middleware/logger.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export async function handleGetInvoices(req: AuthenticatedRequest, res: ServerResponse, url: URL) {
  const user = req.currentUser!;
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 10));
  const search = (url.searchParams.get("search") || "").trim();
  const estado = (url.searchParams.get("estado") || "").trim();

  try {
    let where = ""; const params: Record<string, any> = {};
    if (user.role !== "admin") { where = "WHERE user_id = :uid"; params.uid = user.id; }
    if (search) {
      const sc = "(cliente LIKE :s OR no_factura LIKE :s OR codigo_pago LIKE :s)";
      where = where ? `${where} AND ${sc}` : `WHERE ${sc}`;
      params.s = `%${search}%`;
    }
    if (estado && ["procesado","pendiente","error"].includes(estado)) {
      where = where ? `${where} AND estado = :est` : "WHERE estado = :est";
      params.est = estado;
    }

    const cnt = await query<any>(`SELECT COUNT(*) AS CNT FROM sgf_facturas ${where}`, params);
    const total = cnt[0]?.CNT || 0;
    const offset = (page - 1) * pageSize;

    const invoices = await query<any>(
      `SELECT * FROM sgf_facturas ${where} ORDER BY created_at DESC LIMIT :lim OFFSET :off`,
      { ...params, lim: pageSize, off: offset });

    // Servicios
    const ids = invoices.map((i: any) => i.ID || i.id);
    let svcMap: Record<string, any[]> = {};
    if (ids.length > 0) {
      const ph = ids.map((_: string, i: number) => `:id${i}`).join(",");
      const sp: Record<string, any> = {}; ids.forEach((id: string, i: number) => { sp[`id${i}`] = id; });
      const svcs = await query<any>(`SELECT * FROM sgf_servicios WHERE factura_id IN (${ph}) ORDER BY id`, sp);
      for (const s of svcs) {
        const fid = s.FACTURA_ID || s.factura_id;
        if (!svcMap[fid]) svcMap[fid] = [];
        svcMap[fid].push(s);
      }
    }
    const result = invoices.map((i: any) => ({ ...i, servicios: svcMap[i.ID || i.id] || [] }));

    return sendJson(res, 200, { success: true, data: result, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err: any) { return sendJson(res, 503, { success: false, error: `Error: ${err.message}` }); }
}

export async function handleGetInvoice(req: AuthenticatedRequest, res: ServerResponse, invId: string) {
  try {
    const rows = await query<any>("SELECT * FROM sgf_facturas WHERE id = :id", { id: invId });
    if (rows.length === 0) return sendJson(res, 404, { success: false, error: "Factura no encontrada." });
    const inv = rows[0];
    const iuid = inv.USER_ID || inv.user_id;
    if (req.currentUser!.role !== "admin" && iuid !== req.currentUser!.id)
      return sendJson(res, 403, { success: false, error: "Sin permiso." });
    const svcs = await query<any>("SELECT * FROM sgf_servicios WHERE factura_id = :id ORDER BY id", { id: invId });
    return sendJson(res, 200, { success: true, data: { ...inv, servicios: svcs } });
  } catch (err: any) { return sendJson(res, 503, { success: false, error: `Error: ${err.message}` }); }
}

export async function handleCreateInvoice(req: AuthenticatedRequest, res: ServerResponse) {
  let body: any;
  try { body = await readJsonBody(req, 20 * 1024 * 1024); } catch { return sendJson(res, 400, { success: false, error: "JSON invalido." }); }
  const user = req.currentUser!;
  const id = randomUUID();

  try {
    await transaction(async (_conn) => {
      await execute(
        `INSERT INTO sgf_facturas (id, cliente, cuenta, numero_cliente, numero_cuenta, no_factura, fecha_emision, fecha_vencimiento, periodo_consumo, codigo_pago, moneda, nit, cuota, consumo, comision, impuesto, total, total_pagar, estado, parser, ocr_confidence, ocr_duration, archivo, texto_ocr, user_id)
         VALUES (:id, :cl, :cu, :nc, :ncu, :nf, :fe, :fv, :pc, :cp, :mo, :ni, :ct, :cs, :cm, :im, :tt, :tp, :es, :pa, :oc, :od, :ar, :tx, :uid)`,
        { id, cl: body.cliente || "", cu: body.cuenta || "", nc: body.numeroCliente || "", ncu: body.numeroCuenta || "",
          nf: body.noFactura || "", fe: body.fechaEmision || "", fv: body.fechaVencimiento || "", pc: body.periodoConsumo || "",
          cp: body.codigoPago || "", mo: body.moneda || "CUP", ni: body.nit || "",
          ct: Number(body.cuota) || 0, cs: Number(body.consumo) || 0, cm: Number(body.comision) || 0, im: Number(body.impuesto) || 0,
          tt: Number(body.total) || 0, tp: Number(body.totalPagar) || 0, es: body.estado || "pendiente",
          pa: body.parser || "manual", oc: Number(body.ocrConfidence) || 0, od: Number(body.ocrDuration) || 0,
          ar: body.archivo || "", tx: body.textoOcr || "", uid: user.id });

      const svcs = Array.isArray(body.servicios) ? body.servicios : [];
      for (const s of svcs) {
        await execute(
          "INSERT INTO sgf_servicios (id, factura_id, numero_servicio, cuota, consumo, comision, impuesto, importe) VALUES (:sid, :fid, :ns, :ct, :cs, :cm, :im, :ip)",
          { sid: randomUUID(), fid: id, ns: s.numeroServicio || "", ct: Number(s.cuota) || 0, cs: Number(s.consumo) || 0,
            cm: Number(s.comision) || 0, im: Number(s.impuesto) || 0, ip: Number(s.importe) || 0 });
      }
    });

    await auditLog(req, "crear_factura", "factura", id, "info", `Factura ${body.noFactura || id}`);
    return sendJson(res, 201, { success: true, message: "Factura guardada.", data: { id } });
  } catch (err: any) { return sendJson(res, 503, { success: false, error: `Error: ${err.message}` }); }
}

export async function handleUpdateInvoice(req: AuthenticatedRequest, res: ServerResponse, invId: string) {
  if (!requireAdmin(req, res)) return;
  let body: any;
  try { body = await readJsonBody(req); } catch { return sendJson(res, 400, { success: false, error: "JSON invalido." }); }
  try {
    await execute(
      `UPDATE sgf_facturas SET cliente=:cl, cuenta=:cu, numero_cliente=:nc, numero_cuenta=:ncu, no_factura=:nf, periodo_consumo=:pc, codigo_pago=:cp, estado=:es, moneda=:mo, total_pagar=:tp, updated_at=datetime('now') WHERE id=:id`,
      { id: invId, cl: body.cliente || "", cu: body.cuenta || "", nc: body.numeroCliente || "", ncu: body.numeroCuenta || "",
        nf: body.noFactura || "", pc: body.periodoConsumo || "", cp: body.codigoPago || "",
        es: body.estado || "pendiente", mo: body.moneda || "CUP", tp: Number(body.totalPagar) || 0 });
    await auditLog(req, "editar_factura", "factura", invId, "info", "Factura actualizada.");
    return sendJson(res, 200, { success: true, message: "Factura actualizada." });
  } catch (err: any) { return sendJson(res, 503, { success: false, error: `Error: ${err.message}` }); }
}

export async function handleDeleteInvoice(req: AuthenticatedRequest, res: ServerResponse, invId: string) {
  if (!requireAdmin(req, res)) return;
  try {
    await execute("DELETE FROM sgf_facturas WHERE id = :id", { id: invId });
    await auditLog(req, "eliminar_factura", "factura", invId, "warn", "Factura eliminada.");
    return sendJson(res, 200, { success: true, message: "Factura eliminada." });
  } catch (err: any) { return sendJson(res, 503, { success: false, error: `Error: ${err.message}` }); }
}

export async function handleInvoiceStats(req: AuthenticatedRequest, res: ServerResponse) {
  try {
    const stats = await query<any>(
      `SELECT COUNT(*) AS TOTAL, SUM(CASE WHEN estado='procesado' THEN 1 ELSE 0 END) AS PROCESADOS,
       SUM(CASE WHEN estado='pendiente' THEN 1 ELSE 0 END) AS PENDIENTES,
       SUM(CASE WHEN estado='error' THEN 1 ELSE 0 END) AS ERRORES,
       SUM(total_pagar) AS MONTO_TOTAL, AVG(total_pagar) AS PROMEDIO FROM sgf_facturas`);
    return sendJson(res, 200, { success: true, data: stats[0] || {} });
  } catch (err: any) { return sendJson(res, 503, { success: false, error: `Error: ${err.message}` }); }
}
