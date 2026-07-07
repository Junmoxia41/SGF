import { type FormEvent, useState } from "react";
import { AlertCircle, Database, Wifi } from "lucide-react";
import type { HealthData } from "../types/api.ts";

type Props = {
  serverInfo: HealthData | null;
  loginError: string;
  onLogin: (u: string, p: string) => Promise<boolean>;
};

export function LoginScreen({ serverInfo, loginError, onLogin }: Props) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.username || !form.password) return;
    setLoading(true);
    await onLogin(form.username, form.password);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
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
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">v4.0 · Autenticacion centralizada · Datos en servidor</p>
        </div>
      </div>
    </div>
  );
}
