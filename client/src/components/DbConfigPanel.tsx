import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, Database, Plug, RefreshCcw, XCircle } from "lucide-react";
import { getAuthToken } from "../api/client.ts";

type Props = {
  onClose: () => void;
  showToast: (t: "success" | "error" | "info", m: string) => void;
};

type TestResult = {
  success: boolean;
  message: string;
  data: {
    host: string;
    port: string;
    service: string;
    user: string;
    latencyMs: number;
    tables: string[];
  };
};

export function DbConfigPanel({ onClose, showToast }: Props) {
  const [testForm, setTestForm] = useState({ host: "25", port: "1521", service: "PCELULAR", user: "pcelular", password: "pcelular" });
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/db/config", { headers: { Authorization: `Bearer ${getAuthToken()}` } });
        const data = await res.json();
        if (data.success) {
          setTestForm((prev) => ({
            ...prev,
            host: data.data.config.oracleHost || prev.host,
            port: data.data.config.oraclePort || prev.port,
            service: data.data.config.oracleService || prev.service,
            user: data.data.config.oracleUser || prev.user,
          }));
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const testDb = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/db/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(testForm),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) showToast("success", `Conexion Oracle valida (${data.data.latencyMs}ms).`);
      else showToast("error", data.message || "No se pudo validar la conexion.");
    } catch (error: any) {
      showToast("error", error.message || "Error probando conexion.");
    }
    setTesting(false);
  };

  const connectDb = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/db/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(testForm),
      });
      const data = await res.json();
      if (data.success) {
        showToast("success", data.message || "Conexion aplicada. Debe iniciar sesion nuevamente.");
        onClose();
        window.dispatchEvent(new CustomEvent("sgf:session-expired"));
        window.setTimeout(() => window.location.reload(), 500);
      } else {
        showToast("error", data.error || data.message || "No se pudo conectar.");
      }
    } catch (error: any) {
      showToast("error", error.message || "Error conectando a Oracle.");
    }
    setConnecting(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-lg">Base de Datos</h2>
              <p className="text-xs text-gray-400">Probar y conectar Oracle</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/60 dark:to-blue-950/60 rounded-xl p-5 border border-indigo-100 dark:border-indigo-900/70">
            <h3 className="font-bold text-gray-900 dark:text-white mb-1 text-sm flex items-center gap-2">
              <RefreshCcw className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
              Probar Conexion Oracle
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-300 mb-4">Ingrese credenciales y presione Probar para verificar acceso a Oracle.</p>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
              <Input value={testForm.host} onChange={(host) => setTestForm({ ...testForm, host })} placeholder="Host" />
              <Input value={testForm.port} onChange={(port) => setTestForm({ ...testForm, port })} placeholder="Puerto" />
              <Input value={testForm.service} onChange={(service) => setTestForm({ ...testForm, service })} placeholder="Servicio" />
              <Input value={testForm.user} onChange={(user) => setTestForm({ ...testForm, user })} placeholder="Usuario" />
              <Input type="password" value={testForm.password} onChange={(password) => setTestForm({ ...testForm, password })} placeholder="Password" />
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={testDb} disabled={testing || connecting} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm rounded-lg font-medium flex items-center gap-2 transition-colors">
                {testing ? <><Activity className="w-4 h-4 animate-spin" />Probando...</> : <><RefreshCcw className="w-4 h-4" />Probar Conexion</>}
              </button>

              {testResult?.success && (
                <button onClick={connectDb} disabled={connecting || testing} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm rounded-lg font-medium flex items-center gap-2 transition-colors">
                  {connecting ? <><Activity className="w-4 h-4 animate-spin" />Conectando...</> : <><Plug className="w-4 h-4" />Conectarse</>}
                </button>
              )}
            </div>

            {testResult && (
              <div className={`mt-4 p-4 rounded-lg text-sm ${testResult.success ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300" : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"}`}>
                <div className="flex items-center gap-2 mb-2 font-semibold">
                  {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {testResult.message}
                </div>
                {testResult.success && testResult.data.tables?.length > 0 && (
                  <div>
                    <p className="text-xs mb-1 opacity-80">Tablas detectadas:</p>
                    <div className="flex flex-wrap gap-1">
                      {testResult.data.tables.map((t) => (
                        <span key={t} className="px-2 py-0.5 bg-white dark:bg-gray-800 rounded text-xs font-mono border border-emerald-100 dark:border-emerald-900/60">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return (
    <input
      className="px-2.5 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm"
      placeholder={placeholder}
      value={value}
      type={type}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
