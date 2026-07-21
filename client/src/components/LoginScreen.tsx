import { type FormEvent, useState } from "react";
import { AlertCircle, Database, Wifi, Settings, LogOut, Plug } from "lucide-react";
import type { HealthData } from "../types/api.ts";

type Props = {
  serverInfo: HealthData | null;
  loginError: string;
  onLogin: (u: string, p: string) => Promise<boolean>;
  onOpenDbConfig?: () => void;
  onDbChange?: () => void;
};

export function LoginScreen({ serverInfo, loginError, onLogin, onOpenDbConfig, onDbChange }: Props) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const dbMode = (serverInfo?.dbMode || "sqlite").toLowerCase();
  const isEnterprise = dbMode === "mssql" || dbMode === "oracle";
  const modeLabel = dbMode === "mssql" ? "SQL Server" : dbMode === "oracle" ? "Oracle" : "SQLite";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.username || !form.password) return;
    setLoading(true);
    await onLogin(form.username, form.password);
    setLoading(false);
  };

  const handleDisconnect = async () => {
    if (!confirm("¿Desconectar de la BD enterprise y volver a SQLite local?")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/db/disconnect", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        window.location.reload();
      } else {
        alert(data.error || "No se pudo desconectar");
      }
    } catch (e: any) {
      alert(e.message || "Error al desconectar");
    }
    setDisconnecting(false);
    onDbChange?.();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 relative">
      {/* Boton Conectar / Desconectar + Engranaje en esquina derecha - nuevo flujo */}
      <div className="absolute top-4 right-4 z-20">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-2.5 flex flex-col items-center min-w-[130px]">
          <div className="flex items-center gap-2 w-full justify-between">
            <button
              onClick={() => (isEnterprise ? handleDisconnect() : onOpenDbConfig?.())}
              disabled={disconnecting}
              className={`flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                isEnterprise
                  ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
              }`}
              title={isEnterprise ? "Desconectar de BD enterprise y volver a SQLite" : "Conectar a SQL Server / Oracle"}
            >
              {isEnterprise ? <LogOut className="w-3.5 h-3.5" /> : <Plug className="w-3.5 h-3.5" />}
              {disconnecting ? "..." : isEnterprise ? "Desconectar" : "Conectar"}
            </button>
            <button
              onClick={() => onOpenDbConfig?.()}
              className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
              title="Configurar Base de Datos"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-col items-center">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEnterprise ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300" : "bg-gray-100 dark:bg-gray-700 text-gray-500"}`}>
              <Database className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">{modeLabel}</span>
            <div className={`mt-1 w-2 h-2 rounded-full ${serverInfo?.db?.ok ? "bg-emerald-500" : "bg-amber-500"} animate-pulse`} title={serverInfo?.db?.ok ? "BD OK" : "BD no OK"} />
          </div>
        </div>
      </div>

      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SGF</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Sistema de Gestion de Facturas</p>
            {serverInfo && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-xs text-emerald-700 dark:text-emerald-300">
                <Wifi className="w-3 h-3" />
                Servidor conectado{serverInfo.db?.ok ? ` · ${serverInfo.dbMode?.toUpperCase() || "BD"} OK` : ""}
              </div>
            )}
            <div className="mt-3 text-[11px] text-gray-400">
              Motor: <span className="font-mono font-bold uppercase">{modeLabel}</span> {isEnterprise ? "· Enterprise" : "· Local (respaldo)"}
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4" autoComplete="off">
            {loginError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Usuario</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Usuario"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contrasena</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Contrasena"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-medium rounded-lg"
            >
              {loading ? "Iniciando..." : "Iniciar Sesion"}
            </button>

            {!isEnterprise && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => onOpenDbConfig?.()}
                  className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline inline-flex items-center gap-1"
                >
                  <Database className="w-3 h-3" /> Configurar SQL Server / Oracle antes de entrar
                </button>
              </div>
            )}
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">v4.0 · Autenticacion centralizada · Datos en servidor</p>
        </div>
      </div>
    </div>
  );
}
